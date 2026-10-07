// 双视频合成：同框（左右/上下）或画中画，后端 ffmpeg filter_complex 处理
const api = require('../../config/api');
const storage = require('../../utils/safe-storage');

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

const LAYOUTS = [
  { value: 'side', label: '左右同框' },
  { value: 'top', label: '上下同框' },
  { value: 'pip', label: '画中画' }
];

const PIP_POS = [
  { value: 'tl', label: '左上' },
  { value: 'tr', label: '右上' },
  { value: 'bl', label: '左下' },
  { value: 'br', label: '右下' }
];

const AUDIOS = [
  { value: 'main', label: '主视频声音' },
  { value: 'mix', label: '两路声音混合' }
];

function formatSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

Page({
  data: {
    layouts: LAYOUTS,
    pipPos: PIP_POS,
    audios: AUDIOS,
    url1: '',
    url2: '',
    layout: 'side',
    pip: 'br',
    audio: 'main',
    running: false,
    elapsed: 0,
    error: '',
    result: null,
    adUnitId: ''
  },

  onLoad() {
    this.setData({ adUnitId: api.adUnitId || '' });
    wx.setNavigationBarTitle({ title: '双视频合成' });
  },

  onShareAppMessage() {
    return {
      title: '双视频合成｜视频小工具合集',
      path: '/pages/tools/merge-tool/merge-tool'
    };
  },

  // ------------------------------------------------------------------ 表单

  onUrl1Input(e) {
    this.setData({ url1: e.detail.value || '' });
  },

  onUrl2Input(e) {
    this.setData({ url2: e.detail.value || '' });
  },

  onOptionTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [key]: e.currentTarget.dataset.value });
  },

  // ------------------------------------------------------------------ 处理

  validate() {
    const { url1, url2 } = this.data;
    if (!url1.trim() || !url2.trim()) {
      wx.showToast({ title: '请填写两个视频链接', icon: 'none' });
      return null;
    }
    return {
      layout: this.data.layout,
      pip: this.data.pip,
      audio: this.data.audio
    };
  },

  startProcess() {
    if (this.data.running) return;
    const params = this.validate();
    if (!params) return;
    this.runWithAdGate(() => this.doProcess(params));
  },

  // 与单条解析/批量解析共享 12 小时广告冷却
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
        callback();
      } else {
        wx.showToast({ title: '观看完整广告才能继续', icon: 'none' });
      }
    });
  },

  doProcess(params) {
    this.setData({ running: true, elapsed: 0, error: '', result: null });
    this.startElapsed();

    wx.request({
      url: api.toolsMergeApi,
      method: 'POST',
      timeout: 300000,
      header: { 'Content-Type': 'application/json' },
      data: {
        url1: this.data.url1.trim(),
        url2: this.data.url2.trim(),
        params
      },
      success: (res) => {
        const payload = res.data || {};
        if (res.statusCode === 200 && payload.code === 200 && payload.data) {
          const result = payload.data;
          result.tip = payload.tip || '';
          result.sizeText = result.size ? formatSize(result.size) : '';
          this.setData({ result });
        } else {
          const detail = payload.detail || payload.message || `处理失败（${res.statusCode}）`;
          this.setData({ error: typeof detail === 'string' ? detail : JSON.stringify(detail) });
        }
      },
      fail: (err) => {
        const message = /timeout/i.test(err.errMsg || '')
          ? '处理超时，视频可能太大，请稍后重试'
          : '网络异常，请稍后重试';
        this.setData({ error: message });
      },
      complete: () => {
        this.stopElapsed();
        this.setData({ running: false });
      }
    });
  },

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
  },

  retry() {
    this.setData({ error: '', result: null });
  },

  // ------------------------------------------------------------------ 结果操作

  absUrl(path) {
    return `${api.toolsFileBase}${path}`;
  },

  downloadToTemp(url) {
    return new Promise((resolve, reject) => {
      wx.showLoading({ title: '下载中...' });
      wx.downloadFile({
        url,
        timeout: 300000,
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode === 200) {
            resolve(res.tempFilePath);
          } else {
            reject(new Error(`下载失败（${res.statusCode}）`));
          }
        },
        fail: () => {
          wx.hideLoading();
          reject(new Error('下载失败，文件可能已过期'));
        }
      });
    });
  },

  saveResult() {
    const result = this.data.result || {};
    if (!result.url) return;
    this.downloadToTemp(this.absUrl(result.url))
      .then((filePath) => new Promise((resolve) => {
        wx.saveVideoToPhotosAlbum({
          filePath,
          success: () => {
            wx.showToast({ title: '已保存到相册' });
            resolve();
          },
          fail: (err) => {
            const denied = /auth|denied/i.test(err.errMsg || '');
            wx.showToast({ title: denied ? '请在设置中开启相册权限' : '保存失败', icon: 'none' });
            resolve();
          }
        });
      }))
      .catch((e) => {
        wx.showToast({ title: e.message || '保存失败', icon: 'none' });
      });
  },

  shareResultFile() {
    const result = this.data.result || {};
    if (!result.url) return;
    this.downloadToTemp(this.absUrl(result.url))
      .then((filePath) => new Promise((resolve) => {
        const task = () => wx.shareFileMessage({
          filePath,
          fileName: result.filename || 'merged.mp4',
          success: () => resolve(),
          fail: () => this.copyLink()
        });
        if (wx.shareFileMessage) {
          task();
        } else {
          this.copyLink();
        }
      }))
      .catch((e) => wx.showToast({ title: e.message || '分享失败', icon: 'none' }));
  },

  copyLink() {
    const result = this.data.result || {};
    if (!result.url) return;
    wx.setClipboardData({
      data: this.absUrl(result.url),
      success: () => wx.showToast({ title: '已复制下载链接', icon: 'none' })
    });
  }
});
