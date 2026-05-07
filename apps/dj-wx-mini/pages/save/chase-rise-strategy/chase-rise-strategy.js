Page({
  data: {
    // 可以在这里添加策略数据
    strategyData: []
  },

  onLoad() {
    // 页面加载时的逻辑
    this.loadStrategyData();
  },

  onShareAppMessage() {
    return {
      title: '追涨策略 - 小鱼的储钱助手',
      path: '/pages/save/chase-rise-strategy/chase-rise-strategy'
    };
  },

  loadStrategyData() {
    // 这里可以加载策略数据
    // 例如从服务器获取或从本地存储读取
    const data = wx.getStorageSync('chaseRiseStrategyData') || [];
    this.setData({ strategyData: data });
  },

  // 添加其他页面交互方法
});
