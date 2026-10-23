// 一键出稿：ASR 口播稿识别 → AI 改写 → 标题+正文+话题标签
// 前端串联两个现成后端端点（/api/tools/process tool=asr + /api/ai/chat/completions），
// 传分享链接让后端现解析直链，避开 x-expires 过期。
const api = require('../../../config/api');
const storage = require('../../../utils/safe-storage');
const { track } = require('../../../utils/track');
const { extractSupportedLinks } = require('../../../utils/parse-link');

const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const AI_MODEL = 'glm-4-flash';
const TRANSCRIPT_MAX = 8000;
const HISTORY_KEY = 'aiDraftHistory';

// 源视频平台 → 目标文案平台（不在表内的源平台兜底抖音）
const SOURCE_TO_TARGET = {
  douyin: 'douyin',
  xiaohongshu: 'xiaohongshu',
  weibo: 'weibo'
};

const DRAFT_PLATFORMS = {
  douyin: {
    id: 'douyin',
    name: '抖音',
    icon: '🎵',
    rewrite: '写成抖音短视频文案：开头一句话制造悬念或冲突，节奏紧凑，结尾引导互动（点赞/评论），正文不超过 150 字，适合口播。'
  },
  xiaohongshu: {
    id: 'xiaohongshu',
    name: '小红书',
    icon: '📕',
    rewrite: '写成小红书笔记：标题有吸引力、可用少量 emoji；正文分 2-4 个小段，真实有代入感；结尾给一句总结或建议；标签贴合小红书热门话题。'
  },
  moments: {
    id: 'moments',
    name: '朋友圈',
    icon: '📱',
    rewrite: '写成朋友圈动态：30-80 字，像真人随手发的真实感受，可用 1-2 个 emoji，不要营销腔，话题标签最多 3 个。'
  },
  weibo: {
    id: 'weibo',
    name: '微博',
    icon: '🌐',
    rewrite: '写成微博：观点鲜明、语言利落，正文 100 字左右，容易引发转发讨论，可以带一点态度。'
  }
};

const STYLE_CONFIG = {
  funny: { id: 'funny', name: '幽默风趣', emoji: '😄', modifier: '加入幽默搞笑元素' },
  emotional: { id: 'emotional', name: '情感共鸣', emoji: '❤️', modifier: '加入情感元素，引发共鸣' },
  professional: { id: 'professional', name: '专业严谨', emoji: '📚', modifier: '保持专业严谨的风格' },
  casual: { id: 'casual', name: '轻松随意', emoji: '☀️', modifier: '像朋友聊天一样轻松自然' }
};

function decodeParam(value) {
  try {
    return value ? decodeURIComponent(value) : '';
  } catch (e) {
    return value || '';
  }
}

