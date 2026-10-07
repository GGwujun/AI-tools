// MBTI 趣味测试 - 32 题出 16 型，完整解析看激励视频解锁（一次解锁永久有效）
const api = require('../../../config/api');
const { QUESTIONS, TYPES } = require('./mbti-data');

const DIM_LABELS = { EI: '外向 E / 内向 I', SN: '实感 S / 直觉 N', TF: '思考 T / 情感 F', JP: '判断 J / 感知 P' };

Page({
  data: {
    phase: 'quiz',        // quiz | result
    qIndex: 0,
    total: QUESTIONS.length,
    question: QUESTIONS[0],
    answers: {},          // dim -> {A:0,B:0} 计数
    result: null,         // {code, type, dims:[{dim,label,left,right,pctLeft,pctRight}]}
    unlocked: false,
    adLoading: false
  },

  onLoad() {
    this.setData({ unlocked: !!wx.getStorageSync('funMbtiUnlocked') });
    this.initAd();
  },

  initAd() {
    if (!api.adUnitId || this._ad) return;
    this._ad = wx.createRewardedVideoAd({ adUnitId: api.adUnitId });
    this._ad.onError(() => {
      this.setData({ adLoading: false });
    });
  },

  choose(e) {
    const { question, qIndex, answers } = this.data;
    const side = e.currentTarget.dataset.side; // 'a' | 'b'
    const letter = side === 'a' ? question.va : question.vb;

    const dim = answers[question.dim] || { A: 0, B: 0 };
    dim[side.toUpperCase()] += 1;
    answers[question.dim] = dim;

    if (qIndex + 1 >= QUESTIONS.length) {
      this.finish(answers);
      return;
    }
    this.setData({
      answers,
      qIndex: qIndex + 1,
      question: QUESTIONS[qIndex + 1]
    });
  },

  finish(answers) {
    let code = '';
    const dims = [];
    const pairs = [
      ['EI', 'E', 'I'],
      ['SN', 'S', 'N'],
      ['TF', 'T', 'F'],
      ['JP', 'J', 'P']
    ];
    for (const [dim, L, R] of pairs) {
      const c = answers[dim] || { A: 0, B: 0 };
      // A 选项 = 左字母，B 选项 = 右字母
      const leftCount = c.A;
      const rightCount = c.B;
      code += leftCount >= rightCount ? L : R;
      const total = leftCount + rightCount || 1;
      dims.push({
        dim,
        label: DIM_LABELS[dim],
        left: L, right: R,
        leftCount, rightCount,
        pctLeft: Math.round(leftCount / total * 100)
      });
    }
    const type = TYPES[code];
    this.setData({
      phase: 'result',
      result: { code, type, dims }
    });
  },

  unlock() {
    if (this.data.unlocked) return;
    if (!this._ad) {
      // 本地环境无广告位：直接解锁
      wx.setStorageSync('funMbtiUnlocked', true);
      this.setData({ unlocked: true });
      return;
    }
    this.setData({ adLoading: true });
    this._ad.show()
      .then(() => {
        this.setData({ adLoading: false });
      })
      .catch(() => {
        // 广告还没加载好，手动拉一次再展示
        this._ad.load()
          .then(() => this._ad.show())
          .catch(() => {
            this.setData({ adLoading: false });
            wx.showToast({ title: '广告加载失败，稍后再试', icon: 'none' });
          });
      });

    if (!this._adCb) {
      this._adCb = (res) => {
        if (res && res.isEnded) {
          wx.setStorageSync('funMbtiUnlocked', true);
          this.setData({ unlocked: true });
          wx.showToast({ title: '已解锁完整报告', icon: 'success' });
        }
      };
      this._ad.onClose(this._adCb);
    }
  },

  restart() {
    this.setData({
      phase: 'quiz',
      qIndex: 0,
      question: QUESTIONS[0],
      answers: {},
      result: null
    });
  },

  onShareAppMessage() {
    const r = this.data.result;
    return {
      title: r ? `我是 ${r.code} ${r.type.name}｜${r.type.tagline}，来测测你是什么人格` : 'MBTI 16 型人格趣味测试，超准！',
      path: '/pages/fun/mbti/mbti'
    };
  }
});
