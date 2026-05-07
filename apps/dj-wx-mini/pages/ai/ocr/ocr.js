// 文字识别 OCR - 使用智谱AI图像理解
const ZHIPU_CONFIG = {
  baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
  apiKey: 'f9ff2dfa21804ed8bdeeb511deaf888b.M0YaO5MyJ5Xa5Wvs'
};

Page({
  data: {
    selectedImage: '',
    selectedMode: 'general',
    modes: [
      { id: 'general', name: '通用文字', icon: '📝' },
      { id: 'idcard', name: '身份证', icon: '🪪' },
      { id: 'bankcard', name: '银行卡', icon: '💳' },
      { id: 'business', name: '营业执照', icon: '📄' }
    ],
    result: '',
    costTime: 0,
    isRecognizing: false,
    history: []
  },

  onLoad() {
    this.loadHistoryList();
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;

        if (res.tempFiles[0].size > 10 * 1024 * 1024) {
          wx.showToast({ title: '图片超过10MB', icon: 'none' });
          return;
        }

        this.setData({ selectedImage: tempFilePath, result: '' });
      },
      fail: (err) => {
        console.error('选择图片失败', err);
        wx.showToast({ title: '选择图片失败', icon: 'none' });
      }
    });
  },

  selectMode(e) {
    const modeId = e.currentTarget.dataset.id;
    this.setData({ selectedMode: modeId });
  },

  startRecognize() {
    if (!this.data.selectedImage) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }

    this.setData({ isRecognizing: true, result: '' });
    const startTime = Date.now();
    this.updateStats();

    // 使用智谱AI图像理解
    this.recognizeWithZhipuAI(startTime);
  },

  // 智谱AI图像识别
  recognizeWithZhipuAI(startTime) {
    const { selectedMode, selectedImage } = this.data;

    // 根据模式构建提示词
    const prompts = {
      general: '请仔细识别这张图片中的所有文字内容，按照原文原样输出，不要遗漏任何文字。',
      idcard: '请识别这张身份证图片，提取以下信息：姓名、性别、民族、出生日期、地址、身份证号码。请用清晰的分行格式输出。',
      bankcard: '请识别这张银行卡图片，提取银行名称和完整卡号。请用清晰的分行格式输出。',
      business: '请识别这张营业执照图片，提取：公司名称、统一社会信用代码、法定代表人、注册资本、成立日期。请用清晰的分行格式输出。'
    };

    const prompt = prompts[selectedMode] || prompts.general;

    // 先将本地图片转为base64
    wx.getFileSystemManager().readFile({
      filePath: selectedImage,
      encoding: 'base64',
      success: (res) => {
        const base64Image = 'data:image/jpeg;base64,' + res.data;

        wx.request({
          url: `${ZHIPU_CONFIG.baseUrl}/chat/completions`,
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ZHIPU_CONFIG.apiKey}`
          },
          data: {
            model: 'glm-4.6v',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: {
                      url: base64Image
                    }
                  },
                  {
                    type: 'text',
                    text: prompt
                  }
                ]
              }
            ]
          },
          success: (response) => {
            const costTime = ((Date.now() - startTime) / 1000).toFixed(1);

            if (response.statusCode === 200 && response.data.choices && response.data.choices[0]) {
              const resultText = response.data.choices[0].message.content;
              this.setData({
                result: resultText,
                costTime: parseFloat(costTime),
                isRecognizing: false
              });
              this.saveToHistory(selectedImage, resultText);
            } else {
              console.error('智谱AI返回错误:', response.data);
              wx.showToast({ title: '识别失败，请重试', icon: 'none' });
              this.setData({ isRecognizing: false });
            }
          },
          fail: (err) => {
            console.error('智谱AI请求失败', err);
            wx.showToast({ title: '网络请求失败', icon: 'none' });
            this.setData({ isRecognizing: false });
          }
        });
      },
      fail: (err) => {
        console.error('读取图片文件失败', err);
        wx.showToast({ title: '图片读取失败', icon: 'none' });
        this.setData({ isRecognizing: false });
      }
    });
  },

  copyResult() {
    if (!this.data.result) {
      wx.showToast({ title: '暂无识别结果', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: this.data.result,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      }
    });
  },

  saveToHistory(imagePath, resultText) {
    const history = wx.getStorageSync('aiOcrHistory') || [];
    history.unshift({
      id: Date.now(),
      thumb: imagePath,
      result: resultText,
      time: new Date().toLocaleString()
    });
    if (history.length > 20) history.length = 20;
    wx.setStorageSync('aiOcrHistory', history);
    this.setData({ history: history.slice(0, 10) });
  },

  loadHistoryList() {
    const history = wx.getStorageSync('aiOcrHistory') || [];
    this.setData({ history: history.slice(0, 10) });
  },

  loadHistory(e) {
    const index = e?.currentTarget?.dataset?.index ?? 0;
    const item = this.data.history[index];
    if (item) {
      this.setData({
        selectedImage: item.thumb,
        result: item.result
      });
    }
  },

  clearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空识别历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('aiOcrHistory');
          this.setData({ history: [] });
        }
      }
    });
  },

  updateStats() {
    const stats = wx.getStorageSync('aiStats') || {
      aiWrites: 0,
      aiOcr: 0,
      aiErase: 0,
      aiTts: 0
    };
    stats.aiOcr++;
    wx.setStorageSync('aiStats', stats);
  }
});
