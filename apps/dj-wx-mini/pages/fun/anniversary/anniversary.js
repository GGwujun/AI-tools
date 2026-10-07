// 纪念日倒数：生日、纪念日、重要日子倒计时
const storage = require('../../../utils/safe-storage');

const KEY = 'funAnniversaries';

const DAY_MS = 24 * 60 * 60 * 1000;

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
  // 2月29日 在平年落到 3月1日，可接受
  if (candidate < today) {
    candidate = new Date(thisYear + 1, m - 1, d).getTime();
  }
  return candidate;
}

function decorate(item, index) {
  const today = todayZero();
  const occur = item.repeat === 'yearly' ? nextOccur(item.date) : new Date(item.date).getTime();
  const days = Math.round((occur - today) / DAY_MS);
  let badge;
  if (days > 0) {
    badge = `还有 ${days} 天`;
  } else if (days === 0) {
    badge = '就是今天！';
  } else if (item.repeat === 'yearly') {
    badge = `还有 ${days + 365} 天`;  // 理论到不了，兜底
  } else {
    badge = `已过 ${-days} 天`;
  }
  return {
    id: item.id,
    name: item.name,
    date: item.date,
    repeat: item.repeat,
    repeatLabel: item.repeat === 'yearly' ? '每年' : '一次',
    days,
    badge,
    isToday: days === 0,
    sortKey: days < 0 && item.repeat !== 'yearly' ? 100000 + days : days
  };
}

Page({
  data: {
    items: [],
    adding: false,
    formName: '',
    formDate: '',
    todayStr: '',
    todayLabel: ''
  },

  onLoad() {
    const now = new Date();
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    this.setData({
      todayStr: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      todayLabel: `${now.getMonth() + 1}月${now.getDate()}日`
    });
    this.refresh();
  },

  onShow() {
    this.refresh();
  },

  onShareAppMessage() {
    return { title: '纪念日倒数｜重要日子不错过', path: '/pages/fun/anniversary/anniversary' };
  },

  refresh() {
    const raw = storage.get(KEY) || [];
    const items = raw.map(decorate).sort((a, b) => a.sortKey - b.sortKey);
    this.setData({ items });
  },

  toggleAdd() {
    this.setData({ adding: !this.data.adding, formName: '', formDate: '' });
  },

  onNameInput(e) {
    this.setData({ formName: e.detail.value || '' });
  },

  onDateChange(e) {
    this.setData({ formDate: e.detail.value });
  },

  onRepeatTap(e) {
    // 简化：默认每年；一次性的用开关
  },

  saveItem() {
    const name = this.data.formName.trim();
    const date = this.data.formDate;
    if (!name) {
      wx.showToast({ title: '先写个名字', icon: 'none' });
      return;
    }
    if (!date) {
      wx.showToast({ title: '选一下日期', icon: 'none' });
      return;
    }
    const raw = storage.get(KEY) || [];
    raw.push({ id: Date.now(), name: name.slice(0, 20), date, repeat: 'yearly' });
    storage.set(KEY, raw);
    this.setData({ adding: false, formName: '', formDate: '' });
    this.refresh();
    wx.showToast({ title: '已添加' });
  },

  removeItem(e) {
    const id = Number(e.currentTarget.dataset.id);
    const item = this.data.items.find((i) => i.id === id);
    wx.showModal({
      title: '删除纪念日',
      content: `确定删除「${item ? item.name : ''}」吗？`,
      success: (res) => {
        if (!res.confirm) return;
        const raw = (storage.get(KEY) || []).filter((i) => i.id !== id);
        storage.set(KEY, raw);
        this.refresh();
      }
    });
  }
});
