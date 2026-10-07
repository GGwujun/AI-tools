// 朝霞/晚霞火烧云预测 - 云量数据 + 日出日落时间
const api = require('../../../config/api');

// 等级 -> 展示色
const GRADE_STYLE = {
  '爆表级': 'g-max',
  '大烧': 'g-big',
  '中等': 'g-mid',
  '微烧': 'g-small',
  '不烧': 'g-none'
};

Page({
  data: {
    // 地点（默认长沙，支持记忆）
    lat: 28.2282,
    lng: 112.9388,
    placeName: '长沙',
    mode: 'sunrise',   // sunrise=朝霞 sunset=晚霞
    day: 'tomorrow',   // today / tomorrow
    loading: false,
    result: null,      // 后端返回的 data
    gradeClass: '',
    countdownText: ''
  },

  onLoad() {
    const saved = wx.getStorageSync('dailySunsetLoc');
    if (saved && saved.lat) {
      this.setData({ lat: saved.lat, lng: saved.lng, placeName: saved.name || '自定义地点' });
    }
    this.fetch();
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        if (res.latitude && res.longitude) {
          const loc = { lat: res.latitude, lng: res.longitude, name: res.name || res.address || '自定义地点' };
          wx.setStorageSync('dailySunsetLoc', loc);
          this.setData({ lat: loc.lat, lng: loc.lng, placeName: loc.name });
          this.fetch();
        }
      },
      fail: (err) => {
        // 用户取消不提示；权限拒绝给引导
        if (err && err.errMsg && err.errMsg.indexOf('auth') >= 0) {
          wx.showModal({
            title: '需要位置权限',
            content: '请在设置中允许使用位置信息，用于选择观测地点',
            confirmText: '去设置',
            success: (r) => r.confirm && wx.openSetting()
          });
        }
      }
    });
  },

  setMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.mode) return;
    this.setData({ mode });
    this.fetch();
  },

  setDay(e) {
    const day = e.currentTarget.dataset.day;
    if (day === this.data.day) return;
    this.setData({ day });
    this.fetch();
  },

  fetch() {
    this.setData({ loading: true, result: null });
    wx.request({
      url: api.dailySunsetApi,
      data: {
        lat: this.data.lat,
        lng: this.data.lng,
        mode: this.data.mode,
        day: this.data.day
      },
      timeout: 25000,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.code === 200) {
          const d = res.data.data;
          // 小时行补充样式宽度
          const hours = (d.hours || []).map((h) => Object.assign({}, h, {
            lowW: h.low != null ? h.low : 0,
            midW: h.mid != null ? h.mid : 0,
            highW: h.high != null ? h.high : 0,
            sText: h.s
          }));
          this.setData({
            loading: false,
            result: Object.assign({}, d, { hours }),
            gradeClass: GRADE_STYLE[d.grade] || 'g-none',
            countdownText: this.fmtCountdown(d.countdown)
          });
        } else {
          this.fail((res.data && res.data.message) || '预测获取失败');
        }
      },
      fail: () => this.fail('网络请求失败')
    });
  },

  fmtCountdown(sec) {
    if (sec == null) return '';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h} 小时 ${m} 分钟后`;
    if (m > 0) return `${m} 分钟后`;
    return '即将到来';
  },

  fail(msg) {
    this.setData({ loading: false });
    wx.showToast({ title: msg, icon: 'none' });
  },

  onShareAppMessage() {
    const r = this.data.result;
    return {
      title: r ? `${this.data.placeName}明天${r.mode === 'sunrise' ? '朝霞' : '晚霞'}火烧云指数 ${r.score} 分（${r.grade}）` : '朝霞晚霞火烧云预测，摄影人必备',
      path: '/pages/daily/sunset/sunset'
    };
  }
});
