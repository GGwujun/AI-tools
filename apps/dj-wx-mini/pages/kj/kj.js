const { getParseTasks, getParseTaskResult } = require('../../utils/task-store');
const { inferPlatformLabelFromUrl } = require('../../utils/parse-link');
const storage = require('../../utils/safe-storage');

function formatTime(dateString) {
  if (!dateString) return '刚刚';

  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return dateString.slice(5, 10).replace('-', '/');
}

function mapTaskStatus(status) {
  const map = {
    pending: '等待中',
    running: '解析中',
    success: '已完成',
    failed: '失败'
  };
  return map[status] || '记录';
}

Page({
  data: {
    fallbackCover: '/images/gfgzh.jpeg',
    keyword: '',
    activeFilter: 'all',
    filters: [
      { id: 'all', name: '全部' },
      { id: 'video', name: '视频' },
      { id: 'image', name: '图集' },
      { id: 'favorite', name: '收藏' }
    ],
    historyItems: [],
    favoriteItems: [],
    taskItems: [],
    displayItems: []
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const historyItems = (storage.get('parseHistory', []) || []).map((item) => ({
      itemKey: `history_${item.id}`,
      id: item.id,
      kind: 'history',
      cover: item.cover || item.photo || this.data.fallbackCover,
      title: item.title || '未命名素材',
      platformText: item.meta?.platformLabel || inferPlatformLabelFromUrl(item.url),
      metaText: item.type === 'video' ? '视频素材' : `图集 ${(item.pics || []).length} 张`,
      desc: item.meta?.routeLabel || '已归档到素材库',
      timeText: formatTime(item.createdAt),
      type: item.type,
      status: 'success',
      statusText: '已保存',
      url: item.url,
      raw: item
    }));

    const favoriteItems = (storage.get('favorites', []) || []).map((item) => ({
      itemKey: `favorite_${item.id}`,
      id: item.id,
      kind: 'favorite',
      cover: item.cover || item.photo || this.data.fallbackCover,
      title: item.title || '未命名收藏',
      platformText: item.meta?.platformLabel || inferPlatformLabelFromUrl(item.url),
      metaText: '收藏夹',
      desc: item.type === 'video' ? '可继续下载视频' : `已收藏 ${(item.pics || []).length} 张图`,
      timeText: formatTime(item.createdAt),
      type: item.type,
      status: 'favorite',
      statusText: '已收藏',
      url: item.url,
      raw: item
    }));

    const taskItems = getParseTasks().map((item) => ({
      itemKey: `task_${item.id}`,
      id: item.id,
      kind: 'task',
      cover: this.data.fallbackCover,
      title: item.title || item.rawInput || '未命名任务',
      platformText: item.platformLabel || inferPlatformLabelFromUrl(item.url),
      metaText: item.routeLabel || '解析任务',
      desc: item.errorReason || item.typeLabel || '可继续查看结果',
      timeText: formatTime(item.updatedAt || item.createdAt),
      type: item.typeLabel === '无损图集' ? 'image' : 'video',
      status: item.status,
      statusText: mapTaskStatus(item.status),
      url: item.url,
      raw: item
    }));

    this.setData({
      historyItems,
      favoriteItems,
      taskItems
    }, () => this.applyFilters());
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value || '' }, () => this.applyFilters());
  },

  switchFilter(e) {
    this.setData({ activeFilter: e.currentTarget.dataset.id }, () => this.applyFilters());
  },

  applyFilters() {
    const { activeFilter, keyword, historyItems, favoriteItems, taskItems } = this.data;
    let list = historyItems.concat(favoriteItems, taskItems);

    if (activeFilter === 'video' || activeFilter === 'image') {
      list = list.filter((item) => item.type === activeFilter);
    } else if (activeFilter === 'favorite') {
      list = favoriteItems;
    }

    const normalizedKeyword = String(keyword || '').trim().toLowerCase();
    if (normalizedKeyword) {
      list = list.filter((item) => (
        `${item.title}${item.platformText}${item.desc}${item.metaText}`.toLowerCase().includes(normalizedKeyword)
      ));
    }

    this.setData({ displayItems: list });
  },

  handleItemTap(e) {
    const { kind, id } = e.currentTarget.dataset;
    if (kind === 'task') {
      this.openTask(id);
      return;
    }
    this.openMaterial(kind, id);
  },

  openMaterial(kind, id) {
    const source = kind === 'favorite' ? this.data.favoriteItems : this.data.historyItems;
    const target = source.find((item) => item.id === id);
    if (!target) return;

    const resultData = {
      title: target.raw.title,
      photo: target.raw.cover || this.data.fallbackCover,
      videourl: target.raw.url,
      downurl: target.raw.downurl,
      pics: target.raw.pics,
      meta: target.raw.meta
    };

    wx.navigateTo({
      url: `/pages/video/video?data=${encodeURIComponent(JSON.stringify(resultData))}`
    });
  },

  openTask(id) {
    const task = this.data.taskItems.find((item) => item.id === id);
    if (!task) return;

    if (task.raw.status === 'success') {
      const resultData = getParseTaskResult(task.raw.id);
      if (resultData) {
        wx.navigateTo({
          url: `/pages/video/video?data=${encodeURIComponent(JSON.stringify(resultData))}`
        });
        return;
      }
    }

    wx.navigateTo({
      url: `/pages/video/video?input=${encodeURIComponent(task.raw.rawInput || task.raw.url || '')}`
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  }
});
