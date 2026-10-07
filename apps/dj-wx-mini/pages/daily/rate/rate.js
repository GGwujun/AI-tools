// 今日汇率：常用货币兑人民币 + 快捷换算
const api = require('../../../config/api');

Page({
  data: {
    rates: [],
    updatedAt: '',
    loading: true,
    error: '',
    // 换算器
    amount: '100',
    currencyIndex: 0,
    converted: '',
    currencyNames: []
  },

  onLoad() {
    this.fetch();
  },

  onShareAppMessage() {
    return { title: '今日汇率｜出国换汇心里有数', path: '/pages/daily/rate/rate' };
  },

  fetch() {
    this.setData({ loading: true, error: '' });
    wx.request({
      url: api.dailyRateApi,
      timeout: 30000,
      success: (res) => {
        const payload = res.data || {};
        if (res.statusCode === 200 && payload.code === 200 && payload.data) {
          const rates = payload.data.rates || [];
          // 列表展示 per 单位外币的人民币价钱（如 100 日元 = 4.24 元）
          rates.forEach((r) => {
            const v = r.per * r.rate;
            r.display = v >= 1 ? v.toFixed(2) : v.toFixed(4);
          });
          this.setData({
            rates,
            updatedAt: payload.data.updated_at || '',
            currencyNames: rates.map((r) => r.name)
          }, () => this.convert());
        } else {
          this.setData({ error: payload.message || '汇率数据暂时不可用' });
        }
      },
      fail: () => this.setData({ error: '网络异常，请稍后重试' }),
      complete: () => this.setData({ loading: false })
    });
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value }, () => this.convert());
  },

  onCurrencyChange(e) {
    this.setData({ currencyIndex: Number(e.detail.value) }, () => this.convert());
  },

  convert() {
    const rate = this.data.rates[this.data.currencyIndex];
    const amount = Number(this.data.amount);
    if (!rate || !(amount >= 0)) {
      this.setData({ converted: '' });
      return;
    }
    // 新浪 rate 是 1 单位外币兑人民币；per 只是展示倍数（日元韩元习惯看 100）
    const cny = amount * rate.rate;
    this.setData({ converted: cny.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') });
  },

  retry() {
    this.fetch();
  }
});
