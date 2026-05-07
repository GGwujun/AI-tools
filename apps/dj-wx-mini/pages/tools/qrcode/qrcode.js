Page({
  data: {
    inputText: '',
    qrCodeUrl: '',
    scanResult: ''
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  generateQR() {
    const text = this.data.inputText.trim();
    if (!text) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '生成中...' });
    
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}`;
    
    wx.downloadFile({
      url: qrUrl,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          this.setData({ qrCodeUrl: res.tempFilePath });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '生成失败', icon: 'none' });
      }
    });
  },

  saveQR() {
    if (!this.data.qrCodeUrl) return;
    
    wx.saveImageToPhotosAlbum({
      filePath: this.data.qrCodeUrl,
      success: () => wx.showToast({ title: '已保存', icon: 'success' }),
      fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
    });
  },

  scanQR() {
    wx.scanCode({
      success: (res) => {
        this.setData({ scanResult: res.result });
      },
      fail: (err) => {
        if (err.errMsg !== 'scanCode:fail cancel') {
          wx.showToast({ title: '扫描失败', icon: 'none' });
        }
      }
    });
  },

  copyResult() {
    if (!this.data.scanResult) return;
    
    wx.setClipboardData({
      data: this.data.scanResult,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  }
});