// AI文案生成器 - 接入智谱AI
const PLATFORM_PROMPTS = {
  douyin: {
    id: 'douyin',
    name: '抖音',
    icon: '🎵',
    prompt: '你是一个抖音短视频文案专家。请根据用户输入的主题，创作一个吸引人的抖音短视频文案。要求：\n1. 开头要有悬念或冲突，抓住用户注意力\n2. 中间有情节反转或惊喜\n3. 结尾要有互动引导（点赞、评论）\n4. 文案要口语化、有感染力\n5. 控制在100字以内\n6. 适合短视频节奏'
  },
  xiaohongshu: {
    id: 'xiaohongshu',
    name: '小红书',
    icon: '📕',
    prompt: '你是一个小红书博主。请根据用户输入的主题，创作一篇吸引人的小红书种草文案。要求：\n1. 标题要吸引人，多用emoji\n2. 内容真实有代入感\n3. 多用分段和emoji增加可读性\n4. 结尾有购买建议或总结\n5. 带上3-5个相关话题标签\n6. 风格轻松活泼'
  },
  moments: {
    id: 'moments',
    name: '朋友圈',
    icon: '📱',
    prompt: '你是一个朋友圈达人。请根据用户输入的主题，创作一条朋友圈文案。要求：\n1. 简短有趣，30-50字\n2. 生活化有共鸣\n3. 可以适当使用emoji\n4. 容易引起点赞和评论\n5. 风格轻松自然'
  },
  weibo: {
    id: 'weibo',
    name: '微博',
    icon: '🌐',
    prompt: '你是一个微博大V。请根据用户输入的主题，创作一条微博。要求：\n1. 观点鲜明有态度\n2. 语言犀利有个性\n3. 可以带上话题标签\n4. 容易引发讨论和转发\n5. 控制在100字以内'
  }
};

const STYLE_CONFIG = {
  funny: { id: 'funny', name: '幽默风趣', emoji: '😄', modifier: '加入幽默搞笑元素' },
  emotional: { id: 'emotional', name: '情感共鸣', emoji: '❤️', modifier: '加入情感元素，引发共鸣' },
  professional: { id: 'professional', name: '专业严谨', emoji: '📚', modifier: '保持专业严谨的风格' },
  casual: { id: 'casual', name: '轻松随意', emoji: '☀️', modifier: '像朋友聊天一样轻松自然' }
};

// 智谱AI配置
const ZHIPU_CONFIG = {
  baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
  apiKey: 'f9ff2dfa21804ed8bdeeb511deaf888b.M0YaO5MyJ5Xa5Wvs',
  model: 'glm-4-flash'
};

Page({
  data: {
    topic: '',
    platforms: Object.values(PLATFORM_PROMPTS),
    styles: Object.values(STYLE_CONFIG),
    selectedPlatform: 'douyin',
    selectedStyle: 'casual',
    result: '',
    tags: [],
    isGenerating: false,
    history: []
  },

  onLoad() {
    this.loadHistory();
  },

  onTopicInput(e) {
    this.setData({ topic: e.detail.value });
  },

  selectPlatform(e) {
    const platformId = e.currentTarget.dataset.id;
    this.setData({
      selectedPlatform: platformId,
      selectedTemplate: null
    });
  },

  selectStyle(e) {
    this.setData({ selectedStyle: e.currentTarget.dataset.id });
  },

  generateContent() {
    const { topic, selectedPlatform, selectedStyle } = this.data;

    if (!topic.trim()) {
      wx.showToast({ title: '请输入视频主题', icon: 'none' });
      return;
    }

    this.setData({ isGenerating: true, result: '', tags: [] });
    this.updateStats();

    // 调用智谱AI
    this.callZhipuAI(topic, selectedPlatform, selectedStyle);
  },

  async callZhipuAI(topic, platform, style) {
    const platformData = PLATFORM_PROMPTS[platform];
    const styleData = STYLE_CONFIG[style];

    const systemPrompt = `${platformData.prompt}\n\n另外，请根据用户选择的风格"${styleData.name}"来调整文案风格：${styleData.modifier}\n\n最后，在文案结尾添加3-5个适合的话题标签，用换行分隔。`;

    try {
      const response = await this.requestZhipuAPI(systemPrompt, topic);

      // 解析返回的内容，分离文案和标签
      const parsed = this.parseAIResponse(response);

      this.setData({
        result: parsed.content,
        tags: parsed.tags,
        isGenerating: false
      });

      this.saveToHistory(topic, platform, parsed.content, parsed.tags);
    } catch (error) {
      console.error('智谱AI调用失败:', error);
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      this.setData({ isGenerating: false });
    }
  },

  requestZhipuAPI(systemPrompt, userMessage) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${ZHIPU_CONFIG.baseUrl}/chat/completions`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ZHIPU_CONFIG.apiKey}`
        },
        data: {
          model: ZHIPU_CONFIG.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          stream: false
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.choices && res.data.choices[0]) {
            resolve(res.data.choices[0].message.content);
          } else {
            reject(new Error(res.data.error?.message || 'API返回错误'));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },

  parseAIResponse(content) {
    // 尝试分离文案和标签
    const lines = content.split('\n');
    const tags = [];
    const contentLines = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // 检测是否为话题标签
      if (trimmed.startsWith('#') || /^[#\s]*#/.test(trimmed)) {
        // 提取标签
        const extractedTags = trimmed.match(/#[\w\u4e00-\u9fa5]+/g);
        if (extractedTags) {
          tags.push(...extractedTags);
        }
      } else if (trimmed) {
        contentLines.push(trimmed);
      }
    }

    return {
      content: contentLines.join('\n'),
      tags: tags.slice(0, 5) // 最多5个标签
    };
  },

  copyResult() {
    const { result, tags } = this.data;
    if (!result) return;

    const content = tags.length > 0 ? result + '\n\n' + tags.join(' ') : result;

    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  },

  regenerate() {
    this.generateContent();
  },

  loadHistory(e) {
    // 区分是页面加载还是点击历史记录
    if (e && e.currentTarget) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.history[index];
      if (item) {
        this.setData({
          topic: item.topic,
          result: item.content,
          tags: item.tags || []
        });
      }
    } else {
      // 页面加载时只读取历史记录列表
      const history = wx.getStorageSync('aiWriterHistory') || [];
      this.setData({ history: history.slice(0, 10) });
    }
  },

  saveToHistory(topic, platform, content, tags) {
    const history = wx.getStorageSync('aiWriterHistory') || [];
    history.unshift({
      id: Date.now(),
      topic,
      platform: PLATFORM_PROMPTS[platform]?.name || platform,
      content,
      tags
    });
    if (history.length > 20) history.length = 20;
    wx.setStorageSync('aiWriterHistory', history);
    this.setData({ history: history.slice(0, 10) });
  },

  clearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空历史记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('aiWriterHistory');
          this.setData({ history: [] });
        }
      }
    });
  },

  updateStats() {
    const stats = wx.getStorageSync('aiStats') || {
      aiWrites: 0,
      aiOcr: 0,
      aiErase: 0,
      aiTts: 0
    };
    stats.aiWrites++;
    wx.setStorageSync('aiStats', stats);
  },

  onShareAppMessage() {
    return {
      title: 'AI文案生成器 - 智能创作好文案',
      path: '/pages/ai/writer/writer'
    };
  }
});
