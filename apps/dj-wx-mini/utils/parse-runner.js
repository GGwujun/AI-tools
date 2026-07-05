const {
  detectPlatform,
  getPlatformLabel,
  isParseSupportedPlatform,
  extractSupportedLinks,
  findUrls
} = require('./parse-link');
const { rankRouteOptions, recordRouteResult } = require('./route-ranker');
const api = require('../config/api');

const FALLBACK_PARSE_CONFIG = {
  slave_addr: api.parseSlaveAddr,
  slave_addr2: api.parseSlaveAddr2,
  backup_addr: '',
  data_field: 'data',
  code_field: 'code',
  code_num: '200'
};

const FALLBACK_ROUTE_OPTIONS = [
  { id: 'default_fallback', label: '主线路', baseUrl: FALLBACK_PARSE_CONFIG.slave_addr },
  { id: 'backup_fallback', label: '备用线路 1', baseUrl: FALLBACK_PARSE_CONFIG.slave_addr2 }
];

const COPYRIGHT_BLOCK_PATTERN = /(电影|电视剧|综艺|动漫|新闻|赛事|直播回放|纪录片|番剧)/i;

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({ ...options, success: resolve, fail: reject });
  });
}

function getBaseOrigin(baseUrl) {
  const match = String(baseUrl || '').match(/^https?:\/\/[^/]+/i);
  return match ? match[0] : '';
}

function analyzeInput(text) {
  const rawText = String(text || '').trim();
  const allLinks = findUrls(rawText);
  const supportedLinks = extractSupportedLinks(rawText);
  const platform = supportedLinks.length ? detectPlatform(supportedLinks[0]) : null;
  const blockedByCompliance = COPYRIGHT_BLOCK_PATTERN.test(rawText);

  return {
    rawText,
    supportedLinks,
    supportedCount: supportedLinks.length,
    blockedByCompliance,
    platform,
    platformLabel: platform ? getPlatformLabel(platform) : '未识别'
  };
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
  const crawlerImages = (data.image_data?.no_watermark_image_list || []).filter(Boolean);
  const xhsImages = (data.image_post_info?.images || [])
    .map((image) => image?.display_image?.url_list?.[0] || image?.url)
    .filter(Boolean);
  const commonImages = (data.images || [])
    .map((image) => image?.url_list?.[0] || image?.url || image)
    .filter(Boolean);

  if (crawlerImages.length) return crawlerImages;
  return xhsImages.length ? xhsImages : commonImages;
}

function buildResultData(platform, data, sourceUrl, route) {
  const awemeType = data.aweme_type;
  const typeMap = {
    0: 'video', 2: 'image', 4: 'video', 51: 'video', 55: 'video',
    58: 'video', 61: 'video', 68: 'image', 150: 'image'
  };

  const contentType = data.type || typeMap[awemeType] || (data.images || data.image_post_info || data.image_data ? 'image' : 'video');
  const now = new Date();
  const meta = {
    parsedAt: now.toISOString(),
    cacheUntil: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    platform,
    platformLabel: getPlatformLabel(platform),
    routeId: route?.id || 'default',
    routeLabel: route?.label || '主线路',
    sourceUrl,
    typeLabel: contentType === 'video' ? '无水印视频' : '无损图集',
    complianceNote: '仅用于个人学习与备份，禁止商用侵权'
  };

  if (contentType === 'video') {
    const downurl = platform === 'douyin'
      ? extractDouyinNoWatermarkUrl(data)
      : extractVideoUrl(data);
    return {
      title: data.desc || data.title || '未命名视频',
      photo: extractVideoCover(data),
      videourl: sourceUrl,
      downurl,
      meta,
      extra: data.extra || {}
    };
  }

  const pics = extractImageList(data);
  if (!pics.length) return null;

  return {
    title: data.desc || data.title || '未命名图集',
    photo: extractVideoCover(data) || pics[0],
    pics,
    meta,
    extra: data.extra || {}
  };
}

