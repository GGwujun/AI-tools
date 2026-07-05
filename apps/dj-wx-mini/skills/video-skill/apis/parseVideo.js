/**
 * parseVideo — 解析社媒分享链接，提取无水印视频/图片
 *
 * 输入：url（用户粘贴的链接或包含链接的分享文案）
 * 输出：解析结果（标题、封面、视频地址/图片列表）
 * 接力页：/pages/video/video
 */

var parseRunner = require('../utils/parse-runner');
var parseLink = require('../utils/parse-link');

function parseVideo(params) {
  var input = (params && params.url) || '';

  if (!input || !input.trim()) {
    return Promise.resolve({
      isError: true,
      content: [{
        type: 'text',
        text: '用户没有提供链接。请先向用户索要要解析的分享链接（如抖音、B站、小红书等平台的分享文案或短链）。禁止编造链接。'
      }]
    });
  }

  // 先检测平台，提前给出友好提示
  var links = parseLink.extractSupportedLinks(input);
  var platform = links.length ? parseLink.detectPlatform(links[0]) : null;

  if (!platform) {
    return Promise.resolve({
      isError: true,
      content: [{
        type: 'text',
        text: '输入中未找到支持的平台链接。目前支持：抖音、TikTok、B站、快手、小红书、微博、视频号。请引导用户重新粘贴正确的分享链接。禁止编造链接或平台。'
      }]
    });
  }

  var platformLabel = parseLink.getPlatformLabel(platform);

  return parseRunner.parseVideo(input).then(function (result) {
    var typeText = result.type === 'video' ? '视频' : '图集（' + result.imageCount + '张图）';

    return {
      isError: false,
      // 给 AI 的文本：引导点击小程序卡片进入接力页
      content: [{
        type: 'text',
        text: '已成功解析来自' + platformLabel + '的' + typeText + '：「' + result.title + '」。请用一句简短话术引导用户点击下方小程序卡片，进入解析结果页查看和保存。禁止以纯文本列出视频地址或图片链接。'
      }],
      // 给 AI 理解用的结构化数据
      structuredContent: {
        type: result.type,
        title: result.title,
        platform: result.platform,
        platformLabel: result.platformLabel,
        cover: result.cover,
        imageCount: result.imageCount || 0,
        sourceUrl: result.sourceUrl
      },
      // 接力数据：query 拼到接力页 onLoad，payload 可预取
      handoff: {
        query: 'url=' + encodeURIComponent(result.sourceUrl) + '&platform=' + result.platform,
        payload: {
          preParsed: result
        }
      }
    };
  }).catch(function (err) {
    var reason = err && err.message || '未知错误';

    // 合规拦截
    if (/compliance|版权/i.test(reason)) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: '该内容疑似版权内容，按合规策略已拦截，无法解析。请告知用户换一个非版权内容尝试。禁止重试本接口。'
        }]
      };
    }

    return {
      isError: true,
      content: [{
        type: 'text',
        text: '解析失败：' + reason + '。可引导用户检查链接是否有效、或换一个链接重试。禁止用相同参数反复重试。'
      }]
    };
  });
}

module.exports = parseVideo;
