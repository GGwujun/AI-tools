Page({
  data: {
    fundEnabled: false,
    fundTools: [
      { id: 'switch', name: '提醒总开关', icon: '🔔', color: 'orange', desc: '基金异动提醒开关' },
      { id: 'bottom', name: '抄底神器', icon: '📉', color: 'red', desc: '智能判断抄底时机' },
      { id: 'closed', name: '封闭基金', icon: '🔒', color: 'blue', desc: '封闭基金折价分析' },
      { id: 'chase', name: '追涨策略', icon: '📈', color: 'green', desc: '趋势追涨策略工具' },
      { id: 'arbitrage', name: '套利神器', icon: '💹', color: 'purple', desc: 'LOF基金套利工具' }
    ],
    bondTools: [
      { id: 'newbond', name: '打新捡钱', icon: '🎁', color: 'pink', desc: '可转债打新日历' },
      { id: 'query', name: '中签查询', icon: '🔍', color: 'cyan', desc: '配号中签一键查询' },
      { id: 'calendar', name: '投资日历', icon: '📅', color: 'orange', desc: '重要日期一览无余' },
      { id: 'hide', name: '抢权潜伏', icon: '🌙', color: 'indigo', desc: '埋伏配债正股机会' },
      { id: '躺赢', name: '躺赢策略', icon: '😴', color: 'teal', desc: '双低策略自动筛选' }
    ],
    welfareTools: [
      { id: 'bug', name: '提BUG联系我', icon: '🐛', color: 'red', desc: '反馈问题或建议' },
      { id: 'course', name: '套利必看专辑', icon: '📖', color: 'blue', desc: '系统学习套利知识' },
      { id: 'methods', name: '几种搞Q方法', icon: '💰', color: 'green', desc: '低风险盈利思路' },
      { id: 'callme', name: '呼叫帮忙', icon: '📞', color: 'purple', desc: '请求人工协助' },
      { id: 'findhelp', name: '寻找帮忙', icon: '🤝', color: 'orange', desc: '发布需求找人帮忙' }
    ]
  },

  onLoad() {
    this.loadSettings();
  },

  onShow() {
    this.loadSettings();
  },

  loadSettings() {
    const fundEnabled = wx.getStorageSync('fundAlertEnabled') || false;
    this.setData({ fundEnabled });
  },

  goToTool(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;

    const routes = {
      switch: '/pages/save/switch/switch',
      arbitrage: '/pages/save/arbitrage/arbitrage',
      chase: '/pages/save/chase-rise-strategy/chase-rise-strategy',
      closed: '/pages/save/closed-fund/closed-fund',
      hide: '/pages/save/bond-rights/bond-rights'
    };

    if (routes[id]) {
      wx.navigateTo({ url: routes[id] });
    } else {
      wx.showToast({
        title: `${name} 功能开发中`,
        icon: 'none'
      });
    }
  }
});
