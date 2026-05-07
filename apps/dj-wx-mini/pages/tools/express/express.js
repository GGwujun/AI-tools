Page({
  data: {
    trackingNo: '',
    selectedCompany: 'auto',
    isLoading: false,
    showEmpty: true,
    logisticsInfo: [],
    statusText: '',
    statusClass: '',
    companies: [
      { code: 'auto', name: '自动识别', icon: '🔮' },
      { code: 'SF', name: '顺丰', icon: '✈️' },
      { code: 'YTO', name: '圆通', icon: '📮' },
      { code: 'ZTO', name: '中通', icon: '🚚' },
      { code: 'YD', name: '韵达', icon: '📬' },
      { code: 'STO', name: '申通', icon: '📭' },
      { code: 'EMS', name: 'EMS', icon: '🏤' },
      { code: 'JD', name: '京东', icon: '📱' }
    ]
  },

  onLoad(options) {
    if (options.no) {
      this.setData({ trackingNo: options.no });
      this.queryExpress();
    }
  },

  onInput(e) {
    this.setData({ trackingNo: e.detail.value });
  },

  selectCompany(e) {
    this.setData({ selectedCompany: e.currentTarget.dataset.code });
  },

  queryExpress() {
    const { trackingNo, selectedCompany } = this.data;

    if (!trackingNo.trim()) {
      wx.showToast({ title: '请输入快递单号', icon: 'none' });
      return;
    }

    this.setData({ isLoading: true, showEmpty: false, logisticsInfo: [] });

    // 更新AI统计
    this.updateStats();

    // 实际项目中调用快递查询API
    // 这里使用模拟数据演示
    setTimeout(() => {
      const mockData = this.getMockLogistics(trackingNo);
      this.setData({
        isLoading: false,
        logisticsInfo: mockData,
        statusText: '运输中',
        statusClass: 'shipping'
      });
    }, 1500);
  },

  getMockLogistics(no) {
    const now = new Date();
    const formatTime = (d) => {
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      return `${month}-${day} ${h}:${m}`;
    };

    return [
      { desc: '【收货地址】已签收，签收人：本人', time: formatTime(now) },
      { desc: '【派送中】您的包裹正在派送中，请您保持电话畅通', time: formatTime(new Date(now - 3600000)) },
      { desc: '【运输中】快件已到达【北京分拨中心】', time: formatTime(new Date(now - 7200000)) },
      { desc: '【运输中】快件已从【商家仓库】发出', time: formatTime(new Date(now - 86400000)) },
      { desc: '【已发货】卖家正在通知快递公司揽件', time: formatTime(new Date(now - 172800000)) }
    ];
  },

  updateStats() {
    const stats = wx.getStorageSync('aiStats') || {
      aiWrites: 0,
      aiOcr: 0,
      aiErase: 0,
      aiTts: 0
    };
    // 快递查询不算AI功能，但可以记录
    wx.setStorageSync('aiStats', stats);
  },

  onShareAppMessage() {
    return {
      title: '快递查询 - 物流追踪',
      path: '/pages/tools/express/express'
    };
  }
});
