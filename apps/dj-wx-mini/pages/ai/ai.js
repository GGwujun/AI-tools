Page({
  data: {
    stats: {
      aiWrites: 0,
      aiOcr: 0,
      aiErase: 0,
      aiTts: 0
    }
  },

  onLoad() {
    this.loadStats();
  },

  onShow() {
    this.loadStats();
  },

  onPullDownRefresh() {
    this.loadStats();
    wx.stopPullDownRefresh();
  },

  loadStats() {
    const aiStats = wx.getStorageSync('aiStats') || {
      aiWrites: 0,
      aiOcr: 0,
      aiErase: 0,
      aiTts: 0
    };
    this.setData({ stats: aiStats });
  },

  goToTool(e) {
    const type = e.currentTarget.dataset.type;
    const routes = {
      writer: '/pages/ai/writer/writer',
      tts: '/pages/ai/tts/tts'
    };

    if (routes[type]) {
      wx.navigateTo({ url: routes[type] });
    }
  },

  // 更新统计数据
  updateStats(type) {
    const stats = wx.getStorageSync('aiStats') || {
      aiWrites: 0,
      aiOcr: 0,
      aiErase: 0,
      aiTts: 0
    };

    const keyMap = {
      writer: 'aiWrites',
      ocr: 'aiOcr',
      eraser: 'aiErase',
      tts: 'aiTts'
    };

    if (keyMap[type]) {
      stats[keyMap[type]]++;
      wx.setStorageSync('aiStats', stats);
      this.setData({ stats });
    }
  }
});
