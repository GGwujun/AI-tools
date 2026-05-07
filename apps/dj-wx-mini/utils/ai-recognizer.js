// utils/ai-recognizer.js - AI智能识别引擎
class AIRecognizer {
  constructor() {
    this.rules = {
      // 短视频链接
      shortVideo: {
        name: '短视频链接',
        patterns: [
          /v\.douyin\.com/,
          /tiktok\.com/,
          /kuaishou\.com/,
          /xhslink\.com/,
          /b23\.tv/
        ],
        confidence: 0.95,
        actions: ['去水印下载', '提取音频', '批量解析']
      },

      // 普通链接
      url: {
        name: '网页链接',
        patterns: [
          /^https?:\/\//i
        ],
        confidence: 0.8,
        actions: ['网页预览', '生成二维码', '保存书签']
      },

      // 快递单号
      express: {
        name: '快递单号',
        patterns: [
          /^(SF|中通|韵达|圆通|申通|EMS|德邦)/,
          /\\d{10,20}/
        ],
        confidence: 0.9,
        actions: ['查询物流', '复制单号', '预计到达']
      },

      // 手机号码
      phone: {
        name: '手机号码',
        patterns: [
          /1[3-9]\\d{9}/
        ],
        confidence: 0.95,
        actions: ['拨打电话', '保存联系人', '查询归属地']
      },

      // 金额/货币
      currency: {
        name: '金额',
        patterns: [
          /[¥$€£]\\s*\\d+[\\.,]?\\d*/,
          /\\d+[\\.,]?\\d*\\s*(元|美元|美金|欧元|英镑)/
        ],
        confidence: 0.85,
        actions: ['汇率换算', '记账', '价格比较']
      },

      // 日期时间
      datetime: {
        name: '日期时间',
        patterns: [
          /\\d{4}[-年]\\d{1,2}[-月]\\d{1,2}/,
          /\\d{1,2}:\\d{2}/,
          /(明天|后天|下周|下个月)/
        ],
        confidence: 0.8,
        actions: ['添加到日历', '设置提醒', '倒计时']
      },

      // 地址
      address: {
        name: '地址',
        patterns: [
          /[省市县区旗镇乡村街道]/,
          /\\d+号?室?/,
          /(小区|花园|大厦|公寓|路|街)/
        ],
        confidence: 0.85,
        actions: ['地图导航', '周边搜索', '路线规划']
      },

      // 邮箱
      email: {
        name: '邮箱地址',
        patterns: [
          /[\\w.-]+@[\\w.-]+\\.\\w+/
        ],
        confidence: 0.95,
        actions: ['发送邮件', '复制邮箱', '快速注册']
      },

      // 身份证
      idcard: {
        name: '身份证号',
        patterns: [
          /\\d{17}[\\dXx]/,
          /\\d{15}/
        ],
        confidence: 0.95,
        actions: ['信息提取', '验证真伪', '保密处理']
      },

      // 外文文本
      foreignText: {
        name: '外文内容',
        patterns: [
          /[\\u3040-\\u309F]+/, // 日文
          /[\\u30A0-\\u30FF]+/, // 片假名
          /[\\uAC00-\\uD7A3]+/, // 韩文
          /^[a-zA-Z\\s]{10,}$/ // 纯英文
        ],
        confidence: 0.75,
        actions: ['翻译', '朗读', '语法检查']
      },

      // 图片
      image: {
        name: '图片',
        patterns: ['clipboard.hasImage'],
        confidence: 1.0,
        actions: ['提取文字', '识别二维码', '翻译图片', '压缩图片']
      },

      // 默认：文本
      text: {
        name: '文本内容',
        patterns: [/.*/],
        confidence: 0.5,
        actions: ['搜索', '翻译', '生成二维码', '语音朗读']
      }
    };
  }

