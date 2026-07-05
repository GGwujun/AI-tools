/**
 * Skill 内自用的解析逻辑
 * 简化版 parse-runner，独立分包不能 import 主包
 * 核心功能：调 /ymq/ 拿配置 → 调 crawler-api 解析 → 提取结果
 */

var api = require('./config');
var parseLink = require('./parse-link');

var FALLBACK_CONFIG = {
  slave_addr: api.parseSlaveAddr,
  slave_addr2: api.parseSlaveAddr2,
  data_field: 'data',
  code_field: 'code',
  code_num: '200'
};

function wxRequest(options) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: options.url,
      method: options.method || 'GET',
      data: options.data,
      header: options.header,
      success: resolve,
      fail: reject
    });
  });
}

function getBaseOrigin(baseUrl) {
  var match = String(baseUrl || '').match(/^https?:\/\/[^/]+/i);
  return match ? match[0] : '';
}

function fetchConfig() {
  return wxRequest({ url: api.ymq, method: 'GET' }).then(function (res) {
    var serverData = res.data && res.data.data ? res.data.data : {};
    var config = {};
    for (var k in FALLBACK_CONFIG) config[k] = FALLBACK_CONFIG[k];
    for (var k in serverData) config[k] = serverData[k];
    return config;
  }).catch(function () {
    var config = {};
    for (var k in FALLBACK_CONFIG) config[k] = FALLBACK_CONFIG[k];
    return config;
  });
}

function extractVideoCover(data) {
  return data.video && data.video.cover && data.video.cover.url_list && data.video.cover.url_list[0]
    || data.cover_data && data.cover_data.cover && data.cover_data.cover.url_list && data.cover_data.cover.url_list[0]
    || data.cover_data && data.cover_data.origin_cover && data.cover_data.origin_cover.url_list && data.cover_data.origin_cover.url_list[0]
    || data.cover
    || data.cover_url
    || data.pic
    || data.thumbnail
    || data.images && data.images[0] && data.images[0].url_list && data.images[0].url_list[0]
    || '';
}

function extractVideoUrl(data) {
  return data.video_data && data.video_data.nwm_video_url_HQ
    || data.video_data && data.video_data.nwm_video_url
    || data.video_data && data.video_data.wm_video_url_HQ
    || data.video_data && data.video_data.wm_video_url
    || data.video_urls && data.video_urls[0]
    || data.video && data.video.bit_rate && data.video.bit_rate[0] && data.video.bit_rate[0].play_addr && data.video.bit_rate[0].play_addr.url_list && data.video.bit_rate[0].play_addr.url_list[0]
    || data.video && data.video.play_addr && data.video.play_addr.url_list && data.video.play_addr.url_list[0]
    || data.video_url
    || data.play_url
    || data.download_url
    || data.url
    || '';
}

function extractDouyinNoWatermark(data) {
  var playAddr = data.video && data.video.play_addr && data.video.play_addr.url_list && data.video.play_addr.url_list[0];
  if (playAddr) return playAddr.replace('playwm', 'play');
  return extractVideoUrl(data);
}

function extractImageList(data) {
  var crawlerImages = (data.image_data && data.image_data.no_watermark_image_list || []).filter(Boolean);
  var commonImages = (data.images || []).map(function (img) {
    return img.url_list && img.url_list[0] || img.url || img;
  }).filter(Boolean);

  if (crawlerImages.length) return crawlerImages;
  return commonImages;
}

function buildResult(platform, data, sourceUrl) {
  var awemeType = data.aweme_type;
  var typeMap = { 0: 'video', 2: 'image', 4: 'video', 68: 'image', 150: 'image' };
  var contentType = data.type
    || typeMap[awemeType]
    || (data.images || data.image_data ? 'image' : 'video');

  if (contentType === 'video') {
    var downurl = platform === 'douyin' ? extractDouyinNoWatermark(data) : extractVideoUrl(data);
    return {
      type: 'video',
      title: data.desc || data.title || '未命名视频',
      cover: extractVideoCover(data),
      videoUrl: downurl,
      sourceUrl: sourceUrl,
      platform: platform,
      platformLabel: parseLink.getPlatformLabel(platform)
    };
  }

  var pics = extractImageList(data);
  if (!pics.length) return null;

  return {
    type: 'image',
    title: data.desc || data.title || '未命名图集',
    cover: extractVideoCover(data) || pics[0],
    images: pics,
    imageCount: pics.length,
    sourceUrl: sourceUrl,
    platform: platform,
    platformLabel: parseLink.getPlatformLabel(platform)
  };
}

function requestParse(url, baseUrl, config, retries) {
  retries = retries || 2;
  var lastError = null;

  for (var attempt = 0; attempt <= retries; attempt++) {
    try {
      var response = wxRequest({
        url: baseUrl + encodeURIComponent(url),
        method: 'GET'
      });
      // wxRequest returns promise, need to handle sync loop differently
      // Actually we need async loop - let me restructure
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
    }
  }
}

/**
 * 解析视频链接，返回结构化结果
 * @param {string} input 用户输入（分享文案/短链/混合文本）
 * @returns {Promise<object>} 解析结果
 */
function parseVideo(input) {
  var rawText = String(input || '').trim();
  if (!rawText) {
    return Promise.reject(new Error('输入为空'));
  }

  var links = parseLink.extractSupportedLinks(rawText);
  if (!links.length) {
    return Promise.reject(new Error('未找到支持的平台链接'));
  }

  var targetUrl = links[0];
  var platform = parseLink.detectPlatform(targetUrl);
  if (!platform) {
    return Promise.reject(new Error('无法识别平台'));
  }

  return fetchConfig().then(function (config) {
    var routes = [];
    if (config.slave_addr) routes.push({ id: 'main', baseUrl: config.slave_addr, label: '主线路' });
    if (config.slave_addr2) routes.push({ id: 'backup', baseUrl: config.slave_addr2, label: '备用线路' });
    if (!routes.length) routes.push({ id: 'default', baseUrl: config.slave_addr || api.parseSlaveAddr, label: '主线路' });

    // 逐线路尝试
    var chain = Promise.reject(new Error('no routes'));
    routes.forEach(function (route) {
      chain = chain.catch(function () {
        return tryParse(targetUrl, route, config);
      });
    });

    return chain.then(function (apiData) {
      var result = buildResult(platform, apiData, targetUrl);
      if (!result) throw new Error('解析成功但无可用素材');
      return result;
    });
  });
}

function tryParse(url, route, config) {
  return wxRequest({
    url: route.baseUrl + encodeURIComponent(url),
    method: 'GET'
  }).then(function (response) {
    var data = response.data;
    var apiData = data && data[config.code_field || 'code'];
    var apiCode = String(apiData);
    var payload = data && data[config.data_field || 'data'];

    if (payload && apiCode === String(config.code_num || '200')) {
      return payload;
    }
    throw new Error(data && data.msg || '解析返回为空');
  });
}

module.exports = {
  parseVideo: parseVideo,
  fetchConfig: fetchConfig
};
