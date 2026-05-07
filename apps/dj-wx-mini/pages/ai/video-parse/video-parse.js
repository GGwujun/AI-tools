const {
  saveParseTask,
  saveParseTaskResult,
  buildId
} = require('../../../utils/task-store');
const {
  rankRouteOptions,
  recordRouteResult
} = require('../../../utils/route-ranker');
const {
  detectPlatform,
  getPlatformLabel,
  isParseSupportedPlatform,
  extractSupportedLinks,
  findUrls
} = require('../../../utils/parse-link');
const storage = require('../../../utils/safe-storage');
const FALLBACK_PARSE_CONFIG = {
  slave_addr: 'http://127.0.0.1:8091/api/hybrid/video_data?url=',
  slave_addr2: 'https://dsx-family.site/api/hybrid/video_data?url=',
  backup_addr: '',
  data_field: 'data',
  code_field: 'code',
  code_num: '200'
};
const FALLBACK_ROUTE_OPTIONS = [
  { id: 'default_fallback', label: '\u4e3b\u7ebf\u8def', baseUrl: FALLBACK_PARSE_CONFIG.slave_addr },
  { id: 'backup_fallback', label: '\u5907\u7528\u7ebf\u8def 1', baseUrl: FALLBACK_PARSE_CONFIG.slave_addr2 }
];

const COPYRIGHT_BLOCK_PATTERN = /(\\u7535\\u5f71|\\u7535\\u89c6\\u5267|\\u7efc\\u827a|\\u52a8\\u6f2b|\\u65b0\\u95fb|\\u8d5b\\u4e8b|\\u76f4\\u64ad\\u56de\\u653e|\\u7eaa\\u5f55\\u7247|\\u756a\\u5267)/i;
const DEFAULT_ROUTE_OPTIONS = [{ id: 'default', label: '主线路', baseUrl: '' }];
const DEFAULT_STEPS = [
  { id: 'detect', label: '识别内容', status: 'idle' },
  { id: 'validate', label: '校验链接', status: 'idle' },
  { id: 'request', label: '请求解析', status: 'idle' },
  { id: 'result', label: '生成结果', status: 'idle' }
];

function getWatermarkStats() {
  const stats = storage.get('watermarkStats');
  return {
    videoParses: stats?.videoParses || 0,
    imageErases: stats?.imageErases || 0
  };
}

function setWatermarkStats(stats) {
  storage.set('watermarkStats', stats);
}

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success: resolve,
      fail: reject
    });
  });
}

function getBaseOrigin(baseUrl) {
  const match = String(baseUrl || '').match(/^https?:\/\/[^/]+/i);
  return match ? match[0] : '';
}

function buildInitialSteps() {
  return DEFAULT_STEPS.map((item) => ({ ...item }));
}

function buildInitialBatchSummary() {
  return {
    active: false,
    total: 0,
    completed: 0,
    success: 0,
    failed: 0,
    currentText: ''
  };
}

function buildRouteRecommendation(routeOptions) {
  const recommendedRoute = routeOptions.find((item) => item.recommended) || routeOptions[0];

  if (!recommendedRoute) {
    return '暂无可用线路。';
  }

  if (!recommendedRoute.successCount && !recommendedRoute.failureCount) {
    return `${recommendedRoute.label} 当前没有历史数据，会先作为默认入口。`;
  }

  return `${recommendedRoute.label} 当前表现更稳，系统会优先尝试它，再自动回退到其他线路。`;
}

function getRouteAttemptStatusLabel(status) {
  const map = {
    idle: '待命',
    running: '请求中',
    success: '成功',
    failed: '失败'
  };
  return map[status] || '待命';
}

function buildTaskTitle(analysis, targetUrl, batchContext) {
  const platform = detectPlatform(targetUrl);
  const platformLabel = platform ? getPlatformLabel(platform) : (analysis.platformLabel || '未识别');

  if (batchContext) {
    return `${platformLabel} 批量任务 ${batchContext.index}/${batchContext.total}`;
  }

  return analysis.rawText.slice(0, 40) || targetUrl || `${platformLabel} 解析任务`;
}

function buildAnalysisHighlights(analysis, routeOptions, selectedRouteId) {
  if (!analysis) return [];

  const selectedRoute = routeOptions.find((item) => item.id === selectedRouteId) || routeOptions[0];
  const confidence = analysis.supportedCount
    ? (analysis.supportedCount > 1 ? `${analysis.supportedCount} 条可批量` : '单链接输入')
    : '未命中可解析地址';

  return [
    {
      label: '当前判断',
      value: analysis.blockedByCompliance ? '命中合规拦截词' : confidence
    },
    {
      label: '推荐线路',
      value: selectedRoute?.label ? `${selectedRoute.label} · 自动兜底` : '主线路'
    },
    {
      label: '预期产物',
      value: analysis.supportedCount ? `${analysis.platformLabel} 素材结果` : '等待识别'
    }
  ];
}

