const storage = require('../../../utils/safe-storage');

const DETAIL_MAP = {
  orders: {
    title: '我的订单',
    summary: '当前账号下还没有可展示的订单记录。',
    sections: [
      {
        heading: '订单状态',
        body: '如果后续接入会员、套餐或兑换功能，这里会展示最近订单、支付状态和开通时间。'
      },
      {
        heading: '当前建议',
        body: '现在可以先从“使用记录”里查看已解析的素材结果。'
      }
    ],
    primaryText: '查看使用记录',
    primaryAction: 'history'
  },
  feedback: {
    title: '意见反馈',
    summary: '可以把问题现象、页面位置和复现步骤整理后反馈，方便后续定位。',
    sections: [
      {
        heading: '建议反馈内容',
        body: '建议至少包含：出现问题的页面、点击了什么、预期结果、实际结果。'
      },
      {
        heading: '反馈方式',
        body: '当前版本先使用人工渠道统一收集，后续可接入表单。'
      }
    ],
    primaryText: '复制反馈模板',
    primaryAction: 'copy_feedback'
  },
  agreement: {
    title: '用户协议',
    summary: '本工具仅用于个人学习、备份与整理素材，不得用于侵犯他人合法权益。',
    sections: [
      {
        heading: '使用范围',
        body: '仅限合法、合规、个人用途。禁止用于传播侵权内容、绕过平台规则或商业滥用。'
      },
      {
        heading: '责任说明',
        body: '用户应对自己输入、解析、下载和传播的内容负责。平台仅提供工具能力，不对违规使用承担责任。'
      }
    ],
    primaryText: '我已知晓',
    primaryAction: 'close'
  },
  privacy: {
    title: '隐私政策',
    summary: '页面功能会使用本地缓存来保存历史记录、收藏和部分操作状态。',
    sections: [
      {
        heading: '存储内容',
        body: '会在本地记录解析历史、收藏素材、使用统计和部分页面配置，用于提升连续使用体验。'
      },
      {
        heading: '隐私原则',
        body: '除了解析或识别功能请求本身，不额外上传与页面无关的个人资料。你可以随时在“我的”页清理本地记录。'
      }
    ],
    primaryText: '清理本地记录',
    primaryAction: 'clear_storage'
  },
  settings: {
    title: '设置',
    summary: '这里放当前可直接操作的基础设置项。',
    sections: [
      {
        heading: '权限建议',
        body: '如果保存相册失败，请检查系统是否已授予相册写入权限。'
      },
      {
        heading: '当前版本',
        body: '设置页已接通，后续可以继续补充通知开关、缓存策略和默认行为设置。'
      }
    ],
    primaryText: '打开系统权限设置',
    primaryAction: 'open_setting'
  }
};

function buildFeedbackTemplate() {
  return [
    '问题页面：',
    '操作步骤：',
    '预期结果：',
    '实际结果：',
    '补充说明：'
  ].join('\n');
}

Page({
  data: {
    detail: DETAIL_MAP.settings
  },

  onLoad(options) {
    const key = decodeURIComponent(options.key || 'settings');
    const detail = DETAIL_MAP[key] || DETAIL_MAP.settings;

    this.setData({ detail });
    wx.setNavigationBarTitle({
      title: detail.title
    });
  },

  handlePrimaryAction() {
    const action = this.data.detail.primaryAction;

    if (action === 'history') {
      wx.switchTab({ url: '/pages/kj/kj' });
      return;
    }

    if (action === 'copy_feedback') {
      wx.setClipboardData({
        data: buildFeedbackTemplate(),
        success: () => {
          wx.showToast({
            title: '已复制反馈模板',
            icon: 'success'
          });
        }
      });
      return;
    }

    if (action === 'clear_storage') {
      storage.set('parseHistory', []);
      storage.set('favorites', []);
      wx.showToast({
        title: '已清理',
        icon: 'success'
      });
      return;
    }

    if (action === 'open_setting') {
      wx.openSetting({});
      return;
    }

    wx.navigateBack({
      fail: () => {
        wx.switchTab({ url: '/pages/about/about' });
      }
    });
  }
});