Page({
  data: {
    phase: 'input',            // input / running / result / ai-failed
    runStage: '',              // running 内部分段：asr / ai
    elapsed: 0,
    hasSourceParam: false,
    sourceUrl: '',
    linkInput: '',
    title: '',
    transcript: '',
    transcriptTruncated: false,
    showTranscript: false,
    platforms: Object.values(DRAFT_PLATFORMS),
    styles: Object.values(STYLE_CONFIG),
    selectedPlatform: 'douyin',
    selectedStyle: 'casual',
    asrError: '',
    aiError: '',
    canSkipAsr: false,
    resultTitle: '',
    resultContent: '',
    resultTags: [],
    history: [],
    adUnitId: ''
  },

  onLoad(options) {
    const { adUnitId } = api;
    const update = { adUnitId };

    if (options && options.url) {
      const url = decodeParam(options.url).trim();
      const platform = decodeParam(options.platform);
      update.sourceUrl = url;
      update.title = decodeParam(options.title).trim().slice(0, 500);
      update.selectedPlatform = SOURCE_TO_TARGET[platform] || 'douyin';
      update.hasSourceParam = !!url;
    }

    this.setData(update);
    this.loadHistory();
  },

  onUnload() {
    this.stopElapsed();
  },

  onShareAppMessage() {
    return {
      title: '一键出稿：视频口播直接改成原创文案',
      path: '/pages/ai/draft/draft'
    };
  },

  // ============ 输入态 ============

  onLinkInput(e) {
    this.setData({ linkInput: e.detail.value });
  },

  onPasteTap() {
    wx.getClipboardData({
      success: (res) => {
        const links = extractSupportedLinks(res.data || '');
        if (links.length) {
          this.setData({ linkInput: links[0] });
        } else {
          wx.showToast({ title: '剪贴板里没有可用的视频链接', icon: 'none' });
        }
      }
    });
  },

  selectPlatform(e) {
    this.setData({ selectedPlatform: e.currentTarget.dataset.id });
  },

  selectStyle(e) {
    this.setData({ selectedStyle: e.currentTarget.dataset.id });
  },

  // ============ 流水线 ============

  startPipeline() {
    let url = '';
    if (this.data.hasSourceParam) {
      url = this.data.sourceUrl;
    } else {
      const links = extractSupportedLinks(this.data.linkInput);
      if (!links.length) {
        wx.showToast({ title: '请粘贴抖音/快手/B站等视频分享链接', icon: 'none' });
        return;
      }
      url = links[0];
      this.setData({ sourceUrl: url });
    }
    if (!url) {
      wx.showToast({ title: '缺少来源链接', icon: 'none' });
      return;
    }
    this.runWithAdGate(() => this.runAsrStage());
  },

  // 与单条解析/视频工具页共享 12 小时广告冷却
  runWithAdGate(callback) {
    const { adUnitId } = this.data;
    const hasWatchedAd = !!storage.get('hasWatchedAd');
    const adWatchedTimestamp = storage.get('adWatchedTimestamp');
    const inCooldown = hasWatchedAd && adWatchedTimestamp
      && (Date.now() - adWatchedTimestamp) < TWELVE_HOURS;

    if (!adUnitId || inCooldown) {
      callback();
      return;
    }

    wx.showModal({
      title: '提示',
      content: '观看一段广告，即可使用本工具',
      success: (res) => {
        if (res.confirm) this.watchAd(callback);
      }
    });
  },

  watchAd(callback) {
    wx.showLoading({ title: '加载广告中...' });

    if (!wx.createRewardedVideoAd) {
      wx.hideLoading();
      callback();
      return;
    }

    const videoAd = wx.createRewardedVideoAd({ adUnitId: this.data.adUnitId });

    videoAd.onError(() => {
      wx.hideLoading();
      wx.showToast({ title: '广告拉取失败，请稍后重试', icon: 'none' });
    });

    videoAd.show()
      .then(() => wx.hideLoading())
      .catch(() => {
        videoAd.load()
          .then(() => { wx.hideLoading(); videoAd.show(); })
          .catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '广告加载失败，请稍后重试', icon: 'none' });
          });
      });

    videoAd.onClose((status) => {
      if (status && status.isEnded) {
        storage.set('hasWatchedAd', true);
        storage.set('adWatchedTimestamp', Date.now());
        callback();
      } else {
        wx.showToast({ title: '观看完整广告才能继续', icon: 'none' });
      }
    });
  },

  // 阶段一：ASR 口播稿识别
  runAsrStage() {
    this.setData({
      phase: 'running',
      runStage: 'asr',
      elapsed: 0,
      asrError: '',
      aiError: '',
      canSkipAsr: false,
      transcript: '',
      resultTitle: '',
      resultContent: '',
      resultTags: []
    });
    this.startElapsed();

    wx.request({
      url: api.toolsProcessApi,
      method: 'POST',
      timeout: 600000,
      header: { 'Content-Type': 'application/json' },
      data: { tool: 'asr', url: this.data.sourceUrl.trim(), params: {} },
      success: (res) => {
        const payload = res.data || {};
        if (res.statusCode === 200 && payload.code === 200 && payload.data) {
          const text = (payload.data.text || '').trim();
          if (!text) {
            // 防御：后端正常会 400，这里兜住空文本
            this.stopElapsed();
            this.setData({ phase: 'input', asrError: '未能识别出文字内容', canSkipAsr: !!this.data.title });
            return;
          }
          const truncated = text.length > TRANSCRIPT_MAX;
          this.setData({
            transcript: truncated ? text.slice(0, TRANSCRIPT_MAX) : text,
            transcriptTruncated: truncated
          });
          // 计时继续，无缝进入 AI 阶段（runAiStage 的 complete 里统一 stop）
          this.runAiStage();
        } else {
          const detail = payload.detail || payload.message || `识别失败（${res.statusCode}）`;
          const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
          this.stopElapsed();
          this.setData({
            phase: 'input',
            asrError: msg,
            canSkipAsr: /没有音轨|未能识别出文字/.test(msg) && !!this.data.title
          });
        }
      },
      fail: (err) => {
        const message = /timeout/i.test(err.errMsg || '')
          ? '识别超时，视频可能太长，请稍后重试'
          : '网络异常，请稍后重试';
        this.stopElapsed();
        this.setData({ phase: 'input', asrError: message });
      }
    });
  },

  // 阶段二：AI 改写出稿
  runAiStage() {
    this.setData({ phase: 'running', runStage: 'ai', aiError: '' });

    wx.request({
      url: api.aiChatApi,
      method: 'POST',
      timeout: 120000,
      header: { 'Content-Type': 'application/json' },
      data: {
        model: AI_MODEL,
        messages: [
          { role: 'system', content: this.buildSystemPrompt() },
          { role: 'user', content: this.buildUserMessage() }
        ]
      },
      success: (res) => {
        const payload = res.data || {};
        if (res.statusCode === 200 && payload.choices && payload.choices[0]) {
          const content = payload.choices[0].message.content;
          if (content && content.trim()) {
            const parsed = this.parseDraftResponse(content);
            this.setData({
              phase: 'result',
              resultTitle: parsed.title,
              resultContent: parsed.content,
              resultTags: parsed.tags
            });
            this.saveToHistory();
          } else {
            this.setData({ phase: 'ai-failed', aiError: '生成结果为空，请换个风格重试' });
          }
        } else {
          const message = (payload.error && payload.error.message) || `生成失败（${res.statusCode}）`;
          this.setData({ phase: 'ai-failed', aiError: message });
        }
      },
      fail: (err) => {
        const message = /timeout/i.test(err.errMsg || '')
          ? '生成超时，请重试'
          : '网络异常，请稍后重试';
        this.setData({ phase: 'ai-failed', aiError: message });
      },
      complete: () => this.stopElapsed()
    });
  },

  buildSystemPrompt() {
    const platform = DRAFT_PLATFORMS[this.data.selectedPlatform] || DRAFT_PLATFORMS.douyin;
    const style = STYLE_CONFIG[this.data.selectedStyle] || STYLE_CONFIG.casual;
    return `你是一位短视频二次创作文案专家。用户会提供一条视频的「原文案」（发布时配的标题/描述）和「口播稿」（视频里说的话），请把它改写成一篇可以直接发布的新文案。

【目标平台：${platform.name}】
${platform.rewrite}

【文案风格】
按「${style.name}」风格改写：${style.modifier}

【改写原则】
1. 这是二次创作发布场景：保留原意和所有关键信息点，重新组织语言，禁止照抄原句
2. 与原文任何连续重复不要超过 8 个字
3. 正文口语化、有信息量，不要空洞的套话
4. 不要捏造原文没有的信息

【输出格式（必须严格遵守，否则程序无法解析）】
第一行：以【标题】开头，后跟标题正文，标题不超过 25 个字
中间若干行：正文
最后：3-5 个话题标签，每个标签单独一行，以 # 开头（如 #美食探店）
除这三部分外不要输出任何其他内容：不要解释、不要序号说明、不要 markdown 格式符号

【特殊情况】
- 如果没有提供口播稿，只根据原文案改写
- 如果原文案为空，只根据口播稿改写，并自己拟一个标题
- 如果两者信息都很少，正文就写短一些，不要编造内容凑字数`;
  },

  buildUserMessage() {
    const { title, transcript } = this.data;
    return `【原文案】\n${(title || '').trim() || '（无）'}\n\n【口播稿】\n${(transcript || '').trim() || '（无，请仅根据原文案改写）'}`;
  },

  // 解析 AI 输出：【标题】首行 + 正文 + # 标签尾行
  parseDraftResponse(content) {
    const lines = content.split('\n').map((l) => l.trim());
    const tags = [];
    const bodyLines = [];
    let title = '';

    for (const line of lines) {
      if (!line) continue;
      if (line.startsWith('#')) {
        const extracted = line.match(/#[\w一-龥]+/g);
        if (extracted) tags.push(...extracted);
        continue;
      }
      bodyLines.push(line.replace(/\*\*|##/g, ''));
    }

    // 首行剥【标题】标记；无标记时短首行（≤25字且有正文）兜底认作标题
    if (bodyLines.length > 1) {
      const first = bodyLines[0];
      const markerMatch = first.match(/^【标题】\s*[:：]?\s*(.*)$/);
      if (markerMatch) {
        title = markerMatch[1].trim();
        bodyLines.shift();
      } else if (first.length <= 25) {
        title = first;
        bodyLines.shift();
      }
    }

    // 模型偶尔会模仿格式说明输出「正文」「【正文】」这类段名行，剔除
    while (bodyLines.length && /^【?(正文|标签|话题标签)】?\s*[:：]?$/.test(bodyLines[0])) {
      bodyLines.shift();
    }

    return { title, content: bodyLines.join('\n'), tags: tags.slice(0, 5) };
  },

  // ============ 失败出口 ============

  retryAsr() {
    // 重试不再过广告门槛
    this.runAsrStage();
  },

  skipAsrAndGenerate() {
    // 纯 BGM / 无音轨：仅用原文案生成
    this.setData({ transcript: '', transcriptTruncated: false, canSkipAsr: false, asrError: '' });
    this.runAiStage();
  },

  regenerate() {
    // 仅重跑 AI，不重跑 ASR、不再过广告
    if (!this.data.transcript && !this.data.title) {
      wx.showToast({ title: '缺少原文案，请重新识别', icon: 'none' });
      return;
    }
    this.runAiStage();
  },

  // ============ 结果操作 ============

  copyTitle() {
    if (!this.data.resultTitle) return;
    wx.setClipboardData({
      data: this.data.resultTitle,
      success: () => wx.showToast({ title: '标题已复制', icon: 'success' })
    });
  },

  copyContent() {
    if (!this.data.resultContent) return;
    wx.setClipboardData({
      data: this.data.resultContent,
      success: () => wx.showToast({ title: '正文已复制', icon: 'success' })
    });
  },

  copyTags() {
    if (!this.data.resultTags.length) return;
    wx.setClipboardData({
      data: this.data.resultTags.join(' '),
      success: () => wx.showToast({ title: '标签已复制', icon: 'success' })
    });
  },

  copyTranscript() {
    if (!this.data.transcript) return;
    wx.setClipboardData({
      data: this.data.transcript,
      success: () => wx.showToast({ title: '口播稿已复制', icon: 'success' })
    });
  },

  copyAll() {
    const { resultTitle, resultContent, resultTags } = this.data;
    const parts = [];
    if (resultTitle) parts.push(resultTitle);
    if (resultContent) parts.push(resultContent);
    if (resultTags.length) parts.push(resultTags.join(' '));
    if (!parts.length) return;
    wx.setClipboardData({
      data: parts.join('\n\n'),
      success: () => wx.showToast({ title: '已复制全部内容', icon: 'success' })
    });
  },

  toggleTranscript() {
    this.setData({ showTranscript: !this.data.showTranscript });
  },

  // ============ 历史 ============

  loadHistory() {
    const history = storage.get(HISTORY_KEY, []);
    this.setData({ history: history.slice(0, 10) });
  },

  onHistoryTap(e) {
    const item = this.data.history[e.currentTarget.dataset.index];
    if (!item) return;
    this.setData({
      phase: 'result',
      resultTitle: item.resultTitle,
      resultContent: item.resultContent,
      resultTags: item.resultTags || [],
      transcript: item.transcript || '',
      transcriptTruncated: false,
      showTranscript: false
    });
  },

  clearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空出稿历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync(HISTORY_KEY);
          this.setData({ history: [] });
        }
      }
    });
  },

  saveToHistory() {
    const history = storage.get(HISTORY_KEY, []);
    const platform = DRAFT_PLATFORMS[this.data.selectedPlatform] || DRAFT_PLATFORMS.douyin;
    history.unshift({
      id: Date.now(),
      resultTitle: this.data.resultTitle,
      resultContent: this.data.resultContent,
      resultTags: this.data.resultTags,
      transcript: this.data.transcript.slice(0, 2000),
      platformName: platform.name,
      sourceUrl: this.data.sourceUrl,
      createdAt: Date.now()
    });
    if (history.length > 20) history.length = 20;
    storage.set(HISTORY_KEY, history);
    this.setData({ history: history.slice(0, 10) });
    track('draft_done', { platform: this.data.selectedPlatform });
  },

  // ============ 计时 ============

  startElapsed() {
    this.stopElapsed();
    this.elapsedTimer = setInterval(() => {
      this.setData({ elapsed: this.data.elapsed + 1 });
    }, 1000);
  },

  stopElapsed() {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  }
});
