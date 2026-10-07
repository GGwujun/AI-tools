// 通用视频小工具页：所有 ffmpeg 类工具共用（配置驱动表单 + 结果展示）
const api = require('../../config/api');
const storage = require('../../utils/safe-storage');

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

// 工具配置：字段渲染 + 描述（与后端 tools.py 的 TOOL_HANDLERS 对应）
const TOOL_CONFIG = {
  extract_audio: {
    name: '音频提取',
    desc: '提取视频的音轨，保存为 MP3 音频文件',
    icon: '/images/icons_svg/extract-audio.svg',
    placeholder: '粘贴视频分享链接（抖音/快手/B站等）',
    fields: []
  },
  screenshot: {
    name: '视频截图',
    desc: '截取视频任意一帧，保存为高清图片',
    icon: '/images/icons_svg/extract-cover.svg',
    placeholder: '粘贴视频分享链接（抖音/快手/B站等）',
    fields: [
      { key: 'time', label: '截图时间（秒）', type: 'number', placeholder: '不填默认取视频中间画面' }
    ]
  },
  asr: {
    name: '视频转文字',
    desc: '自动识别视频口播内容，生成文字稿',
    icon: '/images/icons_svg/tool-video-to-text.svg',
    placeholder: '粘贴视频分享链接（抖音/快手/B站等）',
    tip: '视频最长支持 10 分钟，转写约需十几秒',
    fields: []
  },
  clip: {
    name: '视频裁剪',
    desc: '截取视频片段，保留需要的部分',
    icon: '/images/icons_svg/duration.svg',
    placeholder: '粘贴视频分享链接（抖音/快手/B站等）',
    fields: [
      { key: 'start', label: '开始时间（秒）', type: 'number', placeholder: '例如 0' },
      { key: 'end', label: '结束时间（秒）', type: 'number', placeholder: '例如 15' }
    ]
  },
  compress: {
    name: '视频压缩',
    desc: '缩小视频体积，方便发送与保存',
    icon: '/images/icons_svg/package.svg',
    placeholder: '粘贴视频分享链接（抖音/快手/B站等）',
    tip: '压缩需要重新编码，1 分钟视频约需 30 秒',
    fields: [
      {
        key: 'quality', label: '压缩力度', type: 'choice', default: 'balanced',
        options: [
          { value: 'high', label: '优先清晰' },
          { value: 'balanced', label: '均衡（推荐）' },
          { value: 'small', label: '优先体积' }
        ]
      }
    ]
  },
  convert: {
    name: '转 MP4',
    desc: 'MOV / WebM 等格式转成通用 MP4',
    icon: '/images/icons_svg/refresh.svg',
    placeholder: '粘贴视频链接或直链',
    fields: []
  },
  gif: {
    name: '视频转 GIF',
    desc: '截取片段制作表情包、循环动图',
    icon: '/images/icons_svg/play.svg',
    placeholder: '粘贴视频分享链接（抖音/快手/B站等）',
    fields: [
      { key: 'start', label: '开始时间（秒）', type: 'number', placeholder: '默认从 0 开始' },
      { key: 'duration', label: 'GIF 时长（1-15 秒）', type: 'number', placeholder: '默认 5 秒' }
    ]
  },
  watermark: {
    name: '文字水印',
    desc: '给视频加上专属文字标识',
    icon: '/images/icons_svg/coupon.svg',
    placeholder: '粘贴视频分享链接（抖音/快手/B站等）',
    tip: '添加水印需要重新编码，请耐心等待',
    fields: [
      { key: 'text', label: '水印文字', type: 'text', placeholder: '最多 30 个字', maxlength: 30 },
      {
        key: 'size', label: '字号', type: 'choice', default: 'medium',
        options: [
          { value: 'small', label: '小' },
          { value: 'medium', label: '中' },
          { value: 'large', label: '大' }
        ]
      }
    ]
  },
  grid: {
    name: '九宫格切图',
    desc: '把图片切成 9 张，发朋友圈九宫格必备',
    icon: '/images/icons_svg/thumbnail.svg',
    placeholder: '粘贴图片链接，或图集/视频分享链接'
  },
  reverse: {
    name: '视频倒放',
    desc: '画面声音全部倒着播，做魔法效果必备',
    icon: '/images/icons_svg/refresh.svg',
    placeholder: '粘贴视频分享链接（抖音/快手/B站等）',
    tip: '倒放需要整段重新编码，仅支持 2 分钟内的视频',
    fields: []
  },
  mute: {
    name: '视频去声音',
    desc: '一键去掉视频声音，保留画面',
    icon: '/images/icons_svg/tool-audio.svg',
    placeholder: '粘贴视频分享链接（抖音/快手/B站等）',
    tip: '只移除音轨不重新编码，几秒即可完成',
    fields: []
  },
  audio_convert: {
    name: '音频转格式',
    desc: '把视频/音频的声音转成 MP3、WAV 等格式',
    icon: '/images/icons_svg/extract-audio.svg',
    placeholder: '粘贴视频分享链接或音频直链',
    fields: [
      {
        key: 'format', label: '目标格式', type: 'choice', default: 'mp3',
        options: [
          { value: 'mp3', label: 'MP3' },
          { value: 'wav', label: 'WAV' },
          { value: 'aac', label: 'AAC' },
          { value: 'm4a', label: 'M4A' },
          { value: 'ogg', label: 'OGG' }
        ]
      }
    ]
  }
};

