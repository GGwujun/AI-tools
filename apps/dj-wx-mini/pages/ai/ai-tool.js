// AI 文案工具族通用页：配置驱动（仿 video-tool 模式），全部走后端 AI 代理
const api = require('../../config/api');
const storage = require('../../utils/safe-storage');
const { track } = require('../../utils/track');

const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const AI_MODEL = 'glm-4-flash';

// resultKind: draft=标题+正文+标签 / lines=条目列表 / tags=标签组 / text=纯文本
const AI_TOOL_CONFIG = {
  xhs_note: {
    name: '小红书文案',
    emoji: '📕',
    desc: '产品/主题一键生成种草笔记',
    tip: '输入越具体越好用：品类、卖点、人群、价格',
    resultKind: 'draft',
    fields: [
      { key: 'topic', label: '产品 / 主题', type: 'textarea', maxlength: 300, placeholder: '例如：新开的猫咖，20 只布偶猫，人均 38，开在大学城，主打撸猫+下午茶' }
    ],
    system: '你是一位小红书爆款笔记文案专家。根据用户提供的主题，写一篇可以直接发布的种草笔记。要求：\n1. 标题吸睛，可用 1-2 个 emoji，不超过 20 个字\n2. 正文分 2-4 段，真实种草口吻，有细节、有体验感，不要空洞夸夸其谈\n3. 结尾给一句总结或行动建议\n4. 最后 3-5 个话题标签，每个单独一行，以 # 开头\n\n【输出格式（必须严格遵守）】\n第一行以【标题】开头；中间是正文；结尾是 # 标签行。除这三部分外不要输出任何内容，不要 markdown 符号。'
  },
  moments: {
    name: '朋友圈文案',
    emoji: '📱',
    desc: '一个主题出 3 条不同风格',
    tip: '发圈前挑一条顺眼的，直接复制',
    resultKind: 'lines',
    fields: [
      { key: 'topic', label: '主题 / 事件', type: 'textarea', maxlength: 200, placeholder: '例如：今天跑完了人生第一个半马，2 小时 40 分' }
    ],
    system: '你是一位朋友圈文案高手。根据用户提供的主题，写 3 条不同角度的朋友圈文案（比如：真实感受向、幽默自嘲向、文艺向）。要求：\n1. 每条 30-80 字，像真人随手发的，可用 1-2 个 emoji\n2. 不要营销腔、不要鸡汤腔\n3. 每条占一行，以「1.」「2.」「3.」编号开头\n\n只输出这 3 行，不要任何解释。'
  },
  title_gen: {
    name: '标题生成器',
    emoji: '🎯',
    desc: '一个主题出 10 个标题',
    tip: '覆盖悬念、数字、反差、提问等套路',
    resultKind: 'lines',
    fields: [
      { key: 'topic', label: '主题 / 内容要点', type: 'textarea', maxlength: 200, placeholder: '例如：月薪 5 千如何三年存下 20 万' }
    ],
    system: '你是一位短视频标题专家。根据用户提供的主题，生成 10 个标题。要求：\n1. 每行一个，以「1.」到「10.」编号开头\n2. 覆盖不同套路：悬念、数字、对比反差、提问、身份代入等\n3. 每个不超过 25 个字，口语有网感，但不要夸张欺骗式标题党\n\n只输出这 10 行，不要任何解释。'
  },
  weekly: {
    name: '周报生成器',
    emoji: '📋',
    desc: '流水账一键变结构化周报',
    tip: '随便写做了什么，AI 帮你整理成正式周报',
    resultKind: 'text',
    fields: [
      { key: 'work', label: '本周做的事（流水账即可）', type: 'textarea', maxlength: 500, placeholder: '例如：改了登录bug；跟运营对了两场活动；上线了新首页；帮新人熟悉代码' },
      { key: 'plan', label: '下周计划（可选）', type: 'textarea', maxlength: 300, placeholder: '例如：做活动页；重构下载模块' }
    ],
    system: '你是一位职场写作助手。用户会提供本周做的事（可能是流水账）和可选的下周计划，请整理成一份结构化周报：\n\n一、本周完成（分条列出，同类合并）\n二、亮点与结果（尽量量化呈现，没有就不写这条）\n三、下周计划（用户没提供就根据本周内容合理规划 2-3 条，并标注「建议」）\n\n要求：语言专业简洁，可适度润色表达，但严禁编造用户未提及的成果或数据。只输出周报正文。'
  },
  acrostic: {
    name: '藏头诗',
    emoji: '🖋️',
    desc: '每个字开头，七言藏头',
    tip: '表白、祝福、整活都能用',
    resultKind: 'text',
    fields: [
      { key: 'word', label: '藏头字（2-8 个字）', type: 'input', maxlength: 8, placeholder: '例如：生日快乐' },
      { key: 'theme', label: '主题（可选）', type: 'input', maxlength: 20, placeholder: '例如：送给妈妈' }
    ],
    system: '你是一位擅长藏头诗的诗人。用户会提供藏头字和可选主题。要求：\n1. 每个字开头写一句，字数几字就写几句\n2. 每句七言，尽量押韵，意思连贯贴合主题\n3. 逐句竖排，一行一句\n\n只输出诗句，不要任何解释。'
  },
  tags_gen: {
    name: '话题标签',
    emoji: '#️⃣',
    desc: '文案一键生成 12 个标签',
    tip: '大流量词 + 精准词 + 长尾词搭配',
    resultKind: 'tags',
    fields: [
      { key: 'content', label: '文案 / 视频描述', type: 'textarea', maxlength: 500, placeholder: '粘贴你的文案或视频内容描述' }
    ],
    system: '你是一位短视频话题标签专家。根据用户提供的文案/描述，生成 12 个话题标签，组合是：4 个大流量泛标签 + 6 个精准标签 + 2 个长尾标签。要求：每行一个，以 # 开头，标签要贴合内容且有真实流量。只输出这 12 行标签。'
  }
};

