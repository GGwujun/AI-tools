Page({
  data: {
    updateTime: '4月10日 20:40',
    currentTab: 0,
    tabs: ['股票型LOF', '指数型LOF', '机会多多', '无时差ETF', '我的自选'],
    tabDescs: [
      '主要投资主动型股票的LOF基金，适合长期持有并关注溢价机会',
      '主要跟踪指数的被动型基金，费率低、跟踪误差小',
      '筛选溢价率较高、流动性较好的LOF基金，机会较多',
      '24小时可交易，实时净值更新，无时差影响',
      '您自选关注的基金，方便快速查看'
    ],
    fundNotes: [
      '如果是灰底，说明该基金今日暂停申购',
      '如果是灰底，说明该基金今日暂停申购',
      '如果是灰底，说明该基金今日暂停申购',
      '无时差ETF交易时间更长，溢价机会更多',
      ''
    ],
    // 各Tab的特殊备注
    specialNotes: {
      0: [
        '国泰价值LOF(501064)限额申购限100万',
        '添富核心精选混合LOF(501188)限额申购单账户累计限额50万'
      ],
      1: [
        '鹏华港股通ETF(160632)限额申购单账户累计限额100万'
      ],
      2: [],
      3: [
        '纳指ETF(513100)限额申购单账户累计限额2000元'
      ],
      4: []
    },
    fundList: [],
    // 各Tab的基金数据
    allFundLists: {
      0: [
        { code: '163406', name: '兴全合润', price: '1.514', premium: '+2.37%', up: true, starred: true, downDays: 3, maxDownDays: 15 },
        { code: '519736', name: '交银内核驱动', price: '1.602', premium: '+1.14%', up: true, starred: false, downDays: 0, maxDownDays: 12 },
        { code: '163408', name: '兴全轻资产', price: '2.876', premium: '+0.85%', up: true, starred: true, downDays: 5, maxDownDays: 18 },
        { code: '166009', name: '中欧新动力', price: '2.156', premium: '+0.42%', up: true, starred: false, paused: true, downDays: 0, maxDownDays: 10 }
      ],
      1: [
        { code: '160632', name: '鹏华港股通ETF', price: '1.234', premium: '+1.85%', up: true, starred: false, downDays: 0, maxDownDays: 8 },
        { code: '513500', name: '博时标普500ETF', price: '2.156', premium: '+1.23%', up: true, starred: true, downDays: 0, maxDownDays: 10 },
        { code: '513100', name: '国泰纳指ETF', price: '3.567', premium: '+0.96%', up: true, starred: false, downDays: 2, maxDownDays: 12 }
      ],
      2: [
        { code: '163406', name: '兴全合润', price: '1.514', premium: '+2.37%', up: true, starred: true, downDays: 3, maxDownDays: 15 },
        { code: '160632', name: '鹏华港股通ETF', price: '1.234', premium: '+1.85%', up: true, starred: false, downDays: 0, maxDownDays: 8 },
        { code: '519736', name: '交银内核驱动', price: '1.602', premium: '+1.14%', up: true, starred: false, downDays: 0, maxDownDays: 12 },
        { code: '513500', name: '博时标普500ETF', price: '2.156', premium: '+1.23%', up: true, starred: true, downDays: 0, maxDownDays: 10 }
      ],
      3: [
        { code: '513100', name: '国泰纳指ETF', price: '3.567', premium: '+0.96%', up: true, starred: false, downDays: 0, maxDownDays: 0 },
        { code: '513500', name: '博时标普500ETF', price: '2.156', premium: '+0.45%', up: false, starred: true, downDays: 0, maxDownDays: 0 }
      ],
      4: [
        { code: '163406', name: '兴全合润', price: '1.514', premium: '+2.37%', up: true, starred: true, downDays: 3, maxDownDays: 15 },
        { code: '163408', name: '兴全轻资产', price: '2.876', premium: '+0.85%', up: true, starred: true, downDays: 5, maxDownDays: 18 },
        { code: '162605', name: '景顺长城鼎益', price: '1.876', premium: '-0.45%', up: false, starred: true, downDays: 0, maxDownDays: 14 }
      ]
    },
    sortField: 'premium',
    sortOrder: 'desc'
  },

  onLoad() {
    this.loadData();
  },

  loadData() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const updateTime = `${month}月${date}日 ${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
    this.setData({
      updateTime,
      fundList: this.data.allFundLists[0],
      currentNote: this.data.fundNotes[0],
      currentSpecialNotes: this.data.specialNotes[0] || []
    });
  },

  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentTab: index,
      fundList: this.data.allFundLists[index],
      currentNote: this.data.fundNotes[index],
      currentSpecialNotes: this.data.specialNotes[index] || []
    });
  },

  onSort(e) {
    const field = e.currentTarget.dataset.field;
    let { sortField, sortOrder } = this.data;

    if (sortField === field) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortOrder = 'desc';
    }

    this.setData({ sortField, sortOrder });
  },

  onStar(e) {
    e.stopPropagation();
    const index = e.currentTarget.dataset.index;
    const fundList = this.data.fundList;
    fundList[index].starred = !fundList[index].starred;
    // 同时更新allFundLists中对应tab的数据
    const allFundLists = this.data.allFundLists;
    allFundLists[this.data.currentTab] = fundList;
    this.setData({ fundList, allFundLists });
  },

  onFundTap(e) {
    const index = e.currentTarget.dataset.index;
    const fund = this.data.fundList[index];
    const fundData = encodeURIComponent(JSON.stringify(fund));
    wx.navigateTo({
      url: `/pages/save/fund-detail/fund-detail?data=${fundData}`
    });
  },

  goToAlert() {
    wx.navigateTo({ url: '/pages/save/switch/switch' });
  }
});
