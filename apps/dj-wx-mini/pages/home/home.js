const {
  inferPlatformLabelFromUrl,
  extractSupportedLinks,
  detectPlatform,
  getPlatformLabel
} = require('../../utils/parse-link');
const { getParseTasks, getParseTaskResult } = require('../../utils/task-store');
const storage = require('../../utils/safe-storage');

function formatDateText() {
  const now = new Date();
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${now.getMonth() + 1}月${now.getDate()}日 ${week[now.getDay()]}`;
}

function formatRecentTime(dateString) {
  if (!dateString) return '刚刚';

  const diff = Date.now() - new Date(dateString).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (hours < 1) return '刚刚';
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return dateString.slice(5, 10).replace('-', '/');
}

function buildResultDataFromItem(item, fallbackCover) {
  return {
    title: item.title,
    photo: item.cover || item.photo || fallbackCover,
    videourl: item.url,
    downurl: item.downurl,
    pics: item.pics,
    meta: item.meta
  };
}

function buildRecentItems(history, taskResults, fallbackCover) {
  const merged = history
    .concat(taskResults)
    .filter((item) => item && item.url)
    .reduce((list, item) => {
      if (list.some((existing) => existing.url === item.url)) {
        return list;
      }
      list.push(item);
      return list;
    }, [])
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return merged.slice(0, 3).map((item) => ({
    id: item.id,
    title: item.title || '未命名素材',
    cover: item.cover || item.photo || fallbackCover,
    url: item.url,
    type: item.type,
    timeText: formatRecentTime(item.createdAt),
    platformText: item.meta?.platformLabel || inferPlatformLabelFromUrl(item.url),
    desc: item.type === 'video' ? '可继续保存、复制文案或加入素材库' : `图集素材，共 ${(item.pics || []).length} 张`
  }));
}

Page({
  data: {
    fallbackCover: '/images/gfgzh.jpeg',
    dateText: '',
    draftInput: '',
    platforms: [
      { name: '抖音', icon: '/images/icons_svg/platform-douyin.svg' },
      { name: '小红书', icon: '/images/icons_svg/platform-xiaohongshu.svg' },
      { name: '快手', icon: '/images/icons_svg/platform-kuaishou.svg' },
      { name: 'B站', icon: '/images/icons_svg/platform-bilibili.svg' },
      { name: '更多平台', icon: '/images/icons_svg/platform-more.svg' }
    ],
    faqs: [
      {
        id: 'parse-fail',
        q: '解析失败怎么办？',
        a: '请确认复制的是完整分享链接（在视频分享页点「复制链接」）。部分链接有时效性，过期后重新分享一次即可；偶发失败稍后重试或换个线路。',
        open: false
      },
      {
        id: 'save-fail',
        q: '视频保存不到相册？',
        a: '首次保存需要授权「保存到相册」权限，拒绝过后可在微信设置中重新开启。大视频建议复制链接用浏览器下载。',
        open: false
      },
      {
        id: 'link-expire',
        q: '提示链接已失效？',
        a: '无水印直链通常有时效，解析成功后建议立即保存；已过期的素材重新解析一次即可。',
        open: false
      },
      {
        id: 'feedback',
        q: '如何反馈问题？',
        a: '在「我的」页面点击意见反馈，描述问题和链接一并提交，会尽快处理。',
        open: false
      }
    ],
    steps: [
      { index: '1', title: '复制链接' },
      { index: '2', title: '粘贴解析' },
      { index: '3', title: '保存到相册' }
    ],
    hotTools: [
      { key: 'asr', name: '视频转文字', icon: '/images/icons_svg/tool-video-to-text.svg', url: '/pages/tools/video-tool?tool=asr' },
      { key: 'extract_audio', name: '音频提取', icon: '/images/icons_svg/extract-audio.svg', url: '/pages/tools/video-tool?tool=extract_audio' },
      { key: 'compress', name: '视频压缩', icon: '/images/icons_svg/package.svg', url: '/pages/tools/video-tool?tool=compress' },
      { key: 'grid', name: '九宫格切图', icon: '/images/icons_svg/thumbnail.svg', url: '/pages/tools/video-tool?tool=grid' },
      { key: 'eraser', name: '图片去水印', icon: '/images/icons_svg/tool-image-remove-watermark.svg', url: '/pages/ai/eraser/eraser' },
      { key: 'vertical', name: '视频转竖屏', icon: '/images/icons_svg/video.svg', url: '/pages/tools/video-tool?tool=vertical' },
      { key: 'oil', name: '今日油价', icon: '/images/icons_svg/wallet.svg', url: '/pages/daily/oil/oil' },
      { key: 'countdown', name: '倒数日', icon: '/images/icons_svg/calendar.svg', url: '/pages/fun/countdown/countdown' }
    ],
    recentItems: []
  },

  onLoad() {
    this.refreshPage();
  },

  onShow() {
    this.refreshPage();
  },

  refreshPage() {
    this.setData({ dateText: formatDateText() });
    this.loadRecentItems();
    this.checkClipboard();
  },

  // 检测剪贴板里的平台分享链接，自动填入输入框（同一条链接只提示一次）
  checkClipboard() {
    if (this.data.draftInput && this.data.draftInput.trim()) return;

    wx.getClipboardData({
      success: (res) => {
        const links = extractSupportedLinks(res.data || '');
        if (!links.length) return;

        const link = links[0];
        if (link === storage.get('lastClipboardLink', '')) return;
        storage.set('lastClipboardLink', link);

        this.setData({ draftInput: link });
        const platform = detectPlatform(link);
        wx.showToast({
          title: `已识别${getPlatformLabel(platform)}链接，点击解析`,
          icon: 'none'
        });
      }
    });
  },

  loadRecentItems() {
    const history = storage.get('parseHistory', []);
    const taskResults = getParseTasks()
      .filter((item) => item.status === 'success')
      .slice(0, 10)
      .map((task) => getParseTaskResult(task.id))
      .filter(Boolean)
      .map((resultData) => ({
        id: resultData.meta?.taskId || resultData.meta?.sourceUrl || `${Date.now()}_${Math.random()}`,
        title: resultData.title || '未命名素材',
        cover: resultData.photo || this.data.fallbackCover,
        type: resultData.downurl ? 'video' : 'image',
        url: resultData.videourl || resultData.pics?.[0] || '',
        downurl: resultData.downurl || '',
        pics: resultData.pics || [],
        meta: resultData.meta || {},
        createdAt: resultData.meta?.parsedAt || new Date().toISOString()
      }));

    this.setData({
      recentItems: buildRecentItems(history, taskResults, this.data.fallbackCover)
    });
  },

  onInput(e) {
    this.setData({ draftInput: e.detail.value || '' });
  },

  clearInput() {
    this.setData({ draftInput: '' });
  },

  goToParse() {
    const input = (this.data.draftInput || '').trim();
    if (!input) {
      wx.showToast({ title: '请先粘贴分享链接', icon: 'none' });
      return;
    }

    // 多条链接 → 批量解析页
    const links = extractSupportedLinks(input);
    if (links.length > 1) {
      wx.navigateTo({
        url: `/pages/batch/batch?input=${encodeURIComponent(input)}`
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/video/video?input=${encodeURIComponent(input)}`
    });
  },

  openRecent(e) {
    const { id, url } = e.currentTarget.dataset;
    const history = storage.get('parseHistory', []);
    const historyTarget = history.find((item) => item.id === id || item.url === url);

    if (historyTarget) {
      const taskResult = historyTarget.meta?.taskId ? getParseTaskResult(historyTarget.meta.taskId) : null;
      const resultData = taskResult || buildResultDataFromItem(historyTarget, this.data.fallbackCover);

      wx.navigateTo({
        url: `/pages/video/video?data=${encodeURIComponent(JSON.stringify(resultData))}`
      });
      return;
    }

    const task = getParseTasks().find((item) => item.id === id || item.url === url);
    if (!task) return;

    const taskResult = getParseTaskResult(task.id);
    if (taskResult) {
      wx.navigateTo({
        url: `/pages/video/video?data=${encodeURIComponent(JSON.stringify(taskResult))}`
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/video/video?input=${encodeURIComponent(task.rawInput || task.url || '')}`
    });
  },

  goToLibrary() {
    wx.switchTab({ url: '/pages/kj/kj' });
  },

  toggleFaq(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      faqs: this.data.faqs.map((item) => (
        item.id === id ? { ...item, open: !item.open } : item
      ))
    });
  },

  goToTools() {
    wx.switchTab({ url: '/pages/tools/tools' });
  },

  openHotTool(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url });
  },

  goToProfile() {
    wx.switchTab({ url: '/pages/about/about' });
  },

  onShareAppMessage() {
    return {
      title: '无水印视频提取，粘贴链接一键保存',
      path: '/pages/home/home'
    };
  }
});
