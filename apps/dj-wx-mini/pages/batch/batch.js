const storage = require('../../utils/safe-storage');
const { parseVideo, inferFailureReason } = require('../../utils/parse-runner');
const { extractSupportedLinks, inferPlatformLabelFromUrl } = require('../../utils/parse-link');
const api = require('../../config/api');

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

Page({
  data: {
    rawInput: '',
    tasks: [], // {url, platformLabel, status, title, cover, type, reason}
    running: false,
    adUnitId: '',
    hasWatchedAd: false,
    adWatchedTimestamp: null
  },

  onLoad(options) {
    this.setData({
      hasWatchedAd: !!storage.get('hasWatchedAd'),
      adWatchedTimestamp: storage.get('adWatchedTimestamp') || null,
      adUnitId: api.adUnitId || ''
    });

    if (options && options.input) {
      try {
        this.setData({ rawInput: decodeURIComponent(options.input) });
      } catch (e) { /* 忽略非法参数 */ }
    }
  },

  onInput(e) {
    this.setData({ rawInput: e.detail.value || '' });
  },

  clearInput() {
    this.setData({ rawInput: '', tasks: [] });
  },

  buildTasks() {
    const links = extractSupportedLinks(this.data.rawInput || '');
    return links.map((url) => ({
      url,
      platformLabel: inferPlatformLabelFromUrl(url),
      status: 'pending',
      title: '',
      cover: '',
      type: '',
      reason: ''
    }));
  },

  // 开始批量解析：多条链接先过广告门槛（12小时冷却与单条解析共享）
  startBatch() {
    if (this.data.running) return;

    const tasks = this.buildTasks();
    if (!tasks.length) {
      wx.showToast({ title: '没有识别到可解析的链接', icon: 'none' });
      return;
    }

    this.setData({ tasks });
    this.runWithAdGate(() => this.runAll());
  },

  runWithAdGate(callback) {
    const { adUnitId, hasWatchedAd, adWatchedTimestamp } = this.data;
    const inCooldown = hasWatchedAd && adWatchedTimestamp
      && (Date.now() - adWatchedTimestamp) < TWELVE_HOURS;

    if (!adUnitId || inCooldown) {
      callback();
      return;
    }

    wx.showModal({
      title: '提示',
      content: '观看一段广告，即可批量解析全部链接',
      success: (res) => {
        if (res.confirm) {
          this.watchAd(callback);
        }
      }
    });
  },

  watchAd(callback) {
    wx.showLoading({ title: '加载广告中...' });
    const log = wx.getRealtimeLogManager ? wx.getRealtimeLogManager() : null;

    if (!wx.createRewardedVideoAd) {
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
        const now = Date.now();
        storage.set('hasWatchedAd', true);
        storage.set('adWatchedTimestamp', now);
        this.setData({ hasWatchedAd: true, adWatchedTimestamp: now });
        callback();
      } else {
        wx.showToast({ title: '观看完整广告才能继续', icon: 'none' });
      }
    });
  },

  // 串行逐条解析，避免并发触发平台风控
  async runAll() {
    this.setData({ running: true });
    const { tasks } = this.data;

    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].status !== 'pending') continue;
      await this.runTask(i);
    }

    this.setData({ running: false });
    this.reportDone();
  },

  runTask(index) {
    this.updateTask(index, { status: 'running' });

    return parseVideo(this.data.tasks[index].url)
      .then((resultData) => {
        this.saveHistoryItem(resultData);
        this.updateTask(index, {
          status: 'success',
          title: resultData.title || '未命名素材',
          cover: resultData.photo || '',
          type: resultData.downurl ? 'video' : 'image',
          reason: ''
        });
      })
      .catch((error) => {
        this.updateTask(index, {
          status: 'failed',
          reason: inferFailureReason(error)
        });
      });
  },

  updateTask(index, patch) {
    const key = `tasks[${index}]`;
    const data = {};
    Object.keys(patch).forEach((field) => {
      data[`${key}.${field}`] = patch[field];
    });
    this.setData(data);
  },

  retryFailed() {
    if (this.data.running) return;

    const { tasks } = this.data;
    tasks.forEach((task, index) => {
      if (task.status === 'failed') {
        this.updateTask(index, { status: 'pending', reason: '' });
      }
    });

    this.runWithAdGate(() => this.runAll());
  },

  reportDone() {
    const { tasks } = this.data;
    const okCount = tasks.filter((t) => t.status === 'success').length;
    const failCount = tasks.filter((t) => t.status === 'failed').length;

    if (failCount === 0) {
      wx.showToast({ title: `全部完成，共 ${okCount} 条`, icon: 'success' });
    } else {
      wx.showToast({ title: `成功 ${okCount} 条，失败 ${failCount} 条`, icon: 'none' });
    }
  },

  // 查看单条解析结果（带数据直达，无需二次解析）
  openTask(e) {
    const index = Number(e.currentTarget.dataset.index);
    const task = this.data.tasks[index];
    if (!task || task.status !== 'success') return;

    const taskResult = storage.get('parseHistory', []).find(
      (item) => item.url && item.url === task.url
    );
    if (taskResult && taskResult.meta) {
      // 用历史里存的完整结果数据回放
      const resultData = {
        title: taskResult.title,
        photo: taskResult.cover,
        videourl: taskResult.url,
        downurl: taskResult.downurl,
        pics: taskResult.pics,
        meta: taskResult.meta
      };
      wx.navigateTo({
        url: `/pages/video/video?data=${encodeURIComponent(JSON.stringify(resultData))}`
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/video/video?input=${encodeURIComponent(task.url)}`
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  // 与 video.js 的 parseHistory 结构保持一致，首页/素材库可见
  saveHistoryItem(resultData) {
    try {
      let history = storage.get('parseHistory', []);
      const item = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: resultData.title || '未命名',
        cover: resultData.photo || '',
        type: resultData.downurl ? 'video' : 'image',
        url: resultData.videourl || resultData.pics?.[0] || '',
        downurl: resultData.downurl || '',
        pics: resultData.pics || [],
        meta: resultData.meta,
        createdAt: new Date().toISOString(),
        favorited: false
      };

      const existingIndex = history.findIndex((h) => h.url === item.url);
      if (existingIndex !== -1) {
        history[existingIndex] = { ...history[existingIndex], ...item, id: history[existingIndex].id };
      } else {
        history.unshift(item);
      }

      if (history.length > 30) history = history.slice(0, 30);
      storage.set('parseHistory', history);
    } catch (e) {
      console.error('保存历史记录失败:', e);
    }
  },

  onShareAppMessage() {
    return {
      title: '无水印视频批量提取，一次保存多条',
      path: '/pages/home/home'
    };
  }
});
