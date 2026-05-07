const PRESET_TEXTS = {
  ad: '欢迎来到直播间！今天给大家带来一款超值的商品，原价99元，现在只要49元！库存有限，先到先得！',
  narrate: '在繁华的都市中，每个人都在为自己的梦想努力着。这条路很长，但只要坚持，终会到达彼岸。',
  notice: '您好，您有一笔新的订单等待处理，请及时查看。感谢您的使用，祝您生活愉快！',
  service: '您好，欢迎使用在线客服，请问有什么可以帮助您的？我们的客服团队随时为您服务。'
};

Page({
  data: {
    text: '',
    voices: [
      { id: 'female_youth', name: '女声-青年', icon: '👩', desc: '清新自然，适合日常内容' },
      { id: 'female_mature', name: '女声-成熟', icon: '👩‍💼', desc: '知性稳重，适合商务场景' },
      { id: 'male_youth', name: '男声-青年', icon: '👨', desc: '活力阳光，适合娱乐内容' },
      { id: 'male_mature', name: '男声-成熟', icon: '👨‍✈️', desc: '磁性低沉，适合解说配音' },
      { id: 'child', name: '童声', icon: '👧', desc: '天真可爱，适合儿童内容' },
      { id: 'robot', name: '机器人', icon: '🤖', desc: '科技感强，适合AI场景' }
    ],
    selectedVoice: 'female_youth',
    speed: 1,
    pitch: 1,
    volume: 1,
    audioUrl: '',
    isPlaying: false,
    isGenerating: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
    scenes: [
      { id: 'ad', name: '广告配音', icon: '📢' },
      { id: 'narrate', name: '视频旁白', icon: '🎬' },
      { id: 'notice', name: '通知播报', icon: '📋' },
      { id: 'service', name: '智能客服', icon: '🤖' }
    ]
  },

  audioContext: null,
  innerAudioContext: null,

  onLoad() {
    this.innerAudioContext = wx.createInnerAudioContext();
    this.setupAudioListeners();
  },

  onUnload() {
    if (this.innerAudioContext) {
      this.innerAudioContext.destroy();
    }
  },

  setupAudioListeners() {
    const innerAudioContext = this.innerAudioContext;

    innerAudioContext.onPlay(() => {
      this.setData({ isPlaying: true });
    });

    innerAudioContext.onPause(() => {
      this.setData({ isPlaying: false });
    });

    innerAudioContext.onEnded(() => {
      this.setData({ isPlaying: false, progress: 100, currentTime: this.data.duration });
    });

    innerAudioContext.onTimeUpdate(() => {
      const currentTime = Math.floor(innerAudioContext.currentTime);
      const duration = Math.floor(innerAudioContext.duration) || 1;
      const progress = (currentTime / duration) * 100;

      this.setData({
        currentTime,
        progress
      });
    });

    innerAudioContext.onError((err) => {
      console.error('音频播放错误', err);
      wx.showToast({ title: '播放失败', icon: 'none' });
    });
  },

  onTextInput(e) {
    this.setData({ text: e.detail.value });
  },

  selectVoice(e) {
    const voiceId = e.currentTarget.dataset.id;
    this.setData({ selectedVoice: voiceId });
    wx.showToast({ title: '已选择音色', icon: 'none', duration: 1000 });
  },

  playVoice(e) {
    const voiceId = e.currentTarget.dataset.voice;
    const demoTexts = {
      female_youth: '您好，这是一段语音演示',
      female_mature: '欢迎使用智能语音服务',
      male_youth: '这是一段男声语音演示',
      male_mature: '磁性低沉的声音演示',
      child: '这是可爱的童声演示',
      robot: '您好，我是机器人语音助手'
    };

    const demoText = demoTexts[voiceId] || '语音演示文本';

    // 实际项目中调用TTS API
    wx.showToast({ title: '播放演示音', icon: 'none' });
  },

  onSpeedChange(e) {
    this.setData({ speed: e.detail.value });
  },

  onPitchChange(e) {
    this.setData({ pitch: e.detail.value });
  },

  onVolumeChange(e) {
    this.setData({ volume: e.detail.value });
  },

  generateAudio() {
    const { text, selectedVoice, speed, pitch } = this.data;

    if (!text.trim()) {
      wx.showToast({ title: '请输入文本', icon: 'none' });
      return;
    }

    this.setData({ isGenerating: true });
    this.updateStats();

    wx.showLoading({ title: '生成中...' });

    // 模拟TTS生成
    setTimeout(() => {
      wx.hideLoading();

      // 实际项目中调用TTS API
      // 这里使用演示模式
      const mockDuration = Math.ceil(text.length / 5);

      this.setData({
        audioUrl: 'demo_audio_' + Date.now(),
        duration: mockDuration,
        isGenerating: false,
        progress: 0,
        currentTime: 0
      });

      wx.showToast({ title: '生成成功，点击播放', icon: 'success' });
    }, 2500);
  },

  togglePlay() {
    if (!this.data.audioUrl) {
      wx.showToast({ title: '请先生成语音', icon: 'none' });
      return;
    }

    const innerAudioContext = this.innerAudioContext;

    if (this.data.isPlaying) {
      innerAudioContext.pause();
    } else {
      // 演示模式
      if (this.data.audioUrl.startsWith('demo_')) {
        wx.showToast({ title: '演示模式，无法播放真实音频', icon: 'none' });
        return;
      }
      innerAudioContext.src = this.data.audioUrl;
      innerAudioContext.play();
    }
  },

  seekAudio(e) {
    if (!this.data.audioUrl) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const tapX = e.detail.x;
    const percent = tapX / rect.width;
    const seekTime = Math.floor(percent * this.data.duration);

    this.innerAudioContext.seek(seekTime);
  },

  saveAudio() {
    if (!this.data.audioUrl) return;

    // 如果是模拟音频，提示无法保存
    if (this.data.audioUrl.startsWith('mock_')) {
      wx.showToast({ title: '演示模式，请接入真实API', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '保存音频',
      content: '确定要保存这段语音吗？',
      success: (res) => {
        if (res.confirm) {
          // 下载并保存
          wx.downloadFile({
            url: this.data.audioUrl,
            success: (downloadRes) => {
              const savedPath = downloadRes.tempFilePath;
              wx.showToast({ title: '保存成功', icon: 'success' });

              // 可以进一步保存到服务器或本地
              console.log('音频已保存到:', savedPath);
            },
            fail: () => {
              wx.showToast({ title: '保存失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  shareAudio() {
    if (!this.data.audioUrl) return;

    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

    wx.showToast({ title: '请点击右上角分享', icon: 'none' });
  },

  applyScene(e) {
    const sceneId = e.currentTarget.dataset.scene;
    const presetText = PRESET_TEXTS[sceneId];

    if (presetText) {
      this.setData({ text: presetText });
      const sceneNames = {
        ad: '广告配音',
        narrate: '视频旁白',
        notice: '通知播报',
        service: '智能客服'
      };
      wx.showToast({ title: `已应用"${sceneNames[sceneId]}"模板`, icon: 'success' });
    }
  },

  updateStats() {
    const stats = wx.getStorageSync('aiStats') || {
      aiWrites: 0,
      aiOcr: 0,
      aiErase: 0,
      aiTts: 0
    };
    stats.aiTts++;
    wx.setStorageSync('aiStats', stats);
  }
});
