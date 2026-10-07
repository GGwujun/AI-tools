// AI 卡路里 - 拍照识别食物并估算热量（走后端 AI 代理，key 在服务器端）
const api = require('../../../config/api');

const PROMPT = '你是营养师。请仔细看这张图里的食物，识别出每一种，并估算热量。' +
  '严格只输出 JSON（不要 markdown 代码块、不要多余文字），格式：' +
  '{"items":[{"name":"食物名","portion":"估计分量，如 1碗/100g/1个","kcal":数字}],"total":总千卡数字,"advice":"一句话饮食建议"}';

Page({
  data: {
    image: '',
    isAnalyzing: false,
    items: [],
    total: 0,
    advice: '',
    rawText: ''
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const f = res.tempFiles[0];
        if (f.size > 10 * 1024 * 1024) {
          wx.showToast({ title: '图片超过 10MB，换一张试试', icon: 'none' });
          return;
        }
        this.setData({ image: f.tempFilePath, items: [], total: 0, advice: '', rawText: '' });
      }
    });
  },

  start() {
    if (!this.data.image) {
      wx.showToast({ title: '先拍一张食物照片', icon: 'none' });
      return;
    }
    if (this.data.isAnalyzing) return;
    this.setData({ isAnalyzing: true });

    wx.getFileSystemManager().readFile({
      filePath: this.data.image,
      encoding: 'base64',
      success: (res) => {
        this.analyze('data:image/jpeg;base64,' + res.data);
      },
      fail: () => {
        this.setData({ isAnalyzing: false });
        wx.showToast({ title: '图片读取失败', icon: 'none' });
      }
    });
  },

  analyze(base64) {
    wx.request({
      url: api.aiChatApi,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      timeout: 60000,
      data: {
        model: 'glm-4.6v',
        temperature: 0.2,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: base64 } },
            { type: 'text', text: PROMPT }
          ]
        }]
      },
      success: (response) => {
        const done = () => this.setData({ isAnalyzing: false });
        if (response.statusCode === 200 && response.data && response.data.choices && response.data.choices[0]) {
          let text = response.data.choices[0].message.content || '';
          // 模型偶尔会包一层 ```json，剥掉
          text = text.replace(/```json|```/g, '').trim();
          try {
            const m = JSON.parse(text);
            const items = (m.items || []).map((it) => ({
              name: it.name || '未知',
              portion: it.portion || '',
              kcal: typeof it.kcal === 'number' ? Math.round(it.kcal) : parseInt(it.kcal, 10) || 0
            }));
            const total = typeof m.total === 'number' ? Math.round(m.total) : items.reduce((a, b) => a + (b.kcal || 0), 0);
            this.setData({ items, total, advice: m.advice || '', rawText: '' });
          } catch (e) {
            this.setData({ rawText: text });
          }
          done();
        } else {
          done();
          wx.showToast({ title: '识别失败，请重试', icon: 'none' });
        }
      },
      fail: () => {
        this.setData({ isAnalyzing: false });
        wx.showToast({ title: '网络请求失败', icon: 'none' });
      }
    });
  },

  onShareAppMessage() {
    return {
      title: 'AI 卡路里｜拍张照就知道这顿吃了多少千卡',
      path: '/pages/fun/calorie/calorie'
    };
  }
});
