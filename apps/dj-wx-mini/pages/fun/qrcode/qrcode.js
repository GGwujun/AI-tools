// 二维码生成 - 输入网址/文本，后端出图，预览+保存相册
const api = require('../../../config/api');

Page({
  data: {
    text: '',
    size: 720,
    qrUrl: '',       // 图片直出地址（image 组件直接加载）
    generating: false,
    history: []
  },

  onLoad() {
    this.setData({ history: wx.getStorageSync('funQrHistory') || [] });
  },

  onInput(e) {
    this.setData({ text: e.detail.value });
  },

  pasteFromClipboard() {
    wx.getClipboardData({
      success: (res) => {
        const t = (res.data || '').trim();
        if (t) this.setData({ text: t });
      }
    });
  },

  setSize(e) {
    this.setData({ size: parseInt(e.currentTarget.dataset.size, 10) });
    if (this.data.qrUrl) this.generate();
  },

  generate() {
    const text = (this.data.text || '').trim();
    if (!text) {
      wx.showToast({ title: '先输入网址或文字', icon: 'none' });
      return;
    }
    const url = `${api.qrcodeApi}?text=${encodeURIComponent(text)}&size=${this.data.size}`;
    this.setData({ qrUrl: url, generating: true });

    const history = [text].concat(this.data.history.filter((h) => h !== text)).slice(0, 10);
    wx.setStorageSync('funQrHistory', history);
    this.setData({ history });
  },

  onImgLoad() {
    this.setData({ generating: false });
  },

  onImgError() {
    this.setData({ generating: false });
    wx.showToast({ title: '生成失败，请重试', icon: 'none' });
  },

  preview() {
    if (!this.data.qrUrl) return;
    wx.previewImage({ current: this.data.qrUrl, urls: [this.data.qrUrl] });
  },

  save() {
    if (!this.data.qrUrl) {
      wx.showToast({ title: '先生成二维码', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中…', mask: true });
    wx.downloadFile({
      url: this.data.qrUrl,
      timeout: 20000,
      success: (res) => {
        if (res.statusCode !== 200) {
          wx.hideLoading();
          wx.showToast({ title: '下载失败，请重试', icon: 'none' });
          return;
        }
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.hideLoading();
            wx.showToast({ title: '已保存到相册', icon: 'success' });
          },
          fail: (err) => {
            wx.hideLoading();
            if (err && err.errMsg && err.errMsg.indexOf('auth') >= 0) {
              wx.showModal({
                title: '需要相册权限',
                content: '请在设置中允许保存到相册',
                confirmText: '去设置',
                success: (r) => r.confirm && wx.openSetting()
              });
            } else {
              wx.showToast({ title: '保存失败', icon: 'none' });
            }
          }
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '下载失败，请重试', icon: 'none' });
      }
    });
  },

  useHistory(e) {
    const t = e.currentTarget.dataset.text;
    this.setData({ text: t });
    this.generate();
  },

  clearHistory() {
    wx.removeStorageSync('funQrHistory');
    this.setData({ history: [] });
  },

  onShareAppMessage() {
    return {
      title: '二维码生成器，网址文本一键变二维码',
      path: '/pages/fun/qrcode/qrcode'
    };
  }
});
