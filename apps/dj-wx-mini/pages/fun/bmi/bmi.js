// BMI 计算器：体重指数 + 中国标准分类 + 健康体重范围
// 中国成人标准（WS/T 428）：偏瘦 <18.5，正常 18.5~23.9，超重 24~27.9，肥胖 ≥28
const CATEGORIES = [
  { max: 18.5, label: '偏瘦', color: '#2f6df6', tip: '适当增加营养和力量训练' },
  { max: 24, label: '正常', color: '#10b981', tip: '保持得很好，继续保持！' },
  { max: 28, label: '超重', color: '#f59e0b', tip: '控制饮食 + 每周 150 分钟运动' },
  { max: Infinity, label: '肥胖', color: '#ef4444', tip: '建议制定减重计划，循序渐进' }
];

function calcBmi(heightCm, weightKg) {
  const h = heightCm / 100;
  return weightKg / (h * h);
}

function categoryOf(bmi) {
  return CATEGORIES.find((c) => bmi < c.max) || CATEGORIES[CATEGORIES.length - 1];
}

Page({
  data: {
    height: '170',
    weight: '65',
    gender: 'male',
    result: null
  },

  onShareAppMessage() {
    return { title: 'BMI 计算器｜你的体重标准吗', path: '/pages/fun/bmi/bmi' };
  },

  onHeightInput(e) {
    this.setData({ height: e.detail.value });
  },

  onWeightInput(e) {
    this.setData({ weight: e.detail.value });
  },

  onGenderTap(e) {
    this.setData({ gender: e.currentTarget.dataset.gender });
  },

  start() {
    const height = Number(this.data.height);
    const weight = Number(this.data.weight);
    if (!(height >= 100 && height <= 250)) {
      wx.showToast({ title: '身高请填 100~250 cm', icon: 'none' });
      return;
    }
    if (!(weight >= 20 && weight <= 300)) {
      wx.showToast({ title: '体重请填 20~300 kg', icon: 'none' });
      return;
    }
    const bmi = calcBmi(height, weight);
    const cat = categoryOf(bmi);
    const h = height / 100;
    const healthyMin = 18.5 * h * h;
    const healthyMax = 23.9 * h * h;
    // 健康体重中心 21.75 与当前体重差
    const targetWeight = 21.75 * h * h;
    const diff = weight - targetWeight;

    this.setData({
      result: {
        bmi: bmi.toFixed(1),
        label: cat.label,
        color: cat.color,
        tip: cat.tip,
        // 进度条位置：14~34 映射到 0~100%
        percent: Math.min(100, Math.max(0, ((bmi - 14) / 20) * 100)),
        healthyMin: healthyMin.toFixed(1),
        healthyMax: healthyMax.toFixed(1),
        diffText: Math.abs(diff) < 0.5 ? '正处在健康体重中心' :
          (diff > 0 ? `比健康体重中心重约 ${diff.toFixed(1)} kg` : `比健康体重中心轻约 ${(-diff).toFixed(1)} kg`)
      }
    });
  }
});