function buildSmartHint(analysis) {
  if (!analysis || !analysis.rawText) {
    return '支持分享文案、短链和混合文本，先粘贴内容再做识别。';
  }

  if (analysis.blockedByCompliance) {
    return '当前文本疑似包含版权风险关键词，建议先确认是不是影视或长视频内容。';
  }

  if (analysis.recognizedPlatform && !analysis.supportedCount) {
    return `已识别为 ${analysis.recognizedPlatformLabel} 链接，当前版本暂不支持解析该平台。`;
  }

  if (!analysis.supportedCount) {
    return '没找到可解析平台链接，建议直接复制作品分享文案而不是纯说明文字。';
  }

  if (analysis.supportedCount > 1) {
    return `已识别到 ${analysis.supportedCount} 条可解析链接，可单条精修，也可直接批量跑完。`;
  }

  return `当前已识别为 ${analysis.platformLabel} 内容，可以直接开始解析。`;
}

function buildPlatformSummary(supportedLinks) {
  const counts = {};

  supportedLinks.forEach((url) => {
    const platform = detectPlatform(url);
    const label = platform ? getPlatformLabel(platform) : '其他';
    counts[label] = (counts[label] || 0) + 1;
  });

  return Object.keys(counts).map((label) => ({
    label,
    count: counts[label]
  }));
}

function extractVideoCover(data) {
  return data.video?.cover?.url_list?.[0]
    || data.cover_data?.cover?.url_list?.[0]
    || data.cover_data?.origin_cover?.url_list?.[0]
    || data.cover_data?.dynamic_cover?.url_list?.[0]
    || data.cover_data?.cover
    || data.cover_data?.origin_cover
    || data.cover_data?.dynamic_cover
    || data.cover
    || data.cover_url
    || data.pic
    || data.thumbnail
    || data.images?.[0]?.url_list?.[0]
    || data.image_data?.no_watermark_image_list?.[0]
    || data.image_post_info?.images?.[0]?.display_image?.url_list?.[0]
    || '';
}

function extractVideoUrl(data) {
  return data.video_data?.nwm_video_url_HQ
    || data.video_data?.nwm_video_url
    || data.video_data?.wm_video_url_HQ
    || data.video_data?.wm_video_url
    || data.video_urls?.[0]
    || data.video?.bit_rate?.[0]?.play_addr?.url_list?.[0]
    || data.video?.play_addr?.url_list?.[0]
    || data.video_url
    || data.play_url
    || data.download_url
    || data.url
    || '';
}

function extractDouyinNoWatermarkUrl(data) {
  return data.video?.play_addr?.url_list?.[0]?.replace('playwm', 'play')
    || data.video_data?.nwm_video_url_HQ
    || data.video_data?.nwm_video_url
    || extractVideoUrl(data);
}

function extractImageList(data) {
  const crawlerImages = (data.image_data?.no_watermark_image_list || [])
    .filter(Boolean);

  const xhsImages = (data.image_post_info?.images || [])
    .map((image) => image?.display_image?.url_list?.[0] || image?.url)
    .filter(Boolean);

  const commonImages = (data.images || [])
    .map((image) => image?.url_list?.[0] || image?.url || image)
    .filter(Boolean);

  if (crawlerImages.length) return crawlerImages;
  return xhsImages.length ? xhsImages : commonImages;
}

