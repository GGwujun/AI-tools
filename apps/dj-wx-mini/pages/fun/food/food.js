// 今天吃什么 - 转盘随机选 + 自定义菜单（存 storage）
const DEFAULT_FOODS = [
  '火锅', '麻辣烫', '螺蛳粉', '黄焖鸡', '兰州拉面', '沙县小吃', '麦当劳', '肯德基',
  '披萨', '寿司', '烧烤', '炸鸡', '水饺', '盖浇饭', '炒面', '煲仔饭',
  '酸菜鱼', '烤肉', '轻食沙拉', '冒菜', '米线', '煎饼果子', '肉夹馍', '汉堡'
];

const WHEEL_COLORS = ['#ff8a5c', '#ffb75c', '#7dd3a0', '#6db4f5', '#a78bfa', '#f472b6', '#f59e0b', '#34d399'];
const SEG = 45; // 8 等分

Page({
  data: {
    wheel: [],            // 上转盘的 8 项 {name, angle(文字旋转角), color}
    wheelBg: '',          // conic-gradient 内联样式
    rotateDeg: 0,
    spinning: false,
    result: '',
    customFoods: [],
    newFood: '',
    history: []
  },

  onLoad() {
    this._rotate = 0;
    const customFoods = wx.getStorageSync('funFoodCustom') || [];
    this.setData({ customFoods });
    this.buildWheel(customFoods);
  },

  // 自定义项排最前，凑满 8 项上盘
  buildWheel(customFoods) {
    const pool = customFoods.concat(DEFAULT_FOODS.filter((f) => customFoods.indexOf(f) < 0));
    const items = pool.slice(0, 8);
    const wheel = items.map((name, i) => ({
      name,
      angle: i * SEG + SEG / 2,
      color: WHEEL_COLORS[i % WHEEL_COLORS.length]
    }));
    const stops = wheel.map((w, i) => `${w.color} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(', ');
    this.setData({ wheel, wheelBg: `conic-gradient(from -90deg, ${stops})` });
  },

  spin() {
    if (this.data.spinning) return;
    const idx = Math.floor(Math.random() * this.data.wheel.length);
    const center = idx * SEG + SEG / 2;

    // 目标角度：让第 idx 区中心对准顶部指针（顺时针累加，保证持续多转几圈）
    const cur = this._rotate % 360;
    const delta = ((360 - center - cur) % 360 + 360) % 360;
    this._rotate += 360 * 5 + delta;

    this.setData({ spinning: true, result: '', rotateDeg: this._rotate });
    wx.vibrateShort({ type: 'light' });

    setTimeout(() => {
      const name = this.data.wheel[idx].name;
      const history = [name].concat(this.data.history.filter((h) => h !== name)).slice(0, 12);
      this.setData({ spinning: false, result: name, history });
      wx.vibrateShort({ type: 'heavy' });
    }, 3300);
  },

  onInput(e) {
    this.setData({ newFood: e.detail.value });
  },

  addFood() {
    const name = (this.data.newFood || '').trim();
    if (!name) return;
    if (name.length > 6) {
      wx.showToast({ title: '最多 6 个字，转盘放不下', icon: 'none' });
      return;
    }
    const customFoods = this.data.customFoods;
    if (customFoods.length >= 8) {
      wx.showToast({ title: '自定义最多 8 个（可替换默认菜单）', icon: 'none' });
      return;
    }
    if (customFoods.indexOf(name) >= 0 || DEFAULT_FOODS.indexOf(name) >= 0) {
      wx.showToast({ title: '菜单里已经有啦', icon: 'none' });
      return;
    }
    customFoods.push(name);
    wx.setStorageSync('funFoodCustom', customFoods);
    this.setData({ customFoods, newFood: '' });
    this.buildWheel(customFoods);
  },

  removeFood(e) {
    const name = e.currentTarget.dataset.name;
    const customFoods = this.data.customFoods.filter((f) => f !== name);
    wx.setStorageSync('funFoodCustom', customFoods);
    this.setData({ customFoods });
    this.buildWheel(customFoods);
  },

  onShareAppMessage() {
    return {
      title: this.data.result ? `今天吃「${this.data.result}」，就决定是你了！` : '选择困难症救星：今天吃什么',
      path: '/pages/fun/food/food'
    };
  }
});
