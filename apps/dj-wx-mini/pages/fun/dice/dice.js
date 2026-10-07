// 随机决定器：摇骰子 / 是否决定 / 随机数 / 点名抽人（点击或摇一摇触发）
const storage = require('../../../utils/safe-storage');

const DOTS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

const MODES = [
  { id: 'dice', label: '摇骰子' },
  { id: 'yesno', label: '是否决定' },
  { id: 'number', label: '随机数' },
  { id: 'pick', label: '点名抽人' }
];

const BTN_TEXT = {
  dice: '🎲 摇一个',
  yesno: '🎯 帮我决定',
  number: '🔢 生成随机数',
  pick: '🙋 抽一个人'
};

const PICK_KEY = 'funPickNames';

Page({
  data: {
    modes: MODES,
    mode: 'dice',
    btnText: BTN_TEXT.dice,
    // 骰子
    count: 1,
    dices: [1],
    cells: [],
    total: 1,
    // 是否决定
    yesno: '是',
    // 随机数
    minVal: '1',
    maxVal: '100',
    numberResult: '',
    // 点名抽人
    nameText: '',
    pickResult: '',
    pickCount: 0,
    // 共享
    rolling: false,
    history: [],
    shakeHint: ''
  },

  onLoad() {
    const nameText = storage.get(PICK_KEY) || '';
    this.setData({ nameText, pickCount: this.parseNames(nameText).length });
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

  // 摇一摇：加速度超过阈值触发（所有模式通用）
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

  // ------------------------------------------------------------------ 模式与输入

  setMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.mode || this.data.rolling) return;
    this.setData({ mode, btnText: BTN_TEXT[mode], history: [], shakeHint: '' });
    if (mode === 'dice') this.roll(true);
  },

  setCount(e) {
    const count = parseInt(e.currentTarget.dataset.count, 10);
    if (count === this.data.count || this.data.rolling) return;
    this.setData({ count });
    this.roll(true);
  },

  onMinInput(e) {
    this.setData({ minVal: e.detail.value });
  },

  onMaxInput(e) {
    this.setData({ maxVal: e.detail.value });
  },

  onNameInput(e) {
    const nameText = e.detail.value || '';
    this.setData({ nameText, pickCount: this.parseNames(nameText).length });
  },

  clearNames() {
    this.setData({ nameText: '', pickCount: 0, pickResult: '' });
    storage.set(PICK_KEY, '');
  },

  parseNames(text) {
    return String(text == null ? this.data.nameText : text)
      .split(/[\n\r,，、;；\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);
  },

  // ------------------------------------------------------------------ 触发

  tapRoll() {
    this.roll();
  },

  roll(silent) {
    if (this.data.rolling) return;
    const mode = this.data.mode;
    if (mode === 'yesno') return this.rollYesNo(silent);
    if (mode === 'number') return this.rollNumber(silent);
    if (mode === 'pick') return this.rollPick(silent);
    return this.rollDice(silent);
  },

  // 通用动画：450ms 内每 90ms 跳变一次，updater 返回随机中间值
  animate(finalSetter, done) {
    this.setData({ rolling: true, shakeHint: '' });
    const jumpTimer = setInterval(finalSetter, 90);
    setTimeout(() => {
      clearInterval(jumpTimer);
      done();
    }, 480);
  },

  rollDice(silent) {
    const count = this.data.count;
    const dices = [];
    for (let i = 0; i < count; i++) {
      dices.push(1 + Math.floor(Math.random() * 6));
    }
    if (!silent) wx.vibrateShort({ type: 'light' });
    this.animate(
      () => {
        const temp = dices.map(() => 1 + Math.floor(Math.random() * 6));
        this.setData({ cells: temp.map((v) => this.buildCells(v)) });
      },
      () => {
        const total = dices.reduce((a, b) => a + b, 0);
        this.setData({
          dices,
          cells: dices.map((v) => this.buildCells(v)),
          rolling: false,
          total,
          shakeHint: count === 1 && dices[0] === 6 ? '六六大顺！' : ''
        });
        this.pushHistory(String(total));
        if (!silent) wx.vibrateShort({ type: 'heavy' });
      }
    );
  },

  rollYesNo(silent) {
    if (!silent) wx.vibrateShort({ type: 'light' });
    const final = Math.random() < 0.5 ? '是' : '否';
    this.animate(
      () => this.setData({ yesno: Math.random() < 0.5 ? '是' : '否' }),
      () => {
        this.setData({
          rolling: false,
          yesno: final,
          shakeHint: final === '是' ? '老天爷说：冲！' : '老天爷说：缓一缓'
        });
        this.pushHistory(final);
        if (!silent) wx.vibrateShort({ type: 'heavy' });
      }
    );
  },

  rollNumber(silent) {
    const min = Math.floor(Number(this.data.minVal));
    const max = Math.ceil(Number(this.data.maxVal));
    if (!(min < max) || max - min > 1000000) {
      wx.showToast({ title: '范围需 最小<最大，跨度不超 100 万', icon: 'none' });
      return;
    }
    if (!silent) wx.vibrateShort({ type: 'light' });
    const rand = () => min + Math.floor(Math.random() * (max - min + 1));
    const final = rand();
    this.animate(
      () => this.setData({ numberResult: String(rand()) }),
      () => {
        this.setData({ rolling: false, numberResult: String(final), shakeHint: '' });
        this.pushHistory(String(final));
        if (!silent) wx.vibrateShort({ type: 'heavy' });
      }
    );
  },

  rollPick(silent) {
    const names = this.parseNames();
    if (names.length < 2) {
      wx.showToast({ title: '名单至少 2 人（换行/逗号/空格分隔）', icon: 'none' });
      return;
    }
    storage.set(PICK_KEY, this.data.nameText);
    if (!silent) wx.vibrateShort({ type: 'light' });
    const final = names[Math.floor(Math.random() * names.length)];
    this.animate(
      () => this.setData({ pickResult: names[Math.floor(Math.random() * names.length)] }),
      () => {
        this.setData({ rolling: false, pickResult: final, shakeHint: '天选之人！' });
        this.pushHistory(final);
        if (!silent) wx.vibrateShort({ type: 'heavy' });
      }
    );
  },

  buildCells(value) {
    const dots = DOTS[value] || [];
    const cells = [];
    for (let i = 0; i < 9; i++) {
      cells.push({ on: dots.indexOf(i) >= 0 });
    }
    return cells;
  },

  pushHistory(text) {
    const history = [text].concat(this.data.history).slice(0, 20);
    this.setData({ history });
  },

  onShareAppMessage() {
    const map = {
      dice: `摇骰子摇出了 ${this.data.total} 点，你敢来挑战吗`,
      yesno: `纠结吗？我帮你决定了一个字：${this.data.yesno}`,
      number: '随机数生成器，摇一摇就有答案',
      pick: '点名抽人神器，团队抽签就靠它'
    };
    return { title: map[this.data.mode], path: '/pages/fun/dice/dice' };
  }
});
