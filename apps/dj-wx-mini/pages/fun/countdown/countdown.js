// 倒数日：考试、放假、节日倒计时，常用节日一键添加
const storage = require('../../../utils/safe-storage');

const KEY = 'funCountdowns';
const DAY_MS = 24 * 60 * 60 * 1000;

// 固定公历日期的常用倒数日（春节/清明等农历节日日期每年变，不硬编码）
const PRESETS = [
  { name: '元旦', md: '01-01', icon: '🎉' },
  { name: '情人节', md: '02-14', icon: '🌹' },
  { name: '五一劳动节', md: '05-01', icon: '🧳' },
  { name: '高考', md: '06-07', icon: '✏️' },
  { name: '国庆节', md: '10-01', icon: '🇨🇳' },
  { name: '双十一', md: '11-11', icon: '🛒' },
  { name: '圣诞节', md: '12-25', icon: '🎄' }
];

function todayZero() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

// 每年重复的下一个发生日期
function nextOccur(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const today = todayZero();
  const thisYear = new Date().getFullYear();
  let candidate = new Date(thisYear, m - 1, d).getTime();
  if (candidate < today) {
    candidate = new Date(thisYear + 1, m - 1, d).getTime();
  }
  return candidate;
}

function daysTo(occur) {
  return Math.round((occur - todayZero()) / DAY_MS);
}

function decorate(item) {
  const occur = item.repeat === 'yearly' ? nextOccur(item.date) : new Date(item.date).getTime();
  const days = daysTo(occur);
  let badge;
  if (days > 0) badge = `还有 ${days} 天`;
  else if (days === 0) badge = '就是今天！';
  else badge = '已过期';
  return {
    id: item.id,
    name: item.name,
    date: item.date,
    repeat: item.repeat,
    repeatLabel: item.repeat === 'yearly' ? '每年' : '一次',
    days,
    badge,
    isToday: days === 0,
    sortKey: days < 0 ? 100000 + days : days
  };
}

Page({
  data: {
    presets: [],
    items: [],
    adding: false,
    formName: '',
    formDate: '',
    formRepeat: 'yearly',
    todayLabel: ''
  },

  onLoad() {
    const now = new Date();
    this.setData({ todayLabel: `${now.getMonth() + 1}月${now.getDate()}日` });
    this.refresh();
  },

  onShow() {
    this.refresh();
  },

  onShareAppMessage(e) {
    const nearest = this.data.items.filter((i) => i.days >= 0)[0] || this.data.items[0];
    const ds = (e && e.target && e.target.dataset) || {};
    if (ds.name) {
      return {
        title: `距离${ds.name}还有 ${ds.days} 天`,
        path: '/pages/fun/countdown/countdown'
      };
    }
    return {
      title: nearest ? `距离${nearest.name}还有 ${nearest.days} 天` : '倒数日｜考试放假倒计时',
      path: '/pages/fun/countdown/countdown'
    };
  },

  refresh() {
    const raw = storage.get(KEY) || [];
    const items = raw.map(decorate).sort((a, b) => a.sortKey - b.sortKey);
    const names = raw.map((i) => i.name);
    const presets = PRESETS.map((p) => {
      const date = this.nextDateStr(p.md);
      return {
        ...p,
        date,
        days: daysTo(nextOccur(date)),
        added: names.indexOf(p.name) >= 0
      };
    }).sort((a, b) => a.days - b.days);
    this.setData({ items, presets });
  },

  addPreset(e) {
    const name = e.currentTarget.dataset.name;
    const raw = storage.get(KEY) || [];
    if (raw.some((i) => i.name === name)) {
      wx.showToast({ title: '已经在列表里啦', icon: 'none' });
      return;
    }
    const preset = PRESETS.find((p) => p.name === name);
    raw.push({ id: Date.now(), name, date: preset ? this.nextDateStr(preset.md) : '', repeat: 'yearly' });
    storage.set(KEY, raw);
    this.refresh();
    wx.showToast({ title: '已添加' });
  },

  nextDateStr(md) {
    const year = new Date().getFullYear();
    const dateStr = `${year}-${md}`;
    return daysTo(nextOccur(dateStr)) >= 0 ? dateStr : `${year + 1}-${md}`;
  },

  toggleAdd() {
    this.setData({ adding: !this.data.adding, formName: '', formDate: '', formRepeat: 'yearly' });
  },

  onNameInput(e) {
    this.setData({ formName: e.detail.value || '' });
  },

  onDateChange(e) {
    this.setData({ formDate: e.detail.value });
  },

  onRepeatTap(e) {
    this.setData({ formRepeat: e.currentTarget.dataset.repeat });
  },

  saveItem() {
    const name = this.data.formName.trim();
    const date = this.data.formDate;
    if (!name) {
      wx.showToast({ title: '先写个名字，如：考研', icon: 'none' });
      return;
    }
    if (!date) {
      wx.showToast({ title: '选一下日期', icon: 'none' });
      return;
    }
    const raw = storage.get(KEY) || [];
    raw.push({ id: Date.now(), name: name.slice(0, 20), date, repeat: this.data.formRepeat });
    storage.set(KEY, raw);
    this.setData({ adding: false, formName: '', formDate: '' });
    this.refresh();
    wx.showToast({ title: '已添加' });
  },

  removeItem(e) {
    const id = Number(e.currentTarget.dataset.id);
    const item = this.data.items.find((i) => i.id === id);
    wx.showModal({
      title: '删除倒数日',
      content: `确定删除「${item ? item.name : ''}」吗？`,
      success: (res) => {
        if (!res.confirm) return;
        storage.set(KEY, (storage.get(KEY) || []).filter((i) => i.id !== id));
        this.refresh();
      }
    });
  }
});