  // 核心识别方法
  recognize(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    const trimmedText = text.trim();
    const results = [];

    // 遍历规则进行匹配
    for (const [type, rule] of Object.entries(this.rules)) {
      let matchCount = 0;
      let totalPatterns = rule.patterns.length;

      for (const pattern of rule.patterns) {
        if (pattern instanceof RegExp) {
          if (pattern.test(trimmedText)) {
            matchCount++;
          }
        } else if (typeof pattern === 'string' && trimmedText.includes(pattern)) {
          matchCount++;
        }
      }

      // 计算匹配度
      const matchRatio = matchCount / totalPatterns;
      if (matchRatio > 0) {
        results.push({
          type,
          name: rule.name,
          confidence: rule.confidence * matchRatio,
          matchedPatterns: matchCount,
          actions: rule.actions
        });
      }
    }

    // 按置信度排序，返回最高匹配
    results.sort((a, b) => b.confidence - a.confidence);
    
    if (results.length > 0 && results[0].confidence >= 0.7) {
      return this.enrichResult(results[0], trimmedText);
    }

    // 低置信度，返回通用文本识别
    return {
      type: 'text',
      name: '文本内容',
      confidence: 0.5,
      actions: ['搜索', '翻译', '生成二维码'],
      originalText: trimmedText
    };
  }

  // 富化识别结果，提取关键信息
  enrichResult(result, text) {
    const enriched = { ...result, originalText: text };

    switch (result.type) {
      case 'currency':
        enriched.data = this.extractCurrency(text);
        break;
      case 'express':
        enriched.data = this.extractExpress(text);
        break;
      case 'phone':
        enriched.data = this.extractPhone(text);
        break;
      case 'datetime':
        enriched.data = this.parseDateTime(text);
        break;
    }

    return enriched;
  }

  // 提取货币信息
  extractCurrency(text) {
    const match = text.match(/([¥$€£])\\s*(\\d+[\\.,]?\\d*)/);
    if (match) {
      return {
        symbol: match[1],
        amount: parseFloat(match[2].replace(',', '')),
        currencyMap: {
          '¥': 'CNY',
          '$': 'USD',
          '€': 'EUR',
          '£': 'GBP'
        }[match[1]]
      };
    }
    return null;
  }

  // 提取快递信息
  extractExpress(text) {
    const expressMap = {
      'SF': '顺丰速运',
      '中通': '中通快递',
      '韵达': '韵达快递',
      '圆通': '圆通速递',
      '申通': '申通快递',
      'EMS': 'EMS快递',
      '德邦': '德邦物流'
    };

    const company = Object.keys(expressMap).find(key => text.includes(key));
    const numberMatch = text.match(/\\d{10,20}/);

    return {
      company: company ? expressMap[company] : '未知快递',
      trackingNo: numberMatch ? numberMatch[0] : null
    };
  }

  // 提取手机号
  extractPhone(text) {
    const match = text.match(/1[3-9]\\d{9}/);
    return match ? {
      number: match[0],
      carrier: this.detectCarrier(match[0])
    } : null;
  }

  // 识别运营商
  detectCarrier(phone) {
    const prefix = phone.substring(0, 3);
    const carriers = {
      '134': '移动', '135': '移动', '136': '移动', '137': '移动', '138': '移动', '139': '移动',
      '150': '移动', '151': '移动', '152': '移动', '157': '移动', '158': '移动', '159': '移动',
      '130': '联通', '131': '联通', '132': '联通', '155': '联通', '156': '联通', '186': '联通',
      '133': '电信', '153': '电信', '180': '电信', '189': '电信'
    };
    return carriers[prefix] || '未知';
  }

  // 解析日期时间
  parseDateTime(text) {
    const now = new Date();
    let date = new Date(now);

    if (text.includes('明天')) {
      date.setDate(date.getDate() + 1);
    } else if (text.includes('后天')) {
      date.setDate(date.getDate() + 2);
    } else if (text.includes('下周')) {
      date.setDate(date.getDate() + 7);
    }

    return {
      original: text,
      parsed: date,
      relative: this.getRelativeTime(date)
    };
  }

  getRelativeTime(date) {
    const now = new Date();
    const diff = date - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今天';
    if (days === 1) return '明天';
    if (days === 2) return '后天';
    if (days < 7) return `${days}天后`;
    return `${Math.floor(days / 7)}周后`;
  }

  // 获取推荐工具（基于识别结果）
  getRecommendedTools(result) {
    const toolMap = {
      'shortVideo': ['batchParser', 'videoDownload'],
      'url': ['qrCode', 'bookmark'],
      'express': ['expressQuery'],
      'phone': ['phoneDialer', 'phoneBook'],
      'currency': ['currencyConverter', 'accounting'],
      'datetime': ['calendar', 'reminder'],
      'address': ['map', 'navigation'],
      'email': ['emailComposer'],
      'foreignText': ['translator'],
      'text': ['search', 'qrCode']
    };

    return toolMap[result.type] || ['qrCode'];
  }
}

// 单例模式导出
module.exports = new AIRecognizer();