function buildRouteOptions(config) {
  const baseConfig = { ...FALLBACK_PARSE_CONFIG, ...(config || {}) };
  const preferredKeys = ['slave_addr', 'slave_addr2', 'backup_addr', 'backup_addr2'];
  const options = [];
  const seen = new Set();

  FALLBACK_ROUTE_OPTIONS.forEach((item) => {
    if (item.baseUrl && !seen.has(item.baseUrl)) {
      options.push({ ...item });
      seen.add(item.baseUrl);
    }
  });

  preferredKeys.forEach((key, index) => {
    const value = baseConfig[key];
    if (typeof value === 'string' && /^https?:\/\//.test(value) && !seen.has(value)) {
      options.push({
        id: key,
        label: index === 0 ? '主线路' : `备用线路 ${index}`,
        baseUrl: value
      });
      seen.add(value);
    }
  });

  if (!options.length) {
    options.push({ id: 'default', label: '主线路', baseUrl: baseConfig.slave_addr || '' });
  }

  return rankRouteOptions(options);
}

async function fetchConfig() {
  try {
    const res = await request({ url: api.ymq, method: 'GET' });
    return { ...FALLBACK_PARSE_CONFIG, ...(res.data?.data || {}) };
  } catch (error) {
    return { ...FALLBACK_PARSE_CONFIG };
  }
}

function inferFailureReason(error) {
  const message = String(error?.message || error || '');
  if (/compliance/i.test(message)) return '疑似版权内容，按合规策略已拦截';
  if (/unsupported/i.test(message)) return '当前输入里没有可解析的平台链接';
  if (/config/i.test(message)) return '解析配置尚未准备完成';
  if (/empty result/i.test(message)) return '接口返回成功，但没有拿到可用素材';
  if (/network|timeout|request/i.test(message)) return '网络请求失败，可尝试重试或切换线路';
  return '解析失败，可尝试重试';
}

async function requestParse(url, route, config, retries = 2) {
  const { data_field, code_field, code_num } = config;
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
        if (resolvedUrl) requestUrl = resolvedUrl;
      }
    } catch (error) {
      // keep original short link
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
      if (apiData && apiCode === String(code_num)) return apiData;
      throw new Error(response.data?.msg || 'empty result');
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('network failed');
}

async function requestAcrossRoutes(url, routeSequence, config) {
  let lastError = null;

  for (let index = 0; index < routeSequence.length; index++) {
    const route = routeSequence[index];
    if (!route?.baseUrl) {
      lastError = new Error('config missing');
      lastError.routeLabel = route?.label || '主线路';
      recordRouteResult(route, 'failed');
      continue;
    }

    try {
      const apiData = await requestParse(url, route, config);
      recordRouteResult(route, 'success');
      return { apiData, route };
    } catch (error) {
      lastError = error;
      lastError.routeLabel = route.label;
      recordRouteResult(route, 'failed');
    }
  }

  throw lastError || new Error('network failed');
}

/**
 * 解析输入（分享文案/短链/混合文本），返回结果数据。
 * @param {string} input 用户输入
 * @param {object} [preloadedConfig] 可选，已拉取的 /ymq/ 配置；传入则不再单独请求 /ymq/
 * @returns {Promise<object>} resultData，结构与原 video-parse buildResultData 一致
 */
async function parseVideo(input, preloadedConfig) {
  const analysis = analyzeInput(input);

  if (!analysis.rawText) throw new Error('unsupported: empty input');
  if (analysis.blockedByCompliance) throw new Error('compliance blocked');

  const targetUrl = analysis.supportedLinks[0];
  const platform = analysis.platform;
  if (!targetUrl || !platform) throw new Error('unsupported platform');

  const config = preloadedConfig ? { ...FALLBACK_PARSE_CONFIG, ...preloadedConfig } : await fetchConfig();
  const routeSequence = buildRouteOptions(config);
  if (!routeSequence.length) throw new Error('config missing');

  const { apiData, route } = await requestAcrossRoutes(targetUrl, routeSequence, config);
  const resultData = buildResultData(platform, apiData, targetUrl, route);
  if (!resultData) throw new Error('empty result');

  return resultData;
}

module.exports = {
  parseVideo,
  fetchConfig,
  analyzeInput,
  inferFailureReason,
  FALLBACK_PARSE_CONFIG
};