Page({
  data: {
    tool: '',
    config: null,
    form: {},
    running: false,
    elapsed: 0,
    error: '',
    result: null,   // {kind, title, content, tags, lines, text}
    adUnitId: ''
  },

  onLoad(options) {
    const tool = options.tool || '';
    const config = AI_TOOL_CONFIG[tool];
    if (!config) {
      wx.showToast({ title: '未知工具', icon: 'none' });
      setTimeout(() => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/tools/tools' }) }), 600);
      return;
    }

    const form = {};
    config.fields.forEach((f) => { form[f.key] = ''; });

    this.setData({ tool, config, form, adUnitId: api.adUnitId });
    wx.setNavigationBarTitle({ title: config.name });
  },

  onShareAppMessage() {
    return {
      title: `${this.data.config ? this.data.config.name : 'AI 文案工具'}｜文案一键生成`,
      path: `/pages/ai/ai-tool?tool=${this.data.tool}`
    };
  },

  onFieldInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`form.${key}`]: e.detail.value });
  },

  generate() {
    const { config, form } = this.data;
    for (const f of config.fields) {
      if (!f.key || form[f.key]) continue;
      // 除标注可选（label 含「可选」）外必填
      if (!/可选/.test(f.label)) {
        wx.showToast({ title: `请填写${f.label}`, icon: 'none' });
        return;
      }
    }
    this.runWithAdGate(() => this.callAi());
  },

  // 与全站共享 12 小时广告冷却
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
      wx.hideLoading();
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
        storage.set('hasWatchedAd', true);
        storage.set('adWatchedTimestamp', Date.now());
        callback();
      } else {
        wx.showToast({ title: '观看完整广告才能继续', icon: 'none' });
      }
    });
  },

  buildUserMessage() {
    const { config, form } = this.data;
    return config.fields
      .filter((f) => (form[f.key] || '').trim())
      .map((f) => `${f.label.replace(/（可选）/g, '')}：${form[f.key].trim()}`)
      .join('\n');
  },

  callAi() {
    this.setData({ running: true, elapsed: 0, error: '', result: null });
    this.startElapsed();

    wx.request({
      url: api.aiChatApi,
      method: 'POST',
      timeout: 120000,
      header: { 'Content-Type': 'application/json' },
      data: {
        model: AI_MODEL,
        messages: [
          { role: 'system', content: this.data.config.system },
          { role: 'user', content: this.buildUserMessage() }
        ]
      },
      success: (res) => {
        const payload = res.data || {};
        if (res.statusCode === 200 && payload.choices && payload.choices[0]) {
          const content = payload.choices[0].message.content;
          if (content && content.trim()) {
            this.setData({ result: this.parseResult(content) });
            track('ai_tool_use', { tool: this.data.tool });
          } else {
            this.setData({ error: '生成结果为空，请重试' });
          }
        } else {
          const message = (payload.error && payload.error.message) || `生成失败（${res.statusCode}）`;
          this.setData({ error: message });
        }
      },
      fail: (err) => {
        const message = /timeout/i.test(err.errMsg || '')
          ? '生成超时，请重试'
          : '网络异常，请稍后重试';
        this.setData({ error: message });
      },
      complete: () => {
        this.stopElapsed();
        this.setData({ running: false });
      }
    });
  },

  // 按 resultKind 解析：draft 标题+正文+标签 / lines 条目 / tags 标签组 / text 纯文本
  parseResult(content) {
    const kind = this.data.config.resultKind;
    const clean = (s) => s.replace(/\*\*|##/g, '').trim();
    const lines = content.split('\n').map((l) => l.trim()).filter((l) => l);

    if (kind === 'lines') {
      const cleaned = lines.map((l) => clean(l));
      // 模型偶尔加「以下是 10 个标题：」这类前言/尾解释：
      // 编号行凑够 3 条就只认编号行，否则退回全部行
      const numbered = cleaned.filter((l) => /^\d+\s*[.、)．]/.test(l));
      const picked = numbered.length >= 3 ? numbered : cleaned;
      return { kind, lines: picked.map((l) => l.replace(/^\d+\s*[.、)．]\s*/, '')) };
    }

    if (kind === 'tags') {
      const tags = [];
      lines.forEach((l) => {
        (l.match(/#[\w一-龥]+/g) || []).forEach((t) => tags.push(t));
      });
      return { kind, tags: tags.slice(0, 14) };
    }

    if (kind === 'text') {
      return { kind, text: lines.map(clean).join('\n') };
    }

    // draft：复用一键出稿的解析契约（【标题】+正文+#标签）
    const tags = [];
    const bodyLines = [];
    let title = '';

    for (const line of lines) {
      if (line.startsWith('#')) {
        (line.match(/#[\w一-龥]+/g) || []).forEach((t) => tags.push(t));
        continue;
      }
      bodyLines.push(clean(line));
    }

    if (bodyLines.length > 1) {
      const first = bodyLines[0];
      const markerMatch = first.match(/^【标题】\s*[:：]?\s*(.*)$/);
      if (markerMatch) {
        title = markerMatch[1].trim();
        bodyLines.shift();
      } else if (first.length <= 25) {
        title = first;
        bodyLines.shift();
      }
    }
    while (bodyLines.length && /^【?(正文|标签|话题标签)】?\s*[:：]?$/.test(bodyLines[0])) {
      bodyLines.shift();
    }

    return { kind, title, content: bodyLines.join('\n'), tags: tags.slice(0, 5) };
  },

  copyText() {
    const { result } = this.data;
    if (!result) return;
    wx.setClipboardData({
      data: result.text || result.content || '',
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  },

  copyAll() {
    const { result } = this.data;
    if (!result) return;
    const parts = [];
    if (result.title) parts.push(result.title);
    if (result.content) parts.push(result.content);
    if (result.tags && result.tags.length) parts.push(result.tags.join(' '));
    if (!parts.length) return;
    wx.setClipboardData({
      data: parts.join('\n\n'),
      success: () => wx.showToast({ title: '已复制全部', icon: 'success' })
    });
  },

  copyLine(e) {
    const index = e.currentTarget.dataset.index;
    const line = this.data.result && this.data.result.lines[index];
    if (!line) return;
    wx.setClipboardData({
      data: line,
      success: () => wx.showToast({ title: '已复制第 ' + (index + 1) + ' 条', icon: 'none' })
    });
  },

  copyAllLines() {
    const { result } = this.data;
    if (!result || !result.lines) return;
    wx.setClipboardData({
      data: result.lines.join('\n'),
      success: () => wx.showToast({ title: '已复制全部', icon: 'success' })
    });
  },

  copyTags() {
    const { result } = this.data;
    if (!result || !result.tags || !result.tags.length) return;
    wx.setClipboardData({
      data: result.tags.join(' '),
      success: () => wx.showToast({ title: '标签已复制', icon: 'success' })
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

  onUnload() {
    this.stopElapsed();
  }
});
