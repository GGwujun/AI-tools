Page({
  data: {
    input: ''
  },

  onLoad(options) {
    const input = decodeURIComponent(options.input || '');
    this.setData({ input });

    setTimeout(() => {
      wx.redirectTo({
        url: `/pages/video/video?input=${encodeURIComponent(input)}`
      });
    }, 450);
  }
});
