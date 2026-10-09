// 手持弹幕 - 全屏滚动大字应援
const COLORS = [
  { name: '荧光白', value: '#ffffff' },
  { name: '应援红', value: '#ff4d4f' },
  { name: '柠檬黄', value: '#ffd54a' },
  { name: '荧光绿', value: '#52c41a' },
  { name: '天空蓝', value: '#40a9ff' },
  { name: '樱花粉', value: '#ff7eb3' }
];
const SIZES = [
  { name: '标准', value: 120 },
  { name: '大', value: 170 },
  { name: '特大', value: 230 },
  { name: '巨无霸', value: 300 }
];
const SPEEDS = [
  { name: '慢速', value: 14 },
  { name: '中速', value: 9 },
  { name: '快速', value: 6 }
];

Page({
  goBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => wx.switchTab({ url: '/pages/tools/tools' })
    });
  },

  data: {
    text: '',
    colors: COLORS,
    sizes: SIZES,
    speeds: SPEEDS,
    colorIndex: 0,
    sizeIndex: 2,
    speedIndex: 1,
    fullscreen: false,
    // 渲染用
    activeColor: COLORS[0].value,
    activeSize: SIZES[2].value,
    activeDuration: SPEEDS[1].value
  },

  onInput(e) {
    this.setData({ text: e.detail.value });
  },

  setColor(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ colorIndex: i, activeColor: COLORS[i].value });
  },

  setSize(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ sizeIndex: i, activeSize: SIZES[i].value });
  },

  setSpeed(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ speedIndex: i, activeDuration: SPEEDS[i].value });
  },

  start() {
    const text = (this.data.text || '').trim();
    if (!text) {
      wx.showToast({ title: '先输入弹幕文字', icon: 'none' });
      return;
    }
    this.setData({ fullscreen: true, text });
    wx.setKeepScreenOn({ keepScreenOn: true });
  },

  stop() {
    this.setData({ fullscreen: false });
    wx.setKeepScreenOn({ keepScreenOn: false });
  },

  onUnload() {
    wx.setKeepScreenOn({ keepScreenOn: false });
  },

  onShareAppMessage() {
    return {
      title: '手持弹幕｜演唱会应援、机场接机神器',
      path: '/pages/fun/danmaku/danmaku'
    };
  }
});