// 水印位置九宫格
const POSITION_ROWS = [
  ['tl', 't', 'tr'],
  ['l', 'c', 'r'],
  ['bl', 'b', 'br']
];

function formatSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

Page({
  data: {
    tool: '',
    toolName: '',
    toolDesc: '',
    toolIcon: '',
    toolTip: '',
    placeholder: '粘贴视频分享链接（抖音/快手/B站等）',
    fields: [],
    sourceUrl: '',
    form: {},
    position: 'br',
    positionRows: POSITION_ROWS,
    running: false,
    elapsed: 0,
    error: '',
    result: null,
    audioPlaying: false,
    adUnitId: ''
  },

  onLoad(options) {
    const tool = (options && options.tool) || '';
    const config = TOOL_CONFIG[tool];

    if (!config) {
      wx.showToast({ title: '未找到该工具', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }

    let sourceUrl = '';
    if (options && options.url) {
      try { sourceUrl = decodeURIComponent(options.url); } catch (e) { sourceUrl = options.url; }
    }

    const form = {};
    (config.fields || []).forEach((field) => {
      form[field.key] = field.default != null ? field.default : '';
    });

    this.setData({
      tool,
      toolName: config.name,
      toolDesc: config.desc,
      toolIcon: config.icon,
      toolTip: config.tip || '',
      placeholder: config.placeholder || '粘贴视频分享链接',
      fields: config.fields || [],
      sourceUrl,
      form,
      adUnitId: api.adUnitId || ''
    });

    wx.setNavigationBarTitle({ title: config.name });
  },

  onUnload() {
    this.stopElapsed();
    if (this.audioContext) {
      this.audioContext.destroy();
      this.audioContext = null;
    }
  },

  onShareAppMessage() {
    return {
      title: `${this.data.toolName}｜视频小工具合集`,
      path: `/pages/tools/video-tool?tool=${this.data.tool}`
    };
  },

  // ------------------------------------------------------------------ 表单

  onUrlInput(e) {
    this.setData({ sourceUrl: e.detail.value || '' });
  },

  onFieldInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`form.${key}`]: e.detail.value || '' });
  },

  onChoiceTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`form.${key}`]: e.currentTarget.dataset.value });
  },

  onPositionTap(e) {
    this.setData({ position: e.currentTarget.dataset.id });
  },

  // ------------------------------------------------------------------ 校验

  validate() {
    const { tool, form, sourceUrl } = this.data;
    if (!sourceUrl.trim()) {
      wx.showToast({ title: '请先粘贴视频链接', icon: 'none' });
      return null;
    }

    const params = {};
    if (tool === 'watermark') {
      const text = String(form.text || '').trim();
      if (!text) {
        wx.showToast({ title: '请输入水印文字', icon: 'none' });
        return null;
      }
      params.text = text;
      params.position = this.data.position;
      if (form.size) params.size = form.size;
    }
    if (tool === 'clip') {
      const start = Number(form.start);
      const end = Number(form.end);
      if (!(start >= 0) || !(end > 0) || end <= start) {
        wx.showToast({ title: '请填写正确的起止时间', icon: 'none' });
        return null;
      }
      params.start = start;
      params.end = end;
    }
    if (tool === 'gif' && form.duration) {
      const duration = Number(form.duration);
      if (!(duration >= 1 && duration <= 15)) {
        wx.showToast({ title: 'GIF 时长需在 1-15 秒', icon: 'none' });
        return null;
      }
      params.duration = duration;
    }
    if (form.time !== '' && form.time != null && !Number.isNaN(Number(form.time))) params.time = Number(form.time);
    if (form.start !== '' && form.start != null && !Number.isNaN(Number(form.start)) && tool === 'gif') params.start = Number(form.start);
    if (form.quality) params.quality = form.quality;
    if (form.format) params.format = form.format;
    return params;
  },

  // ------------------------------------------------------------------ 处理

  startProcess() {
    if (this.data.running) return;
    const params = this.validate();
    if (!params) return;
    this.runWithAdGate(() => this.doProcess(params));
  },

  // 与单条解析/批量解析共享 12 小时广告冷却
  runWithAdGate(callback) {
    const { adUnitId } = this.data;
    const hasWatchedAd = !!storage.get('hasWatchedAd');
    const adWatchedTimestamp = storage.get('adWatchedTimestamp');
    const inCooldown = hasWatchedAd && adWatchedTimestamp
      && (Date.now() - adWatchedTimestamp) < TWELVE_HOURS;

    if (!adUnitId || inCooldown) {
      callback();
      return;
    }

    wx.showModal({
      title: '提示',
      content: '观看一段广告，即可使用本工具',
      success: (res) => {
        if (res.confirm) this.watchAd(callback);
      }
    });
  },

  watchAd(callback) {
    wx.showLoading({ title: '加载广告中...' });

    if (!wx.createRewardedVideoAd) {
      callback();
      return;
    }

    const videoAd = wx.createRewardedVideoAd({ adUnitId: this.data.adUnitId });

    videoAd.onError(() => {
      wx.hideLoading();
      wx.showToast({ title: '广告拉取失败，请稍后重试', icon: 'none' });
    });

    videoAd.show()
      .then(() => wx.hideLoading())
      .catch(() => {
        videoAd.load()
          .then(() => { wx.hideLoading(); videoAd.show(); })
          .catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '广告加载失败，请稍后重试', icon: 'none' });
          });
      });

    videoAd.onClose((status) => {
      if (status && status.isEnded) {
        const now = Date.now();
        storage.set('hasWatchedAd', true);
        storage.set('adWatchedTimestamp', now);
        callback();
      } else {
        wx.showToast({ title: '观看完整广告才能继续', icon: 'none' });
      }
    });
  },

  doProcess(params) {
    this.setData({ running: true, elapsed: 0, error: '', result: null });
    this.startElapsed();

    wx.request({
      url: api.toolsProcessApi,
      method: 'POST',
      timeout: 300000,
      header: { 'Content-Type': 'application/json' },
      data: {
        tool: this.data.tool,
        url: this.data.sourceUrl.trim(),
        params
      },
      success: (res) => {
        const payload = res.data || {};
        if (res.statusCode === 200 && payload.code === 200 && payload.data) {
          const result = payload.data;
          result.tip = payload.tip || '';
          result.sizeText = result.size ? formatSize(result.size) : '';
          if (result.images) {
            result.imageUrls = result.images.map((path) => this.absUrl(path));
          }
          this.setData({ result });
        } else {
          const detail = payload.detail || payload.message || `处理失败（${res.statusCode}）`;
          this.setData({ error: typeof detail === 'string' ? detail : JSON.stringify(detail) });
        }
      },
      fail: (err) => {
        const message = /timeout/i.test(err.errMsg || '')
          ? '处理超时，视频可能太大，请稍后重试'
          : '网络异常，请稍后重试';
        this.setData({ error: message });
      },
      complete: () => {
        this.stopElapsed();
        this.setData({ running: false });
      }
    });
  },

  startElapsed() {
    this.stopElapsed();
    this.elapsedTimer = setInterval(() => {
      this.setData({ elapsed: this.data.elapsed + 1 });
    }, 1000);
  },

  stopElapsed() {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  },

  retry() {
    this.setData({ error: '', result: null });
  },

  resetAll() {
    this.setData({ result: null, error: '' });
  },

  // ------------------------------------------------------------------ 结果操作

  absUrl(path) {
    return `${api.toolsFileBase}${path}`;
  },

  resultImages() {
    const result = this.data.result || {};
    return (result.images || []).map((path) => this.absUrl(path));
  },

  downloadToTemp(url) {
    return new Promise((resolve, reject) => {
      wx.showLoading({ title: '下载中...' });
      wx.downloadFile({
        url,
        timeout: 300000,
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode === 200) {
            resolve(res.tempFilePath);
          } else {
            reject(new Error(`下载失败（${res.statusCode}）`));
          }
        },
        fail: () => {
          wx.hideLoading();
          reject(new Error('下载失败，文件可能已过期'));
        }
      });
    });
  },

  // 保存按钮：按结果类型分发
  saveResult() {
    const result = this.data.result || {};
    if (result.output_type === 'text') {
      this.copyText();
      return;
    }
    if (result.output_type === 'images') {
      this.saveAllImages();
      return;
    }

    const url = this.absUrl(result.url);
    const ext = (result.filename || '').split('.').pop();
    const AUDIO_EXTS = ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac'];

    this.downloadToTemp(url)
      .then((filePath) => {
        if (ext === 'mp4') {
          return this.saveVideo(filePath);
        }
        if (AUDIO_EXTS.indexOf(ext) >= 0) {
          return this.shareFile(filePath, result.filename);
        }
        return this.saveImage(filePath);
      })
      .catch((e) => {
        wx.showToast({ title: e.message || '保存失败', icon: 'none' });
      });
  },

  saveVideo(filePath, silent) {
    return new Promise((resolve) => {
      wx.saveVideoToPhotosAlbum({
        filePath,
        success: () => {
          if (!silent) wx.showToast({ title: '已保存到相册' });
          resolve();
        },
        fail: (err) => {
          const denied = /auth|denied/i.test(err.errMsg || '');
          wx.showToast({ title: denied ? '请在设置中开启相册权限' : '保存失败', icon: 'none' });
          resolve();
        }
      });
    });
  },

  saveImage(filePath, silent) {
    return new Promise((resolve) => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: () => {
          if (!silent) wx.showToast({ title: '已保存到相册' });
          resolve();
        },
        fail: (err) => {
          const denied = /auth|denied/i.test(err.errMsg || '');
          wx.showToast({ title: denied ? '请在设置中开启相册权限' : '保存失败', icon: 'none' });
          resolve();
        }
      });
    });
  },

  saveAllImages() {
    const urls = this.resultImages();
    if (!urls.length) return;

    wx.showLoading({ title: '保存中 0/' + urls.length });
    let done = 0;
    let failed = 0;

    const next = (index) => {
      if (index >= urls.length) {
        wx.hideLoading();
        if (failed) {
          wx.showToast({ title: `已保存 ${done} 张，${failed} 张失败`, icon: 'none' });
        } else {
          wx.showToast({ title: `已保存 ${done} 张到相册` });
        }
        return;
      }

      this.downloadToTemp(urls[index])
        .then((filePath) => this.saveImage(filePath, true))
        .then(() => { done += 1; })
        .catch(() => { failed += 1; })
        .then(() => {
          wx.showLoading({ title: `保存中 ${index + 1}/${urls.length}` });
          next(index + 1);
        });
    };
    next(0);
  },

  // mp3/gif 等不能进相册的文件 → 发给朋友/文件传输助手
  shareFile(filePath, fileName) {
    return new Promise((resolve) => {
      const task = () => wx.shareFileMessage({
        filePath,
        fileName: fileName || 'audio.mp3',
        success: () => resolve(),
        fail: () => {
          wx.setClipboardData({
            data: this.absUrl((this.data.result || {}).url || ''),
            success: () => {
              wx.showToast({ title: '已复制下载链接', icon: 'none' });
              resolve();
            },
            fail: () => resolve()
          });
        }
      });

      if (wx.shareFileMessage) {
        task();
      } else {
        wx.setClipboardData({
          data: this.absUrl((this.data.result || {}).url || ''),
          success: () => {
            wx.showToast({ title: '已复制下载链接', icon: 'none' });
            resolve();
          },
          fail: () => resolve()
        });
      }
    });
  },

  shareResultFile() {
    const result = this.data.result || {};
    if (!result.url) return;
    this.downloadToTemp(this.absUrl(result.url))
      .then((filePath) => this.shareFile(filePath, result.filename))
      .catch((e) => wx.showToast({ title: e.message || '分享失败', icon: 'none' }));
  },

  previewImage() {
    const result = this.data.result || {};
    if (!result.url) return;
    wx.previewImage({ urls: [this.absUrl(result.url)] });
  },

  previewGridImage(e) {
    const urls = this.resultImages();
    const current = urls[e.currentTarget.dataset.index] || urls[0];
    wx.previewImage({ current, urls });
  },

  // mp3 试听
  toggleAudio() {
    const result = this.data.result || {};
    if (!result.url) return;

    if (!this.audioContext) {
      this.audioContext = wx.createInnerAudioContext();
      this.audioContext.src = this.absUrl(result.url);
      this.audioContext.onEnded(() => this.setData({ audioPlaying: false }));
      this.audioContext.onError(() => {
        this.setData({ audioPlaying: false });
        wx.showToast({ title: '音频播放失败', icon: 'none' });
      });
    }

    if (this.data.audioPlaying) {
      this.audioContext.pause();
      this.setData({ audioPlaying: false });
    } else {
      this.audioContext.play();
      this.setData({ audioPlaying: true });
    }
  },

  copyText() {
    const result = this.data.result || {};
    wx.setClipboardData({
      data: result.text || '',
      success: () => wx.showToast({ title: '已复制全文' })
    });
  },

  copyLink() {
    const result = this.data.result || {};
    if (!result.url) return;
    wx.setClipboardData({
      data: this.absUrl(result.url),
      success: () => wx.showToast({ title: '已复制下载链接', icon: 'none' })
    });
  },

  // 文字稿 → AI 改写文案（搬运工作台链路）
  goWriter() {
    const result = this.data.result || {};
    const text = (result.text || '').slice(0, 500);
    wx.navigateTo({
      url: `/pages/ai/writer/writer?source=video&title=${encodeURIComponent(text)}`
    });
  }
});
