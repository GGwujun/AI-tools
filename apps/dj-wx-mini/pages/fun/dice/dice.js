// 摇骰子 - 点击或摇一摇，1~3 个骰子，CSS 点阵 + 翻滚动画
const DOTS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

Page({
  data: {
    count: 1,          // 骰子个数
    dices: [1],        // 当前点数数组
    cells: [],         // 每个骰子的 9 宫格渲染数据
    rolling: false,
    total: 1,
    history: [],
    shakeHint: ''
  },

  onLoad() {
    this.roll(true);
    this.startShake();
  },

  onUnload() {
    wx.stopAccelerometer();
  },

  onHide() {
    wx.stopAccelerometer();
  },

  onShow() {
    if (!this.data.rolling) this.startShake();
  },

  // 摇一摇：加速度超过阈值触发
  startShake() {
    this._lastShake = 0;
    wx.startAccelerometer({ interval: 'normal' });
    wx.onAccelerometerChange((res) => {
      const now = Date.now();
      if (now - this._lastShake < 1500 || this.data.rolling) return;
      const mag = Math.abs(res.x) + Math.abs(res.y) + Math.abs(res.z);
      if (mag > 2.8) {
        this._lastShake = now;
        wx.vibrateShort({ type: 'medium' });
        this.roll();
      }
    });
  },

  setCount(e) {
    const count = parseInt(e.currentTarget.dataset.count, 10);
    if (count === this.data.count || this.data.rolling) return;
    this.setData({ count });
    this.roll(true);
  },

  tapRoll() {
    this.roll();
  },

  roll(silent) {
    if (this.data.rolling) return;
    const count = this.data.count;
    const dices = [];
    for (let i = 0; i < count; i++) {
      dices.push(1 + Math.floor(Math.random() * 6));
    }
    this.setData({ rolling: true, shakeHint: '' });
    if (!silent) wx.vibrateShort({ type: 'light' });

    // 动画期间先随机跳变几下，450ms 后定格
    const jumpTimer = setInterval(() => {
      const temp = dices.map(() => 1 + Math.floor(Math.random() * 6));
      this.setData({ cells: temp.map((v) => this.buildCells(v)) });
    }, 90);

    setTimeout(() => {
      clearInterval(jumpTimer);
      const total = dices.reduce((a, b) => a + b, 0);
      const history = [total].concat(this.data.history).slice(0, 20);
      this.setData({
        dices,
        cells: dices.map((v) => this.buildCells(v)),
        rolling: false,
        total,
        history,
        shakeHint: count === 1 && dices[0] === 6 ? '六六大顺！' : ''
      });
      if (!silent) wx.vibrateShort({ type: 'heavy' });
    }, 480);
  },

  buildCells(value) {
    const dots = DOTS[value] || [];
    const cells = [];
    for (let i = 0; i < 9; i++) {
      cells.push({ on: dots.indexOf(i) >= 0 });
    }
    return cells;
  },

  onShareAppMessage() {
    return {
      title: `摇骰子摇出了 ${this.data.total} 点，你敢来挑战吗`,
      path: '/pages/fun/dice/dice'
    };
  }
});
