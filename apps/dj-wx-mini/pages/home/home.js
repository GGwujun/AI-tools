const {
  inferPlatformLabelFromUrl
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

  return merged.slice(0, 1).map((item) => ({
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
      { name: '视频号', icon: '/images/icons_svg/platform-wechat-channel.svg' },
      { name: 'B站', icon: '/images/icons_svg/platform-bilibili.svg' }
    ],
    steps: [
      { index: '1', title: '复制链接' },
      { index: '2', title: '粘贴解析' },
      { index: '3', title: '保存到相册' }
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

  goToTools() {
    wx.switchTab({ url: '/pages/tools/tools' });
  },

  goToProfile() {
    wx.switchTab({ url: '/pages/about/about' });
  }
});
