// 通用图片小工具页：压缩/拼接/水印共用（配置驱动表单 + 结果展示）
// 流程：选图 → 逐张 wx.uploadFile 暂存到服务器 → JSON 提交统一处理
const api = require('../../config/api');
const storage = require('../../utils/safe-storage');
const { track } = require('../../utils/track');

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

// 工具配置（与后端 tools.py 的 IMAGE_TOOL_HANDLERS 对应）
const TOOL_CONFIG = {
  image_compress: {
    name: '图片压缩',
    desc: '缩小图片体积，聊天发图不占空间',
    icon: '/images/icons_svg/package.svg',
    maxImages: 1,
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
  image_stitch: {
    name: '图片拼接',
    desc: '多张图拼成一张长图，聊天记录神器',
    icon: '/images/icons_svg/thumbnail.svg',
    maxImages: 9,
    tip: '图片较多时拼接需要一点时间，请耐心等待',
    fields: [
      {
        key: 'direction', label: '拼接方向', type: 'choice', default: 'h',
        options: [
          { value: 'h', label: '横向拼接' },
          { value: 'v', label: '纵向长图' }
        ]
      }
    ]
  },
  image_watermark: {
    name: '图片水印',
    desc: '给图片加上专属文字标识，防盗图必备',
    icon: '/images/icons_svg/coupon.svg',
    maxImages: 1,
    fields: [
      { key: 'text', label: '水印文字', type: 'text', placeholder: '最多 20 个字', maxlength: 20 },
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
  image_convert: {
    name: '图片转格式',
    desc: 'JPG/PNG/WebP 互转，透明图自动垫白底',
    icon: '/images/icons_svg/refresh.svg',
    maxImages: 1,
    fields: [
      {
        key: 'target', label: '目标格式', type: 'choice', default: 'png',
        options: [
          { value: 'png', label: 'PNG 无损' },
          { value: 'jpg', label: 'JPG 通用' },
          { value: 'webp', label: 'WebP 体积小' }
        ]
      }
    ]
  },
  image_resize: {
    name: '图片改尺寸',
    desc: '证件照/头像尺寸一键裁剪，也支持自定义宽高',
    icon: '/images/icons_svg/thumbnail.svg',
    maxImages: 1,
    tip: '按比例居中裁剪，PNG 保留透明、其余垫白底',
    fields: [
      {
        key: 'preset', label: '目标尺寸', type: 'choice', default: 'in',
        options: [
          { value: 'in', label: '一寸 295×413' },
          { value: 'in2', label: '二寸 413×526' },
          { value: 'in_s', label: '小一寸 260×378' },
          { value: 'in2_s', label: '小二寸 355×445' },
          { value: 'avatar', label: '方形头像 400×400' },
          { value: 'custom', label: '自定义' }
        ]
      }
    ]
  },
  image_border: {
    name: '图片加边框',
    desc: '相框式边框，小红书白边照神器',
    icon: '/images/icons_svg/thumbnail.svg',
    maxImages: 1,
    fields: [
      {
        key: 'color', label: '边框颜色', type: 'choice', default: 'white',
        options: [
          { value: 'white', label: '白色' },
          { value: 'black', label: '黑色' },
          { value: 'red', label: '砖红' },
          { value: 'blue', label: '蓝色' },
          { value: 'yellow', label: '奶黄' }
        ]
      },
      {
        key: 'width', label: '边框粗细', type: 'choice', default: 'medium',
        options: [
          { value: 'thin', label: '窄' },
          { value: 'medium', label: '适中（推荐）' },
          { value: 'wide', label: '宽' }
        ]
      }
    ]
  },
  image_collage: {
    name: '图片拼贴',
    desc: '4 张拼 2x2、9 张拼 3x3，朋友圈九图神器',
    icon: '/images/icons_svg/thumbnail.svg',
    maxImages: 9,
    tip: '先选模板，再按模板张数选图',
    fields: [
      {
        key: 'layout', label: '拼贴模板', type: 'choice', default: '2x2',
        options: [
          { value: '2x2', label: '2x2（4 张）' },
          { value: '3x3', label: '3x3（9 张）' }
        ]
      }
    ]
  },
  image_recolor: {
    name: '证件照换底色',
    desc: '蓝底/红底/白底互换，报名考试神器',
    icon: '/images/icons_svg/premium.svg',
    maxImages: 1,
    tip: '仅适合纯色底证件照，生活照效果不佳',
    fields: [
      {
        key: 'from', label: '现在底色', type: 'choice', default: 'blue',
        options: [
          { value: 'blue', label: '蓝色' },
          { value: 'red', label: '红色' },
          { value: 'white', label: '白色' }
        ]
      },
      {
        key: 'to', label: '换成', type: 'choice', default: 'white',
        options: [
          { value: 'blue', label: '蓝色' },
          { value: 'red', label: '红色' },
          { value: 'white', label: '白色' }
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
    maxImages: 1,
    fields: [],
    images: [],
    form: {},
    position: 'br',
    positionRows: POSITION_ROWS,
    uploading: false,
    uploadText: '',
    running: false,
    elapsed: 0,
    error: '',
    result: null,
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

    const form = {};
    (config.fields || []).forEach((field) => {
      form[field.key] = field.default != null ? field.default : '';
    });
    if (tool === 'image_resize') {
      form.customW = '750';
      form.customH = '1000';
    }

    this.setData({
      tool,
      toolName: config.name,
      toolDesc: config.desc,
      toolIcon: config.icon,
      toolTip: config.tip || '',
      maxImages: config.maxImages || 1,
      fields: config.fields || [],
      form,
      adUnitId: api.adUnitId || ''
    });

    wx.setNavigationBarTitle({ title: config.name });
  },

  onShareAppMessage() {
    return {
      title: `${this.data.toolName}｜图片小工具合集`,
      path: `/pages/tools/image-tool?tool=${this.data.tool}`
    };
  },

  // ------------------------------------------------------------------ 选图

  chooseImages() {
    const left = this.data.maxImages - this.data.images.length;
    if (left <= 0) {
      wx.showToast({ title: `最多选 ${this.data.maxImages} 张图`, icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: left,
      mediaType: ['image'],
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const added = (res.tempFiles || []).map((f) => f.tempFilePath).filter(Boolean);
        if (!added.length) return;
        this.setData({
          images: this.data.images.concat(added).slice(0, this.data.maxImages),
          result: null,
          error: ''
        });
      }
    });
  },

  removeImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    const images = this.data.images.slice();
    images.splice(index, 1);
    this.setData({ images, result: null, error: '' });
  },

  previewImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    wx.previewImage({ current: this.data.images[index], urls: this.data.images });
  },

  // ------------------------------------------------------------------ 表单

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

  // ------------------------------------------------------------------ 校验与处理

  validate() {
    const { tool, form, images } = this.data;
    if (!images.length) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return null;
    }
    if (tool === 'image_stitch' && images.length < 2) {
      wx.showToast({ title: '拼接至少需要 2 张图片', icon: 'none' });
      return null;
    }
    if (tool === 'image_collage') {
      const need = form.layout === '3x3' ? 9 : 4;
      if (images.length !== need) {
        wx.showToast({ title: `该模板需要 ${need} 张图片（已选 ${images.length} 张）`, icon: 'none' });
        return null;
      }
    }

    const params = {};
    if (tool === 'image_watermark') {
      const text = String(form.text || '').trim();
      if (!text) {
        wx.showToast({ title: '请输入水印文字', icon: 'none' });
        return null;
      }
      params.text = text;
      params.position = this.data.position;
      if (form.size) params.size = form.size;
    }
    if (form.quality) params.quality = form.quality;
    if (form.direction) params.direction = form.direction;
    if (form.target) params.target = form.target;
    if (form.color) params.color = form.color;
    if (form.width) params.width = form.width;
    if (form.layout) params.layout = form.layout;
    if (tool === 'image_recolor') {
      if (form.from === form.to) {
        wx.showToast({ title: '请选择两种不同的颜色', icon: 'none' });
        return null;
      }
      params.from = form.from;
      params.to = form.to;
    }
    if (tool === 'image_resize') {
      if (form.preset === 'custom') {
        const w = parseInt(form.customW, 10);
        const h = parseInt(form.customH, 10);
        if (!(w >= 20 && w <= 4000) || !(h >= 20 && h <= 4000)) {
          wx.showToast({ title: '宽高需在 20~4000 之间', icon: 'none' });
          return null;
        }
        params.w = w;
        params.h = h;
      } else {
        params.preset = form.preset;
      }
    }
    return params;
  },

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
    this.setData({ running: true, elapsed: 0, error: '', result: null, uploading: true, uploadText: '' });
    this.startElapsed();

    this.uploadAll()
      .then((names) => this.submitProcess(params, names))
      .then((result) => {
        this.setData({ result });
        track('tool_use', { tool: this.data.tool });
      })
      .catch((e) => {
        this.setData({ error: e.message || '处理失败，请稍后重试' });
        track('tool_fail', { tool: this.data.tool, ok: false });
      })
      .then(() => {
        this.stopElapsed();
        this.setData({ running: false, uploading: false });
      });
  },

  // wx.uploadFile 一次只能传一个文件，逐张上传暂存，拿到 name 列表
  uploadAll() {
    const images = this.data.images;
    const names = [];

    const uploadOne = (index) => new Promise((resolve, reject) => {
      if (index >= images.length) {
        resolve(names);
        return;
      }
      this.setData({ uploadText: `上传图片中 ${index + 1}/${images.length}` });
      wx.uploadFile({
        url: api.toolsImageUploadApi,
        filePath: images[index],
        name: 'f',
        timeout: 120000,
        success: (res) => {
          try {
            const payload = JSON.parse(res.data);
            if (res.statusCode === 200 && payload.code === 200 && payload.data && payload.data.name) {
              names.push(payload.data.name);
              resolve(uploadOne(index + 1));
            } else {
              const detail = payload.detail || payload.message || `上传失败（${res.statusCode}）`;
              reject(new Error(typeof detail === 'string' ? detail : JSON.stringify(detail)));
            }
          } catch (e) {
            reject(new Error('上传返回异常，请稍后重试'));
          }
        },
        fail: () => reject(new Error('图片上传失败，请检查网络'))
      });
    });

    return uploadOne(0);
  },

  submitProcess(params, names) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: api.toolsImageProcessApi,
        method: 'POST',
        timeout: 600000,
        header: { 'Content-Type': 'application/json' },
        data: {
          tool: this.data.tool,
          params,
          names
        },
        success: (res) => {
          const payload = res.data || {};
          if (res.statusCode === 200 && payload.code === 200 && payload.data) {
            const result = payload.data;
            result.tip = payload.tip || '';
            result.sizeText = result.size ? formatSize(result.size) : '';
            result.urlAbs = this.absUrl(result.url);
            resolve(result);
          } else {
            const detail = payload.detail || payload.message || `处理失败（${res.statusCode}）`;
            reject(new Error(typeof detail === 'string' ? detail : JSON.stringify(detail)));
          }
        },
        fail: (err) => {
          reject(new Error(/timeout/i.test(err.errMsg || '') ? '处理超时，图片可能太大，请稍后重试' : '网络异常，请稍后重试'));
        }
      });
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

  // ------------------------------------------------------------------ 结果操作

  absUrl(path) {
    return `${api.toolsFileBase}${path}`;
  },

  previewResult() {
    const result = this.data.result || {};
    if (!result.url) return;
    wx.previewImage({ urls: [this.absUrl(result.url)] });
  },

  saveResult() {
    const result = this.data.result || {};
    if (!result.url) return;

    wx.showLoading({ title: '下载中...' });
    wx.downloadFile({
      url: this.absUrl(result.url),
      timeout: 300000,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode !== 200) {
          wx.showToast({ title: `下载失败（${res.statusCode}）`, icon: 'none' });
          return;
        }
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '已保存到相册' }),
          fail: (err) => {
            const denied = /auth|denied/i.test(err.errMsg || '');
            wx.showToast({ title: denied ? '请在设置中开启相册权限' : '保存失败', icon: 'none' });
          }
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '下载失败，文件可能已过期', icon: 'none' });
      }
    });
  },

  copyLink() {
    const result = this.data.result || {};
    if (!result.url) return;
    wx.setClipboardData({
      data: this.absUrl(result.url),
      success: () => wx.showToast({ title: '已复制下载链接', icon: 'none' })
    });
  }
});
