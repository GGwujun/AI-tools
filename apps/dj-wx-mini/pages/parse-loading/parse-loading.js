Page({
  data: {
    input: ''
  },

  onLoad(options) {
    const input = decodeURIComponent(options.input || '');
    this.setData({ input });

    setTimeout(() => {
      wx.redirectTo({
        url: `/pages/ai/video-parse/video-parse?input=${encodeURIComponent(input)}&autoParse=1`
      });
    }, 450);
  }
});
