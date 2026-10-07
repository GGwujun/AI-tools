// 房贷计算器：等额本息 / 等额本金
const YEARS = [5, 10, 15, 20, 25, 30];

function calc(amount, ratePct, years, mode) {
  const p = amount * 10000;                 // 万元 -> 元
  const n = years * 12;
  const r = ratePct / 100 / 12;

  if (mode === 'equal-payment') {
    // 等额本息
    const pow = Math.pow(1 + r, n);
    const monthly = p * r * pow / (pow - 1);
    const totalPay = monthly * n;
    return {
      monthly: Math.round(monthly * 100) / 100,
      monthlyEnd: Math.round(monthly * 100) / 100,
      totalInterest: Math.round((totalPay - p) * 100) / 100,
      totalPay: Math.round(totalPay * 100) / 100
    };
  }

  // 等额本金
  const principalPerMonth = p / n;
  const first = principalPerMonth + p * r;
  const last = principalPerMonth + principalPerMonth * r;
  // 总利息 = 每期剩余本金利息之和 = p*r*(n+1)/2 / n?  推导：利息合计 = r * p * (n + 1) / 2 / 1? 用精确式
  const totalInterest = (first + last) / 2 * n - p;
  return {
    monthly: Math.round(first * 100) / 100,
    monthlyEnd: Math.round(last * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPay: Math.round((p + totalInterest) * 100) / 100
  };
}

function fmt(n) {
  return (Number(n) || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

Page({
  data: {
    years: YEARS,
    yearLabels: YEARS.map((y) => `${y}年(${y * 12}期)`),
    yearIndex: 3,
    amount: '100',
    rate: '3.6',
    mode: 'equal-payment',
    result: null
  },

  onShareAppMessage() {
    return { title: '房贷计算器｜月供利息一算便知', path: '/pages/fun/mortgage/mortgage' };
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value });
  },

  onRateInput(e) {
    this.setData({ rate: e.detail.value });
  },

  onYearChange(e) {
    this.setData({ yearIndex: Number(e.detail.value) });
  },

  onModeTap(e) {
    this.setData({ mode: e.currentTarget.dataset.mode });
  },

  start() {
    const amount = Number(this.data.amount);
    const rate = Number(this.data.rate);
    if (!(amount > 0) || amount > 10000) {
      wx.showToast({ title: '贷款金额 0.1~10000 万', icon: 'none' });
      return;
    }
    if (!(rate > 0 && rate < 15)) {
      wx.showToast({ title: '年利率请填 0~15', icon: 'none' });
      return;
    }
    const mode = this.data.mode;
    const raw = calc(amount, rate, YEARS[this.data.yearIndex], mode);
    this.setData({
      result: {
        isInterest: mode === 'equal-payment',
        monthly: fmt(raw.monthly),
        monthlyEnd: fmt(raw.monthlyEnd),
        monthlyDecay: Math.round((raw.monthly - raw.monthlyEnd) * 100) / 100,
        totalInterest: fmt(raw.totalInterest),
        totalPay: fmt(raw.totalPay),
        totalPrincipal: fmt(amount * 10000),
        months: YEARS[this.data.yearIndex] * 12
      }
    });
  }
});
