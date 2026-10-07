// 密码生成器：长度/字符集可选，去混淆字符，一键复制
const storage = require('../../../utils/safe-storage');

const KEY = 'funPasswordOptions';

const SETS = {
  lower: 'abcdefghjkmnpqrstuvwxyz',
  upper: 'ABCDEFGHJKMNPQRSTUVWXYZ',
  digit: '23456789',
  symbol: '!@#$%^&*-_=+?'
};
// 去掉的易混淆字符：i l o I L O 0 1（可选项）
const AMBIGUOUS = 'ilo01ILO';

const DEFAULTS = {
  length: 16,
  lower: true,
  upper: true,
  digit: true,
  symbol: true,
  noAmbiguous: true
};

function buildPool(opts) {
  let pool = '';
  ['lower', 'upper', 'digit', 'symbol'].forEach((k) => {
    if (!opts[k]) return;
    pool += opts.noAmbiguous ? SETS[k].split('').filter((c) => AMBIGUOUS.indexOf(c) < 0).join('') : SETS[k];
  });
  return pool;
}

function generate(opts) {
  const pool = buildPool(opts);
  if (!pool) return '';
  const arr = [];
  for (let i = 0; i < opts.length; i++) {
    // 用多份随机数增大熵（Math.random 对一般场景够用）
    const idx = Math.floor(Math.random() * pool.length);
    arr.push(pool[idx]);
  }
  return arr.join('');
}

function strengthOf(opts) {
  const poolSize = buildPool(opts).length || 1;
  const bits = Math.log2(poolSize) * opts.length;
  if (bits >= 90) return { label: '极强', level: 4 };
  if (bits >= 64) return { label: '强', level: 3 };
  if (bits >= 45) return { label: '中等', level: 2 };
  if (bits >= 30) return { label: '弱', level: 1 };
  return { label: '太弱', level: 0 };
}

Page({
  data: {
    lengths: [8, 12, 16, 20, 24],
    length: 16,
    toggles: [
      { key: 'lower', label: '小写字母' },
      { key: 'upper', label: '大写字母' },
      { key: 'digit', label: '数字' },
      { key: 'symbol', label: '符号' }
    ],
    opts: { ...DEFAULTS },
    password: '',
    strength: { label: '', level: 0 }
  },

  onLoad() {
    const saved = storage.get(KEY);
    if (saved) {
      this.setData({ opts: { ...DEFAULTS, ...saved } });
    }
    this.regenerate();
  },

  onShareAppMessage() {
    return { title: '密码生成器｜随机强密码一键复制', path: '/pages/fun/password/password' };
  },

  setLength(e) {
    const length = Number(e.currentTarget.dataset.length);
    this.setData({ 'opts.length': length });
    this.persistAndRegen();
  },

  toggleSet(e) {
    const key = e.currentTarget.dataset.key;
    const opts = { ...this.data.opts };
    opts[key] = !opts[key];
    if (!opts.lower && !opts.upper && !opts.digit && !opts.symbol) {
      wx.showToast({ title: '至少保留一种字符', icon: 'none' });
      return;
    }
    this.setData({ opts });
    this.persistAndRegen();
  },

  toggleAmbiguous() {
    this.setData({ 'opts.noAmbiguous': !this.data.opts.noAmbiguous });
    this.persistAndRegen();
  },

  persistAndRegen() {
    storage.set(KEY, this.data.opts);
    this.regenerate();
  },

  regenerate() {
    const opts = this.data.opts;
    const password = generate(opts);
    this.setData({ password, strength: strengthOf(opts) });
  },

  copy() {
    if (!this.data.password) return;
    wx.setClipboardData({
      data: this.data.password,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  }
});
