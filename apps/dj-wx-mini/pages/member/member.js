Page({
  data: {
    plans: [
      { id: 'month', name: '月卡', price: '¥25.0', note: '适合轻度使用', badge: '推荐' },
      { id: 'season', name: '季卡', price: '¥68.0', note: '性价比更高', badge: '' },
      { id: 'times', name: '次数包', price: '¥9.9', note: '按次使用更灵活', badge: '' }
    ],
    currentPlanId: 'month'
  },

  selectPlan(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    this.setData({ currentPlanId: id });
  },

  openPlan() {
    wx.showToast({
      title: '支付能力待接入',
      icon: 'none'
    });
  }
});
