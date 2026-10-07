// 字中找字 - 从大字里找出藏着的子字（部件拆字），找齐过关
// 题库手工校验：真项均可在原字部件中找到，干扰项刻意避开形近争议
const LEVELS = [
  { big: '赢', found: ['亡', '口', '月', '贝', '凡'], decoys: ['云', '天', '人', '元', '只', '木'] },
  { big: '章', found: ['立', '日', '十', '早', '音'], decoys: ['口', '米', '竹', '天', '只', '石'] },
  { big: '照', found: ['日', '口', '刀', '召', '昭'], decoys: ['目', '山', '白', '门', '风', '里'] },
  { big: '森', found: ['木', '林', '十', '八'], decoys: ['人', '千', '才', '寸', '个', '天'] },
  { big: '鑫', found: ['金', '人', '王', '十', '一'], decoys: ['只', '上', '下', '中', '文', '六'] },
  { big: '德', found: ['直', '心', '十', '目', '一'], decoys: ['王', '行', '水', '田', '云', '风'] },
  { big: '魏', found: ['委', '鬼', '女', '禾'], decoys: ['尾', '云', '人', '田', '山', '川'] },
  { big: '湖', found: ['古', '月', '胡', '口', '十'], decoys: ['日', '用', '明', '水', '石', '品'] },
  { big: '想', found: ['相', '木', '目', '心', '八'], decoys: ['白', '田', '人', '思', '念', '手'] },
  { big: '盟', found: ['明', '日', '月', '皿'], decoys: ['目', '生', '王', '血', '星', '光'] },
  { big: '香', found: ['禾', '日', '木', '十'], decoys: ['月', '目', '和', '秀', '言', '星'] },
  { big: '雷', found: ['雨', '田', '十'], decoys: ['雪', '电', '山', '王', '器', '风'] }
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

Page({
  data: {
    levelIndex: 0,
    totalLevels: LEVELS.length,
    score: 0,
    wrongCount: 0,
    bigChar: '',
    options: [],        // {char, state: ''|'hit'|'miss'}
    foundCount: 0,
    targetCount: 0,
    showPass: false,
    showFinish: false,
    startTime: 0,
    usedTime: ''
  },

  onLoad() {
    this.startGame();
  },

  startGame() {
    this.setData({
      levelIndex: 0,
      score: 0,
      wrongCount: 0,
      showPass: false,
      showFinish: false,
      startTime: Date.now()
    });
    this.loadLevel(0);
  },

  loadLevel(idx) {
    const lv = LEVELS[idx];
    const options = shuffle(lv.found.concat(lv.decoys)).map((c) => ({
      char: c,
      state: '',
      isReal: lv.found.indexOf(c) >= 0
    }));
    this.setData({
      bigChar: lv.big,
      options,
      foundCount: 0,
      targetCount: lv.found.length,
      showPass: false
    });
  },

  tapOption(e) {
    const i = e.currentTarget.dataset.index;
    const opt = this.data.options[i];
    if (!opt || opt.state === 'hit' || this.data.showPass || this.data.showFinish) return;

    if (opt.isReal) {
      // 找对：+10
      this.setData({
        [`options[${i}].state`]: 'hit',
        score: this.data.score + 10,
        foundCount: this.data.foundCount + 1
      });
      wx.vibrateShort({ type: 'light' });
      if (this.data.foundCount + 1 >= this.data.targetCount) {
        // 过关
        setTimeout(() => {
          if (this.data.levelIndex + 1 >= LEVELS.length) {
            const sec = Math.round((Date.now() - this.data.startTime) / 1000);
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            this.setData({
              showFinish: true,
              usedTime: m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`
            });
          } else {
            this.setData({ showPass: true });
          }
        }, 400);
      }
    } else {
      // 找错：-5，红闪
      const score = Math.max(0, this.data.score - 5);
      this.setData({
        [`options[${i}].state`]: 'miss',
        score,
        wrongCount: this.data.wrongCount + 1
      });
      wx.vibrateShort({ type: 'heavy' });
      setTimeout(() => {
        this.setData({ [`options[${i}].state`]: '' });
      }, 500);
    }
  },

  nextLevel() {
    const idx = this.data.levelIndex + 1;
    this.setData({ levelIndex: idx });
    this.loadLevel(idx);
  },

  onShareAppMessage() {
    return {
      title: `字中找字我拿了 ${this.data.score} 分，一个"赢"字里藏着 5 个字你能找到吗`,
      path: '/pages/fun/findchar/findchar'
    };
  }
});
