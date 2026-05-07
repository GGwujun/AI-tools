const URL_PATTERN = /https?:\/\/[^\s]+/ig;
const WRAPPER_CHARS = '(<[{【（「《『';
const TRAILING_CHARS = '.,;!?)]}>】）》〉、。，；！？';

function trimUrlCandidate(rawUrl) {
  let value = String(rawUrl || '').trim();

  while (value && WRAPPER_CHARS.includes(value[0])) value = value.slice(1);
  while (value && TRAILING_CHARS.includes(value[value.length - 1])) value = value.slice(0, -1);

  return value;
}

function uniqueList(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function normalizeUrl(url) {
  let value = String(url || '').trim();

  if (/^http:\/\/(xhslink\.com|www\.xiaohongshu\.com|xiaohongshu\.com|xiao?hongshu)/i.test(value)) {
    value = value.replace(/^http:\/\//i, 'https://');
  }

  return value;
}

function findUrls(text) {
  const matches = String(text || '').match(URL_PATTERN) || [];
  return uniqueList(matches.map(trimUrlCandidate).map(normalizeUrl));
}

function detectPlatform(url) {
  if (/v\.douyin\.com|douyin\.com|iesdouyin\.com/i.test(url)) return 'douyin';
  if (/kuaishou\.com|chenzhongtech\.com|gifshow\.com/i.test(url)) return 'kuaishou';
  if (/tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/i.test(url)) return 'tiktok';
  if (/xhslink\.com|xiaohongshu\.com|xiao?hongshu/i.test(url)) return 'xiaohongshu';
  if (/b23\.tv|bilibili\.com/i.test(url)) return 'bilibili';
  if (/weibo\.com|weibocdn\.com/i.test(url)) return 'weibo';
  if (/weixin\.qq\.com\/sph|channels\.weixin\.qq\.com/i.test(url)) return 'wechatChannel';
  if (/weishi\.qq\.com|video\.qq\.com/i.test(url)) return 'weishi';
  return null;
}

function getPlatformLabel(platform) {
  const map = {
    douyin: '抖音',
    kuaishou: '快手',
    tiktok: 'TikTok',
    xiaohongshu: '小红书',
    bilibili: 'B站',
    weibo: '微博',
    wechatChannel: '视频号',
    weishi: '微视'
  };
  return map[platform] || '未知平台';
}

function isParseSupportedPlatform(platform) {
  return ['douyin', 'kuaishou', 'tiktok', 'xiaohongshu', 'bilibili', 'weibo', 'weishi', 'wechatChannel'].includes(platform);
}

function extractSupportedLinks(text) {
  return findUrls(text).filter((url) => isParseSupportedPlatform(detectPlatform(url)));
}

function inferPlatformLabelFromUrl(url) {
  const platform = detectPlatform(url);
  return platform ? getPlatformLabel(platform) : '来源链接';
}

module.exports = {
  findUrls,
  normalizeUrl,
  detectPlatform,
  getPlatformLabel,
  isParseSupportedPlatform,
  extractSupportedLinks,
  inferPlatformLabelFromUrl
};
