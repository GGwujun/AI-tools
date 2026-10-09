// 今日金价 - 国际/上海实时金价 + 克价换算
const api = require('../../../config/api');

const OZ = 31.1035; // 1 金衡盎司 = 31.1035 克

Page({
  data: {
    loading: true,
    intl: null,       // {price, change, change_pct, unit, name, time, date}
    sh: null,
    usdcny: null,
    updatedAt: '',
    convertedGram: '',  // 国际金折算 元/克
    // 换算器
    grams: '',
    calcResult: ''
  },

  onLoad() {
    this.fetch();
  },

  onPullDownRefresh() {
    this.fetch(() => wx.stopPullDownRefresh());
  },

  fetch(done) {
    wx.request({
      url: api.dailyGoldApi,
      timeout: 15000,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.code === 200) {
          const d = res.data.data || {};
          const intl = this.decorate(d.intl);
          const sh = this.decorate(d.sh);
          let convertedGram = '';
          if (intl && d.usdcny) {
            const v = intl.price / OZ * d.usdcny;
            convertedGram = v.toFixed(2);
          }
          this.setData({
            loading: false,
            intl, sh,
            usdcny: d.usdcny,
            updatedAt: d.updated_at || '',
            convertedGram
          });
        } else {
          this.fail((res.data && res.data.message) || '金价获取失败');
        }
      },
      fail: () => this.fail('网络请求失败'),
      complete: () => done && done()
    });
  },

  // 涨跌展示字段：dir = up/down/flat，格式化文本
  decorate(q) {
    // 价格为 0 视为无效（数据源异常时段），整卡隐藏而不是显示 0.00
    if (!q || q.price == null || !(q.price > 0)) return null;
    const pct = q.change_pct;
    const dir = pct > 0 ? 'up' : (pct < 0 ? 'down' : 'flat');
    return Object.assign({}, q, {
      priceText: q.price.toFixed(2),
      changeText: (q.change != null ? (q.change > 0 ? '+' : '') + q.change.toFixed(2) : '--'),
      pctText: pct != null ? (pct > 0 ? '+' : '') + pct.toFixed(2) + '%' : '--',
      dir,
      arrow: dir === 'up' ? '↑' : (dir === 'down' ? '↓' : '')
    });
  },

  fail(msg) {
    this.setData({ loading: false });
    wx.showToast({ title: msg, icon: 'none' });
  },

  onGramsInput(e) {
    const grams = e.detail.value;
    const sh = this.data.sh;
    let calcResult = '';
    const n = parseFloat(grams);
    if (n > 0 && sh && sh.price) {
      calcResult = (n * sh.price).toFixed(2);
    }
    this.setData({ grams, calcResult });
  },

  onShareAppMessage() {
    return {
      title: this.data.intl ? `今日金价 | 国际金 ${this.data.intl.priceText} 美元/盎司` : '今日金价实时查询',
      path: '/pages/daily/gold/gold'
    };
  }
});
