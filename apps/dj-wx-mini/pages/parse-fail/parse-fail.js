Page({
  data: {
    reason: '这条内容暂时无法解析'
  },

  onLoad(options) {
    if (options.reason) {
      this.setData({
        reason: decodeURIComponent(options.reason)
      });
    }
  },

  retry() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({ url: '/pages/home/home' });
      }
    });
  },

  openSupport() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  copyFeedback() {
    wx.setClipboardData({
      data: `问题页面：解析失败页\n失败原因：${this.data.reason}\n补充说明：`,
      success: () => {
        wx.showToast({
          title: '已复制反馈模板',
          icon: 'success'
        });
      }
    });
  }
});
