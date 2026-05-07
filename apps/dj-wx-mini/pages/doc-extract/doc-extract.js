Page({
  data: {
    title: '',
    body: '',
    tags: ''
  },

  onLoad(options) {
    this.setData({
      title: decodeURIComponent(options.title || ''),
      body: decodeURIComponent(options.body || ''),
      tags: decodeURIComponent(options.tags || '')
    });
  },

  copyField(e) {
    const { field } = e.currentTarget.dataset;
    const value = this.data[field] || '';
    if (!value) return;

    wx.setClipboardData({
      data: value,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success'
        });
      }
    });
  }
});
