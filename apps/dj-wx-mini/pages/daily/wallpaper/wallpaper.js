// 每日壁纸 - Bing 每日一图，预览/保存到相册（保存走后端代理绕过域名白名单）
const api = require('../../../config/api');

Page({
  data: {
    loading: true,
    images: [],      // {title, copyright, date, hd, uhd, src}
    current: 0,
    saving: false
  },

  onLoad() {
    this.fetch();
  },

  fetch() {
    wx.request({
      url: api.dailyWallpaperApi + '?days=8',
      timeout: 20000,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.code === 200) {
          const images = ((res.data.data || {}).images || []).map((img) => Object.assign({}, img, {
            src: img.hd  // 展示用，加载失败自动切代理
          }));
          this.setData({ loading: false, images });
        } else {
          this.fail((res.data && res.data.message) || '壁纸获取失败');
        }
      },
      fail: () => this.fail('网络请求失败')
    });
  },

  fail(msg) {
    this.setData({ loading: false });
    wx.showToast({ title: msg, icon: 'none' });
  },

  onSwiperChange(e) {
    this.setData({ current: e.detail.current });
  },

  selectDay(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ current: i });
  },

  // 直连 bing 加载失败 → 换后端代理地址重试
  onImgError(e) {
    const i = e.currentTarget.dataset.index;
    const img = this.data.images[i];
    if (img && img.src === img.hd) {
      this.setData({ [`images[${i}].src`]: `${api.dailyWallpaperFile}?url=${encodeURIComponent(img.hd)}` });
    }
  },

  preview() {
    const img = this.data.images[this.data.current];
    if (!img) return;
    wx.previewImage({ current: img.hd, urls: [img.hd] });
  },

  save() {
    const img = this.data.images[this.data.current];
    if (!img || this.data.saving) return;
    this.setData({ saving: true });
    wx.showLoading({ title: '下载中…', mask: true });

    // 下载走后端代理（bing.com 不在小程序下载白名单）
    const url = `${api.dailyWallpaperFile}?url=${encodeURIComponent(img.hd)}`;
    wx.downloadFile({
      url,
      timeout: 30000,
      success: (res) => {
        if (res.statusCode !== 200) return this.saveFail('下载失败，请重试');
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
          },
          complete: () => this.setData({ saving: false })
        });
      },
      fail: () => this.saveFail('下载失败，请重试')
    });
  },

  saveFail(msg) {
    wx.hideLoading();
    this.setData({ saving: false });
    wx.showToast({ title: msg, icon: 'none' });
  },

  onShareAppMessage() {
    const img = this.data.images[this.data.current] || {};
    return {
      title: `每日壁纸 | ${img.title || 'Bing 高清壁纸一键保存'}`,
      path: '/pages/daily/wallpaper/wallpaper'
    };
  }
});
