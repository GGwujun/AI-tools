Page({
  data: {
    masterEnabled: false,
    marketEnabled: false,
    followedEnabled: false,
    optionalEnabled: false,
    threshold: 3,
    thresholdOptions: [2, 3, 5, 8]
  },

  onLoad() {
    this.loadSettings();
  },

  loadSettings() {
    this.setData({
      masterEnabled: wx.getStorageSync('fundAlertEnabled') || false,
      marketEnabled: wx.getStorageSync('marketAlertEnabled') || false,
      followedEnabled: wx.getStorageSync('followedAlertEnabled') || false,
      optionalEnabled: wx.getStorageSync('optionalAlertEnabled') || false,
      threshold: wx.getStorageSync('alertThreshold') || 3
    });
  },

  onMasterToggle(e) {
    let enabled;
    // 如果是事件对象(点击行触发)，切换状态；如果是switch组件触发，使用其值
    if (e && e.detail !== undefined && typeof e.detail.value === 'boolean') {
      enabled = e.detail.value;
    } else {
      enabled = !this.data.masterEnabled;
    }
    wx.setStorageSync('fundAlertEnabled', enabled);
    this.setData({ masterEnabled: enabled });
    wx.showToast({
      title: enabled ? '已开启提醒' : '已关闭提醒',
      icon: 'none'
    });
  },

  onMarketToggle(e) {
    let enabled;
    if (e && e.detail !== undefined && typeof e.detail.value === 'boolean') {
      enabled = e.detail.value;
    } else {
      enabled = !this.data.marketEnabled;
    }
    wx.setStorageSync('marketAlertEnabled', enabled);
    this.setData({ marketEnabled: enabled });
  },

  onFollowedToggle(e) {
    let enabled;
    if (e && e.detail !== undefined && typeof e.detail.value === 'boolean') {
      enabled = e.detail.value;
    } else {
      enabled = !this.data.followedEnabled;
    }
    wx.setStorageSync('followedAlertEnabled', enabled);
    this.setData({ followedEnabled: enabled });
  },

  onOptionalToggle(e) {
    let enabled;
    if (e && e.detail !== undefined && typeof e.detail.value === 'boolean') {
      enabled = e.detail.value;
    } else {
      enabled = !this.data.optionalEnabled;
    }
    wx.setStorageSync('optionalAlertEnabled', enabled);
    this.setData({ optionalEnabled: enabled });
  },

  onThresholdSelect(e) {
    const threshold = e.currentTarget.dataset.value;
    wx.setStorageSync('alertThreshold', threshold);
    this.setData({ threshold });
  },

  goToRemindSettings() {
    wx.navigateTo({
      url: '/pages/save/remind-settings/remind-settings'
    });
  }
});
