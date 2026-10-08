// 房贷计算器：等额本息/等额本金月供计算 + 等额本息提前还款对比
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
  // 总利息 = 首末月利息均值 * 期数
  const totalInterest = (first + last) / 2 * n - p;
  return {
    monthly: Math.round(first * 100) / 100,
    monthlyEnd: Math.round(last * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPay: Math.round((p + totalInterest) * 100) / 100
  };
}

// 等额本息：第 k 期还完后的剩余本金
function balanceAfter(p, r, n, k) {
  const pow = Math.pow(1 + r, k);
  const monthly = p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  return p * pow - monthly * (pow - 1) / r;
}

function monthlyPayment(p, r, n) {
  const pow = Math.pow(1 + r, n);
  return p * r * pow / (pow - 1);
}

// 提前还款对比（等额本息）：还了 k 期后一次性提前还 X
function calcPrepay(amount, ratePct, years, paidMonths, prepayWan, afterMode) {
  const p = amount * 10000;
  const n = years * 12;
  const r = ratePct / 100 / 12;
  const k = paidMonths;
  const X = prepayWan * 10000;

  const M = monthlyPayment(p, r, n);                 // 原月供
  const B = balanceAfter(p, r, n, k);                // 剩余本金
  const B2 = B - X;                                  // 还款后剩余本金
  const restMonths = n - k;                          // 原剩余期数
  const oldRestInterest = M * restMonths - B;        // 原剩余利息

  let newMonthly;
  let newMonths;
  if (afterMode === 'shorten') {
    // 缩短期限：月供不变，求新期数  M = B2·r·(1+r)^m / ((1+r)^m − 1)
    newMonthly = M;
    const ratio = M / (M - B2 * r);
    newMonths = Math.max(1, Math.ceil(Math.log(ratio) / Math.log(1 + r)));
  } else {
    // 减少月供：期数不变，求新月供
    newMonths = restMonths;
    newMonthly = monthlyPayment(B2, r, restMonths);
  }
  const newRestInterest = newMonthly * newMonths - B2;
  const saved = oldRestInterest - newRestInterest;

  return {
    M: Math.round(M * 100) / 100,
    B: Math.round(B * 100) / 100,
    newMonthly: Math.round(newMonthly * 100) / 100,
    restMonths,
    newMonths,
    savedMonths: restMonths - newMonths,
    oldRestInterest: Math.round(oldRestInterest * 100) / 100,
    newRestInterest: Math.round(newRestInterest * 100) / 100,
    saved: Math.round(saved * 100) / 100
  };
}

function fmt(n) {
  return (Number(n) || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

Page({
  data: {
    tab: 'monthly',              // monthly 月供计算 | prepay 提前还款
    years: YEARS,
    yearLabels: YEARS.map((y) => `${y}年(${y * 12}期)`),
    yearIndex: 3,
    amount: '100',
    rate: '3.6',
    mode: 'equal-payment',
    // 提前还款
    paid: '24',                  // 已还期数
    prepay: '10',                // 提前还款额（万）
    after: 'shorten',            // shorten 缩短期限 | payment 减少月供
    result: null,
    prepayResult: null
  },

  onShareAppMessage() {
    return { title: '房贷计算器｜月供/提前还款一算便知', path: '/pages/fun/mortgage/mortgage' };
  },

  onTabTap(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
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

  onPaidInput(e) {
    this.setData({ paid: e.detail.value });
  },

  onPrepayInput(e) {
    this.setData({ prepay: e.detail.value });
  },

  onAfterTap(e) {
    this.setData({ after: e.currentTarget.dataset.after });
  },

  // 公共校验，返回 {amount, rate, n} 或 null
  validateBase() {
    const amount = Number(this.data.amount);
    const rate = Number(this.data.rate);
    if (!(amount > 0) || amount > 10000) {
      wx.showToast({ title: '贷款金额 0.1~10000 万', icon: 'none' });
      return null;
    }
    if (!(rate > 0 && rate < 15)) {
      wx.showToast({ title: '年利率请填 0~15', icon: 'none' });
      return null;
    }
    return { amount, rate, months: YEARS[this.data.yearIndex] * 12 };
  },

  start() {
    const base = this.validateBase();
    if (!base) return;
    const mode = this.data.mode;
    const raw = calc(base.amount, base.rate, YEARS[this.data.yearIndex], mode);
    this.setData({
      result: {
        isInterest: mode === 'equal-payment',
        monthly: fmt(raw.monthly),
        monthlyEnd: fmt(raw.monthlyEnd),
        monthlyDecay: Math.round((raw.monthly - raw.monthlyEnd) * 100) / 100,
        totalInterest: fmt(raw.totalInterest),
        totalPay: fmt(raw.totalPay),
        totalPrincipal: fmt(base.amount * 10000),
        months: base.months
      }
    });
  },

  startPrepay() {
    const base = this.validateBase();
    if (!base) return;
    if (this.data.mode !== 'equal-payment') {
      wx.showToast({ title: '提前还款对比暂只支持等额本息', icon: 'none' });
      return;
    }
    const paid = Math.floor(Number(this.data.paid));
    const prepay = Number(this.data.prepay);
    if (!(paid >= 1) || paid >= base.months) {
      wx.showToast({ title: `已还期数需在 1~${base.months - 1}`, icon: 'none' });
      return;
    }
    if (!(prepay >= 0.1)) {
      wx.showToast({ title: '提前还款额至少 0.1 万', icon: 'none' });
      return;
    }
    // 先算剩余本金做校验，避免还款额超过本金时 calcPrepay 内部出现 NaN
    const balance = balanceAfter(
      base.amount * 10000, base.rate / 100 / 12, base.months, paid);
    if (balance - prepay * 10000 <= 0) {
      wx.showToast({ title: '还款额不能超过剩余本金', icon: 'none' });
      return;
    }
    const raw = calcPrepay(base.amount, base.rate, YEARS[this.data.yearIndex],
      paid, prepay, this.data.after);
    const isShorten = this.data.after === 'shorten';
    this.setData({
      prepayResult: {
        isShorten,
        saved: fmt(raw.saved),
        savedMonths: raw.savedMonths,
        monthly: fmt(raw.M),
        newMonthly: fmt(raw.newMonthly),
        restMonths: raw.restMonths,
        newMonths: raw.newMonths,
        oldRestInterest: fmt(raw.oldRestInterest),
        newRestInterest: fmt(raw.newRestInterest),
        remaining: fmt(raw.B - prepay * 10000)
      }
    });
  }
});
