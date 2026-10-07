// 今日油价 - 31 省汽柴油价格 + 调价窗口提醒
const api = require('../../../config/api');

Page({
  data: {
    loading: true,
    provinces: [],
    source: '',
    updatedAt: '',
    lastAdj: '',
    nextAdj: '',
    nextAdjDays: '',
    current: null,   // 当前选中省份
    currentIndex: 0
  },

  onLoad() {
    this.fetch();
  },

  onPullDownRefresh() {
    this.fetch(() => wx.stopPullDownRefresh());
  },

  fetch(done) {
    wx.request({
      url: api.dailyOilApi,
      timeout: 20000,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.code === 200) {
          const d = res.data.data || {};
          const provinces = (d.provinces || []).map((p) => Object.assign({}, p, {
            p92Text: p.p92 != null ? p.p92.toFixed(2) : '--',
            p95Text: p.p95 != null ? p.p95.toFixed(2) : '--',
            p0Text: p.p0 != null ? p.p0.toFixed(2) : '--',
            p98Text: p.p98 != null ? p.p98.toFixed(2) : null
          }));

          // 记住上次选的省，否则默认北京
          let idx = 0;
          const last = wx.getStorageSync('dailyOilProv');
          if (last) {
            const i = provinces.findIndex((p) => p.prov === last);
            if (i >= 0) idx = i;
          }

          this.setData({
            loading: false,
            provinces,
            source: d.source || '',
            updatedAt: (d.updated_at || '').slice(0, 10),
            lastAdj: d.last_adj || '',
            nextAdj: d.next_adj || '',
            nextAdjDays: this.calcDays(d.next_adj),
            current: provinces[idx] || null,
            currentIndex: idx
          });
        } else {
          this.fail((res.data && res.data.message) || '油价获取失败');
        }
      },
      fail: () => this.fail('网络请求失败'),
      complete: () => done && done()
    });
  },

  fail(msg) {
    this.setData({ loading: false });
    wx.showToast({ title: msg, icon: 'none' });
  },

  calcDays(dateStr) {
    if (!dateStr) return '';
    const t = new Date(dateStr + 'T00:00:00+08:00').getTime();
    if (isNaN(t)) return '';
    const days = Math.ceil((t - Date.now()) / 86400000);
    if (days > 0) return `还有 ${days} 天`;
    if (days === 0) return '就在今天';
    return '已过';
  },

  selectProv(e) {
    const idx = e.currentTarget.dataset.index;
    const p = this.data.provinces[idx];
    if (!p) return;
    wx.setStorageSync('dailyOilProv', p.prov);
    this.setData({ current: p, currentIndex: idx });
  },

  onShareAppMessage() {
    return {
      title: `今日油价 | ${this.data.current ? this.data.current.prov + ' 92#' + this.data.current.p92Text + ' 元/升' : '31 省汽柴油价查询'}`,
      path: '/pages/daily/oil/oil'
    };
  }
});
