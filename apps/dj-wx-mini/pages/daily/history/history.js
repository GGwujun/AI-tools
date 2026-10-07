// 历史上的今天：按日期看大事记
const api = require('../../../config/api');

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function todayStr() {
  const now = new Date();
  return `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function label(mmdd) {
  const [mm, dd] = mmdd.split('-');
  return `${Number(mm)}月${Number(dd)}日`;
}

Page({
  data: {
    date: '',
    dateLabel: '',
    isToday: true,
    events: [],
    source: '',
    loading: false,
    error: ''
  },

  onLoad() {
    this.load(todayStr());
  },

  onShareAppMessage() {
    return {
      title: `历史上的${label(this.data.date || todayStr())}，天天有故事`,
      path: '/pages/daily/history/history'
    };
  },

  load(mmdd) {
    this.setData({ date: mmdd, dateLabel: label(mmdd), isToday: mmdd === todayStr(),
                   loading: true, error: '', events: [] });
    wx.request({
      url: `${api.dailyHistoryApi}?date=${mmdd}`,
      timeout: 30000,
      success: (res) => {
        const payload = res.data || {};
        if (res.statusCode === 200 && payload.code === 200 && payload.data) {
          this.setData({ events: payload.data.events || [], source: payload.data.source || '' });
        } else {
          this.setData({ error: payload.message || '数据暂时拿不到，稍后再试' });
        }
      },
      fail: () => this.setData({ error: '网络异常，请稍后重试' }),
      complete: () => this.setData({ loading: false })
    });
  },

  shiftDay(e) {
    const delta = Number(e.currentTarget.dataset.delta);
    const [mm, dd] = this.data.date.split('-').map(Number);
    // 用 2024（闰年）做基准，2 月 29 日也能正确进退
    const d = new Date(2024, mm - 1, dd + delta);
    this.load(`${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  },

  goToday() {
    this.load(todayStr());
  }
});