Page({
  data: {
    inputUrl: '',
    config: null,
    isLoadingConfig: false,
    selectedRouteId: 'default',
    routeOptions: DEFAULT_ROUTE_OPTIONS,
    routeRecommendation: '当前会优先使用默认线路。',
    routeAttempts: [],
    detectedLinks: [],
    selectedLinkIndex: 0,
    analysis: null,
    analysisHighlights: [],
    smartHint: '支持分享文案、短链和混合文本，先粘贴内容再做识别。',
    parseState: 'idle',
    parseMessage: '等待输入分享内容',
    failureReason: '',
    progressSteps: buildInitialSteps(),
    batchSummary: buildInitialBatchSummary(),
    supportModes: [
      {
        title: '自动抽链',
        desc: '支持整段分享文案、纯链接和混合文本，优先抽出可解析地址。'
      },
      {
        title: '自动切线路',
        desc: '从当前线路开始请求，失败后按顺序回退到其他线路，不让用户手动一条条试。'
      },
      {
        title: '批量任务',
        desc: '一次识别到多条链接时可直接顺序跑完，结果和失败原因都会归档。'
      },
      {
        title: '失败可回看',
        desc: '每条任务会保存状态、线路和结果快照，失败可重试，成功可直接回看。'
      }
    ],
    plannedPlatforms: [],
    platformReadiness: [
      { name: '\u6296\u97f3', state: 'ready', note: '\u5df2\u63a5\u5165\uff0c\u4f18\u5148\u4fdd\u969c' },
      { name: 'TikTok', state: 'ready', note: '\u5df2\u63a5\u5165\uff0c\u4f18\u5148\u4fdd\u969c' },
      { name: '\u5feb\u624b', state: 'route', note: '\u5df2\u63a5\u5165\uff0c\u4f9d\u8d56\u53ef\u7528\u7ebf\u8def' },
      { name: '\u5c0f\u7ea2\u4e66', state: 'route', note: '\u5df2\u63a5\u5165\uff0c\u56fe\u96c6\u80fd\u529b\u4f18\u5148' },
      { name: 'B\u7ad9', state: 'route', note: '\u5df2\u63a5\u5165\uff0c\u89c6\u9891\u80fd\u529b\u4f18\u5148' },
      { name: '\u5fae\u535a', state: 'route', note: '\u5df2\u63a5\u5165\uff0c\u4f9d\u8d56\u53ef\u7528\u7ebf\u8def' },
      { name: '\u5fae\u89c6', state: 'route', note: '\u5df2\u8bc6\u522b\uff0c\u7b49\u5f85\u7a33\u5b9a\u7ebf\u8def\u9a8c\u8bc1' }
    ],
    complianceItems: [
      '\u4ec5\u7528\u4e8e\u4e2a\u4eba\u5b66\u4e60\u4e0e\u5907\u4efd\uff0c\u7981\u6b62\u5546\u7528\u4fb5\u6743\uff0c\u8d23\u4efb\u81ea\u8d1f',
      '\u4e0d\u5904\u7406\u5f71\u89c6\u3001\u7efc\u827a\u3001\u52a8\u6f2b\u3001\u65b0\u95fb\u548c\u957f\u89c6\u9891\u7248\u6743\u5185\u5bb9',
      '\u5f53\u524d\u524d\u7aef\u652f\u6301\u81ea\u52a8\u62bd\u94fe\u3001\u81ea\u52a8\u5207\u7ebf\u8def\u548c\u6279\u91cf\u4efb\u52a1\uff0c\u771f\u5b9e\u89e3\u6790\u80fd\u529b\u4ecd\u4ee5\u540e\u53f0\u53ef\u7528\u7ebf\u8def\u4e3a\u51c6'
    ],
    shouldAutoParse: false,
    autoParseStarted: false
  },
  onLoad(options) {
    this.setData({
      shouldAutoParse: options.autoParse === '1'
    });
    if (options.input) {
      try {
        const inputUrl = decodeURIComponent(options.input);
        this.setData({ inputUrl }, () => this.refreshAnalysis());
      } catch (error) {
        console.error('read preset input failed', error);
      }
    }

    this.fetchConfig();

    if (!options.input) {
      this.fillInputFromClipboard(false);
    }
  },

  async fetchConfig() {
    if (this.data.isLoadingConfig) return;

    this.setData({ isLoadingConfig: true });

    try {
      const res = await request({
        url: 'https://dsx-family.site/ymq/',
        method: 'GET'
      });

      const config = { ...FALLBACK_PARSE_CONFIG, ...(res.data?.data || {}) };
      const routeOptions = this.prepareRouteOptions(this.buildRouteOptions(config));
      const selectedRouteId = routeOptions[0]?.id || 'default';

      this.setData({
        config,
        routeOptions,
        selectedRouteId,
        routeRecommendation: buildRouteRecommendation(routeOptions),
        isLoadingConfig: false,
        analysisHighlights: buildAnalysisHighlights(this.data.analysis, routeOptions, selectedRouteId)
      });
      this.tryAutoParse();
    } catch (error) {
      const config = { ...FALLBACK_PARSE_CONFIG };
      const routeOptions = this.prepareRouteOptions(FALLBACK_ROUTE_OPTIONS);
      const selectedRouteId = routeOptions[0]?.id || 'default_fallback';

      this.setData({
        config,
        routeOptions,
        selectedRouteId,
        routeRecommendation: buildRouteRecommendation(routeOptions),
        isLoadingConfig: false,
        analysisHighlights: buildAnalysisHighlights(this.data.analysis, routeOptions, selectedRouteId)
      });
      this.tryAutoParse();
      wx.showToast({
        title: '\u83b7\u53d6\u89e3\u6790\u914d\u7f6e\u5931\u8d25\uff0c\u5df2\u5207\u6362\u9ed8\u8ba4\u7ebf\u8def',
        icon: 'none'
      });
    }
  },

  buildRouteOptions(config) {
    if (!config) {
      return FALLBACK_ROUTE_OPTIONS;
    }

    const preferredKeys = ['slave_addr', 'slave_addr2', 'backup_addr', 'backup_addr2'];
    const options = FALLBACK_ROUTE_OPTIONS.map((item) => ({ ...item }));
    const seen = new Set();

    FALLBACK_ROUTE_OPTIONS.forEach((item) => {
      if (item.baseUrl) {
        seen.add(item.baseUrl);
      }
    });

    preferredKeys.forEach((key, index) => {
      const value = config[key];
      if (typeof value === 'string' && /^https?:\/\//.test(value) && !seen.has(value)) {
        options.push({
          id: key,
          label: index === 0 ? '主线路' : `备用线路 ${index}`,
          baseUrl: value
        });
        seen.add(value);
      }
    });

    Object.entries(config).forEach(([key, value]) => {
      if (
        typeof value === 'string'
        && /^https?:\/\//.test(value)
        && /(addr|route|line|backup|api)/i.test(key)
        && !seen.has(value)
      ) {
        options.push({
          id: key,
          label: `线路 ${options.length + 1}`,
          baseUrl: value
        });
        seen.add(value);
      }
    });

    if (!options.length) {
      options.push({
        id: 'default',
        label: '主线路',
        baseUrl: config.slave_addr || ''
      });
    }

    return options;
  },

  prepareRouteOptions(routeOptions) {
    return rankRouteOptions(routeOptions.map(({ id, label, baseUrl }) => ({ id, label, baseUrl })));
  },

  refreshRouteOptions(selectedRouteId = this.data.selectedRouteId) {
    const routeOptions = this.prepareRouteOptions(this.data.routeOptions);
    const nextSelectedId = routeOptions.some((item) => item.id === selectedRouteId)
      ? selectedRouteId
      : (routeOptions[0]?.id || 'default');

    this.setData({
      routeOptions,
      selectedRouteId: nextSelectedId,
      routeRecommendation: buildRouteRecommendation(routeOptions),
      analysisHighlights: buildAnalysisHighlights(this.data.analysis, routeOptions, nextSelectedId)
    });
  },

  tryAutoParse() {
    if (!this.data.shouldAutoParse || this.data.autoParseStarted) {
      return;
    }

    const inputUrl = String(this.data.inputUrl || '').trim();
    if (!inputUrl) {
      return;
    }

    this.setData({ autoParseStarted: true }, () => {
      this.runSingleParse();
    });
  },

  onInputUrl(e) {
    this.setData({ inputUrl: e.detail.value }, () => this.refreshAnalysis());
  },

  onClear() {
    this.setData({
      inputUrl: '',
      detectedLinks: [],
      selectedLinkIndex: 0,
      analysis: null,
      analysisHighlights: [],
      smartHint: '支持分享文案、短链和混合文本，先粘贴内容再做识别。',
      parseState: 'idle',
      parseMessage: '等待输入分享内容',
      failureReason: '',
      progressSteps: buildInitialSteps(),
      routeAttempts: [],
      batchSummary: buildInitialBatchSummary()
    });
  },

  onParseCurrent() {
    this.runSingleParse();
  },

  onParseAllDetected() {
    this.runBatchParse();
  },

  copyDetectedLinks() {
    const links = this.data.analysis?.supportedLinks || [];
    if (!links.length) {
      wx.showToast({ title: '暂无可复制链接', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: links.join('\n'),
      success: () => {
        wx.showToast({ title: '已复制可解析链接', icon: 'success' });
      }
    });
  },

  copySelectedDetectedLink() {
    const links = this.data.analysis?.supportedLinks || [];
    const currentLink = links[this.data.selectedLinkIndex] || links[0];
    if (!currentLink) {
      wx.showToast({ title: '暂无当前链接', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: currentLink,
      success: () => {
        wx.showToast({ title: '已复制当前链接', icon: 'success' });
      }
    });
  },

  onPasteAndParse() {
    this.fillInputFromClipboard(true);
  },

  fillInputFromClipboard(shouldParse = false) {
    wx.getClipboardData({
      success: (res) => {
        const clipboardText = String(res.data || '').trim();
        if (!clipboardText) {
          wx.showToast({
            title: '剪贴板为空',
            icon: 'none'
          });
          return;
        }

        this.setData({ inputUrl: clipboardText }, async () => {
          this.refreshAnalysis();
          if (shouldParse) {
            await this.runSingleParse();
          }
        });
      },
      fail: () => {
        wx.showToast({
          title: '读取剪贴板失败',
          icon: 'none'
        });
      }
    });
  },

  selectRoute(e) {
    const { routeId } = e.currentTarget.dataset;
    if (!routeId) return;
    this.setData({
      selectedRouteId: routeId,
      analysisHighlights: buildAnalysisHighlights(this.data.analysis, this.data.routeOptions, routeId)
    });
  },

  selectDetectedLink(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({ selectedLinkIndex: Number(index || 0) });
  },

  retryParse() {
    this.runSingleParse();
  },

  refreshAnalysis() {
    const analysis = this.analyzeInput(this.data.inputUrl);
    const nextSelectedIndex = Math.min(
      this.data.selectedLinkIndex,
      Math.max(analysis.supportedLinks.length - 1, 0)
    );

    this.setData({
      analysis,
      detectedLinks: analysis.supportedLinks,
      selectedLinkIndex: nextSelectedIndex,
      analysisHighlights: buildAnalysisHighlights(analysis, this.data.routeOptions, this.data.selectedRouteId),
      smartHint: buildSmartHint(analysis)
    });
  },

  analyzeInput(text) {
    const rawText = String(text || '').trim();
    const allLinks = findUrls(rawText);
    const supportedLinks = extractSupportedLinks(rawText);
    const recognizedLinks = allLinks
      .map((url) => ({
        url,
        platform: detectPlatform(url)
      }))
      .filter((item) => !!item.platform);
    const unsupportedRecognizedLinks = recognizedLinks.filter((item) => !isParseSupportedPlatform(item.platform));
    const blockedByCompliance = COPYRIGHT_BLOCK_PATTERN.test(rawText);
    const platform = supportedLinks.length ? detectPlatform(supportedLinks[0]) : null;
    const recognizedPlatform = recognizedLinks[0]?.platform || null;
    const inputMode = !rawText
      ? 'empty'
      : (!allLinks.length ? 'plain-text' : (rawText === allLinks[0] && allLinks.length === 1 ? 'pure-link' : 'share-text'));

    return {
      rawText,
      inputMode,
      inputModeLabel: inputMode === 'pure-link'
        ? '纯链接'
        : inputMode === 'share-text'
          ? '分享文案'
          : inputMode === 'plain-text'
            ? '纯文本'
            : '空输入',
      linkCount: allLinks.length,
      unsupportedCount: Math.max(allLinks.length - supportedLinks.length, 0),
      cleanedText: supportedLinks.join('\n'),
      supportedLinkItems: supportedLinks.map((url) => ({
        url,
        platformLabel: getPlatformLabel(detectPlatform(url))
      })),
      platformSummary: buildPlatformSummary(supportedLinks),
      supportedLinks,
      supportedCount: supportedLinks.length,
      blockedByCompliance,
      platform,
      platformLabel: platform ? getPlatformLabel(platform) : (recognizedPlatform ? getPlatformLabel(recognizedPlatform) : '未识别'),
      recognizedPlatform,
      recognizedPlatformLabel: recognizedPlatform ? getPlatformLabel(recognizedPlatform) : '',
      unsupportedRecognizedCount: unsupportedRecognizedLinks.length
    };
  },

  setStepStatus(stepId, status) {
    const progressSteps = this.data.progressSteps.map((item) => (
      item.id === stepId ? { ...item, status } : item
    ));
    this.setData({ progressSteps });
  },

  setRouteAttemptStatus(routeId, status, detail) {
    const routeAttempts = this.data.routeAttempts.map((item) => (
      item.id === routeId
        ? {
            ...item,
            status,
            statusText: getRouteAttemptStatusLabel(status),
            detail: detail || item.detail
          }
        : item
    ));

    this.setData({ routeAttempts });
  },

  updateBatchSummary(patch) {
    this.setData({
      batchSummary: {
        ...this.data.batchSummary,
        ...patch
      }
    });
  },

  inferFailureReason(error) {
    const message = String(error?.message || error || '');

    if (/compliance/i.test(message)) {
      return '疑似版权内容，按合规策略已拦截';
    }

    if (/unsupported/i.test(message)) {
      return '当前输入里没有可解析的平台链接';
    }

    if (/config/i.test(message)) {
      return '解析配置尚未准备完成';
    }

    if (/empty result/i.test(message)) {
      return '接口返回成功，但没有拿到可用素材';
    }

    if (/network|timeout|request/i.test(message)) {
      return '网络请求失败，可尝试重试或切换线路';
    }

    return '解析失败，可尝试重试或切换线路';
  },

  inferRouteFailureDetail(error) {
    const message = String(error?.message || error || '');

    if (/empty result/i.test(message)) {
      return '返回为空';
    }

    if (/timeout/i.test(message)) {
      return '响应超时';
    }

    if (/config/i.test(message)) {
      return '线路未准备';
    }

    if (/network|request/i.test(message)) {
      return '网络失败';
    }

    return '请求失败';
  },

  buildRouteSequence(selectedRouteId) {
    const routeOptions = this.data.routeOptions.length ? this.data.routeOptions : DEFAULT_ROUTE_OPTIONS;
    const selectedRoute = routeOptions.find((item) => item.id === selectedRouteId) || routeOptions[0];
    const orderedRoutes = [];
    const seen = new Set();

    [selectedRoute].concat(routeOptions).forEach((item) => {
      if (!item || seen.has(item.id)) return;
      orderedRoutes.push(item);
      seen.add(item.id);
    });

    return orderedRoutes;
  },

  buildRouteAttempts(routeSequence) {
    return routeSequence.map((route, index) => ({
      id: route.id,
      label: route.label,
      orderText: `${index + 1}/${routeSequence.length}`,
      status: 'idle',
      statusText: getRouteAttemptStatusLabel('idle'),
      detail: index === 0 ? '起始线路' : '失败后自动接替'
    }));
  },

  buildRequestMessage(route, batchContext, routeIndex, routeCount) {
    const batchPrefix = batchContext
      ? `批量 ${batchContext.index}/${batchContext.total} · `
      : '';

    return `${batchPrefix}正在通过${route?.label || '主线路'}请求解析（${routeIndex}/${routeCount}）...`;
  },

  getSelectedTargetUrl(analysis) {
    return analysis.supportedLinks[this.data.selectedLinkIndex] || analysis.supportedLinks[0] || '';
  },

  async runSingleParse() {
    const analysis = this.analyzeInput(this.data.inputUrl);
    this.setData({
      analysis,
      detectedLinks: analysis.supportedLinks,
      analysisHighlights: buildAnalysisHighlights(analysis, this.data.routeOptions, this.data.selectedRouteId),
      smartHint: buildSmartHint(analysis),
      batchSummary: buildInitialBatchSummary()
    });

    const targetUrl = this.getSelectedTargetUrl(analysis);
    await this.executeParseTask({
      analysis,
      targetUrl,
      navigateOnSuccess: true
    });
  },

  async runBatchParse() {
    const analysis = this.analyzeInput(this.data.inputUrl);
    this.setData({
      analysis,
      detectedLinks: analysis.supportedLinks,
      selectedLinkIndex: 0,
      analysisHighlights: buildAnalysisHighlights(analysis, this.data.routeOptions, this.data.selectedRouteId),
      smartHint: buildSmartHint(analysis)
    });

    if (!analysis.supportedCount) {
      wx.showToast({
        title: '当前没有可批量的链接',
        icon: 'none'
      });
      return;
    }

    if (analysis.supportedCount === 1) {
      await this.runSingleParse();
      return;
    }

    const total = analysis.supportedLinks.length;
    let successCount = 0;
    let failedCount = 0;

    this.setData({
      parseState: 'running',
      parseMessage: `准备批量解析 ${total} 条链接`,
      failureReason: '',
      progressSteps: buildInitialSteps(),
      routeAttempts: [],
      batchSummary: {
        active: true,
        total,
        completed: 0,
        success: 0,
        failed: 0,
        currentText: '准备开始'
      }
    });

    for (let index = 0; index < total; index++) {
      const targetUrl = analysis.supportedLinks[index];
      this.updateBatchSummary({
        currentText: `正在处理第 ${index + 1}/${total} 条`,
        completed: index,
        success: successCount,
        failed: failedCount
      });

      const outcome = await this.executeParseTask({
        analysis,
        targetUrl,
        navigateOnSuccess: false,
        batchContext: {
          index: index + 1,
          total
        }
      });

      if (outcome.resultData) {
        successCount += 1;
      } else {
        failedCount += 1;
      }

      this.updateBatchSummary({
        completed: index + 1,
        success: successCount,
        failed: failedCount,
        currentText: outcome.resultData
          ? `第 ${index + 1}/${total} 条已完成`
          : `第 ${index + 1}/${total} 条失败`
      });
    }

    const finalState = successCount > 0 ? 'success' : 'failed';
    const finalMessage = `批量完成，成功 ${successCount} 条，失败 ${failedCount} 条`;

    this.setData({
      parseState: finalState,
      parseMessage: finalMessage,
      failureReason: successCount === 0 && failedCount > 0
        ? '全部任务均未完成，可切换线路或稍后重试'
        : '',
      batchSummary: {
        active: false,
        total,
        completed: total,
        success: successCount,
        failed: failedCount,
        currentText: '批量已完成'
      }
    });

    wx.showModal({
      title: '批量解析完成',
      content: `成功 ${successCount} 条，失败 ${failedCount} 条。任务和结果已写入记录页。`,
      confirmText: '查看任务',
      cancelText: '留在当前页',
      success: (res) => {
        if (res.confirm) {
          this.goToTaskCenter();
        }
      }
    });
  },

  async executeParseTask({ analysis, targetUrl, navigateOnSuccess = false, batchContext = null }) {
    const routeSequence = this.buildRouteSequence(this.data.selectedRouteId);
    const platform = targetUrl ? detectPlatform(targetUrl) : analysis.platform;
    const platformLabel = platform ? getPlatformLabel(platform) : analysis.platformLabel;
    const task = saveParseTask({
      id: buildId('parse'),
      title: buildTaskTitle(analysis, targetUrl, batchContext),
      rawInput: analysis.rawText,
      url: targetUrl,
      platform,
      platformLabel,
      status: 'running',
      typeLabel: batchContext ? `批量 ${batchContext.index}/${batchContext.total}` : '解析中'
    });

    this.setData({
      parseState: 'running',
      parseMessage: batchContext
        ? `正在处理第 ${batchContext.index}/${batchContext.total} 条链接...`
        : '正在分析输入内容...',
      failureReason: '',
      progressSteps: buildInitialSteps(),
      routeAttempts: this.buildRouteAttempts(routeSequence)
    });

    try {
      if (!analysis.rawText) {
        throw new Error('unsupported: empty input');
      }

      this.setStepStatus('detect', 'done');

      if (analysis.blockedByCompliance) {
        throw new Error('compliance blocked');
      }

      if (!targetUrl || !platform) {
        throw new Error('unsupported platform');
      }

      this.setStepStatus('validate', 'done');
      this.setStepStatus('request', 'running');

      const { apiData, route } = await this.requestParseAcrossRoutes(targetUrl, routeSequence, batchContext);
      this.setStepStatus('request', 'done');
      this.setStepStatus('result', 'running');
      this.setData({
        parseMessage: batchContext
          ? `第 ${batchContext.index}/${batchContext.total} 条正在整理结果信息...`
          : '正在整理结果信息...'
      });

      const resultData = this.buildResultData(platform, apiData, targetUrl, analysis, route, task.id);
      if (!resultData) {
        throw new Error('empty result');
      }

      this.incrementVideoParseCount();
      this.setStepStatus('result', 'done');
      this.setData({
        parseState: 'success',
        parseMessage: navigateOnSuccess
          ? '解析完成，正在进入结果页'
          : '解析完成，已归档到记录页'
      });

      const successTask = saveParseTask({
        ...task,
        status: 'success',
        title: resultData.title,
        url: resultData.meta.sourceUrl,
        platform,
        platformLabel: resultData.meta.platformLabel,
        routeLabel: resultData.meta.routeLabel,
        typeLabel: resultData.meta.typeLabel
      });

      saveParseTaskResult(successTask.id, resultData);
      this.refreshRouteOptions(route.id);

      if (navigateOnSuccess) {
        wx.navigateTo({
          url: `/pages/video/video?data=${encodeURIComponent(JSON.stringify(resultData))}`
        });
      }

      return {
        task: successTask,
        resultData
      };
    } catch (error) {
      const failureReason = this.inferFailureReason(error);

      this.setData({
        parseState: 'failed',
        parseMessage: batchContext
          ? `第 ${batchContext.index}/${batchContext.total} 条解析未完成`
          : '解析未完成',
        failureReason
      });

      const requestFailed = this.data.progressSteps.some((item) => item.id === 'request' && item.status === 'running');
      const failedStepId = requestFailed ? 'request' : 'validate';
      this.setStepStatus(failedStepId, 'failed');

      const failedTask = saveParseTask({
        ...task,
        status: 'failed',
        errorReason: failureReason,
        url: targetUrl || '',
        routeLabel: error?.routeLabel || (routeSequence[0]?.label || '主线路'),
        routeTrail: this.data.routeAttempts
      });
      this.refreshRouteOptions(this.data.selectedRouteId);

      if (!batchContext) {
        wx.navigateTo({
          url: `/pages/parse-fail/parse-fail?reason=${encodeURIComponent(failureReason)}`
        });
      }

      return {
        task: failedTask,
        error
      };
    }
  },

  async requestParseAcrossRoutes(url, routeSequence, batchContext = null) {
    let lastError = null;

    for (let index = 0; index < routeSequence.length; index++) {
      const route = routeSequence[index];

      if (!route?.baseUrl) {
        lastError = new Error('config missing');
        lastError.routeLabel = route?.label || '主线路';
        recordRouteResult(route, 'failed');
        this.setRouteAttemptStatus(route.id, 'failed', '线路未准备');
        continue;
      }

      this.setRouteAttemptStatus(route.id, 'running', `第 ${index + 1}/${routeSequence.length} 条线路尝试中`);
      this.setData({
        parseMessage: this.buildRequestMessage(route, batchContext, index + 1, routeSequence.length)
      });

      try {
        const apiData = await this.requestParse(url, route, 1);
        recordRouteResult(route, 'success');
        this.setRouteAttemptStatus(route.id, 'success', '已返回有效结果');

        routeSequence.forEach((item) => {
          if (item.id !== route.id) {
            this.setRouteAttemptStatus(
              item.id,
              this.data.routeAttempts.find((attempt) => attempt.id === item.id)?.status || 'idle',
              this.data.routeAttempts.find((attempt) => attempt.id === item.id)?.status === 'idle'
                ? '未使用'
                : this.data.routeAttempts.find((attempt) => attempt.id === item.id)?.detail
            );
          }
        });

        return { apiData, route };
      } catch (error) {
        lastError = error;
        lastError.routeLabel = route.label;
        recordRouteResult(route, 'failed');
        this.setRouteAttemptStatus(route.id, 'failed', this.inferRouteFailureDetail(error));
      }
    }

    throw lastError || new Error('network failed');
  },

  async requestParse(url, route, retries = 2) {
    const { data_field, code_field, code_num } = this.data.config || FALLBACK_PARSE_CONFIG;
    let lastError = null;
    let requestUrl = url;

    if (/xhslink\.com/i.test(url) && route?.baseUrl) {
      try {
        const origin = getBaseOrigin(route.baseUrl);
        if (origin) {
          const resolveResponse = await request({
            url: `${origin}/api/xiaohongshu/web/get_note_id?url=${encodeURIComponent(url)}`,
            method: 'GET'
          });
          const resolvedUrl = resolveResponse.data?.data?.resolved_url;
          if (resolvedUrl) {
            requestUrl = resolvedUrl;
          }
        }
      } catch (error) {
        // Keep original short link as fallback.
      }
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await request({
          url: `${route.baseUrl}${encodeURIComponent(requestUrl)}`,
          method: 'GET'
        });

        const apiData = response.data?.[data_field];
        const apiCode = String(response.data?.[code_field]);

        if (apiData && apiCode === String(code_num)) {
          return apiData;
        }

        throw new Error(response.data?.msg || 'network empty result');
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('network failed');
  },

  buildResultData(platform, data, sourceUrl, analysis, route, taskId) {
    const awemeType = data.aweme_type;
    const typeMap = {
      0: 'video',
      2: 'image',
      4: 'video',
      51: 'video',
      55: 'video',
      58: 'video',
      61: 'video',
      68: 'image',
      150: 'image'
    };

    const contentType = data.type || typeMap[awemeType] || (data.images || data.image_post_info || data.image_data ? 'image' : 'video');
    const now = new Date();
    const meta = {
      taskId,
      parsedAt: now.toISOString(),
      cacheUntil: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      platform,
      platformLabel: getPlatformLabel(platform),
      routeId: route?.id || 'default',
      routeLabel: route?.label || '主线路',
      inputModeLabel: analysis.inputModeLabel,
      sourceUrl,
      typeLabel: contentType === 'video' ? '无水印视频' : '无损图集',
      complianceNote: '仅用于个人学习与备份，禁止商用侵权'
    };

    if (contentType === 'video') {
      if (platform === 'douyin') {
        const downurl = extractDouyinNoWatermarkUrl(data);
        return {
          title: data.desc || data.title || '未命名视频',
          photo: extractVideoCover(data),
          videourl: sourceUrl,
          downurl,
          meta
        };
      }

      const genericVideoUrl = extractVideoUrl(data);

      return {
        title: data.desc || data.title || '未命名视频',
        photo: extractVideoCover(data),
        videourl: sourceUrl,
        downurl: genericVideoUrl,
        meta
      };
    }

    const pics = extractImageList(data);

    if (!pics.length) {
      return null;
    }

    return {
      title: data.desc || data.title || '未命名图集',
      photo: extractVideoCover(data) || pics[0],
      pics,
      meta
    };
  },

  incrementVideoParseCount() {
    const stats = getWatermarkStats();
    stats.videoParses += 1;
    setWatermarkStats(stats);
  },

  goToImageEraser() {
    wx.navigateTo({ url: '/pages/ai/eraser/eraser' });
  },

  goToTaskCenter() {
    storage.set('recordActiveTabPreference', 'task');
    wx.switchTab({ url: '/pages/kj/kj' });
  },

  onShareAppMessage() {
    return {
      title: '短视频无痕修复工具箱',
      path: '/pages/ai/video-parse/video-parse'
    };
  }
});
