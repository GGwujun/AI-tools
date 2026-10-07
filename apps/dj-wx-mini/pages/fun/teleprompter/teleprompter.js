// 提词器：粘贴文案 → 全屏滚动字幕，拍摄时照着念
const storage = require('../../../utils/safe-storage');

const TEXT_KEY = 'teleprompterText';
const FONT_STEPS = [40, 52, 64, 80, 100];       // rpx
const SPEED_STEPS = [0.8, 1.4, 2.2, 3.2, 4.5];  // px / 30ms
const SPEED_LABELS = ['很慢', '慢', '中', '快', '很快'];
const TICK_MS = 30;

Page({
  data: {
    mode: 'edit',          // edit | play
    text: '',
    fontIndex: 2,
    speedIndex: 2,
    speedLabel: '中',
    fontRpx: FONT_STEPS[2],
    // 播放态
    statusBarHeight: 20,
    paused: false,
    finished: false,
    offsetY: 0,
    progress: 0
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : {};
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      text: storage.get(TEXT_KEY) || '',
      fontIndex: this.loadSetting('teleprompterFont', 2, FONT_STEPS.length),
      speedIndex: this.loadSetting('teleprompterSpeed', 2, SPEED_STEPS.length)
    }, () => this.applySteps());
  },

  loadSetting(key, dflt, len) {
    const v = Number(storage.get(key));
    return Number.isInteger(v) && v >= 0 && v < len ? v : dflt;
  },

  applySteps() {
    const { fontIndex, speedIndex } = this.data;
    this.setData({
      fontRpx: FONT_STEPS[fontIndex],
      speedLabel: SPEED_LABELS[speedIndex]
    });
  },

  onUnload() {
    this.stopTimer();
    this.keepScreen(false);
  },

  onHide() {
    if (this.data.mode === 'play') this.setData({ paused: true });
  },

  onShareAppMessage() {
    return {
      title: '提词器｜拍视频神器',
      path: '/pages/fun/teleprompter/teleprompter'
    };
  },

  // ------------------------------------------------------------------ 编辑

  onTextInput(e) {
    this.setData({ text: e.detail.value || '' });
  },

  onFontTap(e) {
    const fontIndex = Number(e.currentTarget.dataset.index);
    this.setData({ fontIndex });
    this.applySteps();
    storage.set('teleprompterFont', fontIndex);
  },

  onSpeedTap(e) {
    const speedIndex = Number(e.currentTarget.dataset.index);
    this.setData({ speedIndex });
    this.applySteps();
    storage.set('teleprompterSpeed', speedIndex);
  },

  // ------------------------------------------------------------------ 播放

  startPlay() {
    const text = this.data.text.trim();
    if (!text) {
      wx.showToast({ title: '先输入或粘贴文案', icon: 'none' });
      return;
    }
    storage.set(TEXT_KEY, this.data.text);
    this.keepScreen(true);
    this.setData({ mode: 'play', paused: false, finished: false, offsetY: 0, progress: 0 });
    // 等播放视图渲染完再量高度
    setTimeout(() => this.measureAndRun(), 200);
  },

  measureAndRun() {
    const query = wx.createSelectorQuery();
    query.select('.script-viewport').boundingClientRect();
    query.select('.script-text').boundingClientRect();
    query.exec((res) => {
      const viewport = res && res[0];
      const content = res && res[1];
      if (!viewport || !content) {
        wx.showToast({ title: '初始化失败，请重试', icon: 'none' });
        return;
      }
      this.viewportH = viewport.height;
      this.contentH = content.height;
      // 文案从屏幕下方 80% 处滚入，念完自然停在屏幕上方
      this.startOffset = Math.round(this.viewportH * 0.8);
      this.setData({ offsetY: this.startOffset });
      this.startTimer();
    });
  },

  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => {
      if (this.data.paused || this.data.finished) return;
      let offset = this.data.offsetY - SPEED_STEPS[this.data.speedIndex];
      const end = -(this.contentH || 0) - 40;
      if (offset <= end) {
        offset = end;
        this.stopTimer();
        this.setData({ offsetY: offset, finished: true, progress: 100 });
        wx.showToast({ title: '文案已播完', icon: 'none' });
        return;
      }
      const total = (this.startOffset || 1) + Math.max(this.contentH, 1);
      const done = ((this.startOffset || 0) - offset) / total;
      this.setData({ offsetY: offset, progress: Math.round(done * 100) });
    }, TICK_MS);
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  togglePause() {
    if (this.data.finished) return;
    this.setData({ paused: !this.data.paused });
  },

  restart() {
    this.setData({ paused: false, finished: false, offsetY: this.startOffset || 0, progress: 0 });
    this.startTimer();
  },

  stopPlay() {
    this.stopTimer();
    this.keepScreen(false);
    this.setData({ mode: 'edit', paused: false });
  },

  speedShift(delta) {
    let index = this.data.speedIndex + delta;
    index = Math.max(0, Math.min(SPEED_STEPS.length - 1, index));
    this.setData({ speedIndex: index, speedLabel: SPEED_LABELS[index] });
    storage.set('teleprompterSpeed', index);
  },

  speedUp() { this.speedShift(1); },
  speedDown() { this.speedShift(-1); },

  fontShift(delta) {
    let index = this.data.fontIndex + delta;
    index = Math.max(0, Math.min(FONT_STEPS.length - 1, index));
    this.setData({ fontIndex: index, fontRpx: FONT_STEPS[index] });
    storage.set('teleprompterFont', index);
    // 字号变了文案高度也变，重新量
    setTimeout(() => {
      const query = wx.createSelectorQuery();
      query.select('.script-text').boundingClientRect();
      query.exec((res) => {
        if (res && res[0]) this.contentH = res[0].height;
      });
    }, 100);
  },

  fontUp() { this.fontShift(1); },
  fontDown() { this.fontShift(-1); },

  keepScreen(on) {
    if (wx.setKeepScreenOn) wx.setKeepScreenOn({ keepScreenOn: on });
  }
});
