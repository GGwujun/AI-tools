Page({
  data: {
    // 基金套利提醒阈值
    fundArbitrageEnabled: false,
    stockLOFEnabled: false,
    indexLOFEnabled: false,
    otherLOFEnabled: false,
    premiumThreshold: 0.5,
    discountThreshold: -1,
    turnoverThreshold: 100,

    // 盘中高溢价套利机会提醒
    realtimePremiumEnabled: false,
    buy1AmountThreshold: 5000,
    realtimePremiumThreshold: 1.88,

    // 封闭基金折价提醒
    closedFundDiscountEnabled: false,

    // 可转债申购提醒
    morningSubscribeEnabled: false,

    // 14点可转债申购再次提醒
    afternoonSubscribeEnabled: false,

    // 可转债上市提醒
    convertibleBondListEnabled: false,

    // 可转债强赎公告结果提醒
    convertibleBondRedeemEnabled: false,

    // 可转债预计触发强赎提醒
    convertibleBondExpectedRedeemEnabled: false,

    // 可转债公告下修提醒
    convertibleBondLowerEnabled: false,

    // 可转债涨幅落后正股提醒
    convertibleBondLagEnabled: false,
    bondPriceThreshold: '',
    bondPremiumThreshold: '',

    // 可转债中位数提醒
    convertibleBondMedianEnabled: false
  },

  onLoad() {
    this.loadSettings();
  },

  loadSettings() {
    this.setData({
      fundArbitrageEnabled: wx.getStorageSync('fundArbitrageEnabled') || false,
      stockLOFEnabled: wx.getStorageSync('stockLOFEnabled') || false,
      indexLOFEnabled: wx.getStorageSync('indexLOFEnabled') || false,
      otherLOFEnabled: wx.getStorageSync('otherLOFEnabled') || false,
      premiumThreshold: wx.getStorageSync('premiumThreshold') || 0.5,
      discountThreshold: wx.getStorageSync('discountThreshold') || -1,
      turnoverThreshold: wx.getStorageSync('turnoverThreshold') || 100,

      realtimePremiumEnabled: wx.getStorageSync('realtimePremiumEnabled') || false,
      buy1AmountThreshold: wx.getStorageSync('buy1AmountThreshold') || 5000,
      realtimePremiumThreshold: wx.getStorageSync('realtimePremiumThreshold') || 1.88,

      closedFundDiscountEnabled: wx.getStorageSync('closedFundDiscountEnabled') || false,
      morningSubscribeEnabled: wx.getStorageSync('morningSubscribeEnabled') || false,
      afternoonSubscribeEnabled: wx.getStorageSync('afternoonSubscribeEnabled') || false,
      convertibleBondListEnabled: wx.getStorageSync('convertibleBondListEnabled') || false,
      convertibleBondRedeemEnabled: wx.getStorageSync('convertibleBondRedeemEnabled') || false,
      convertibleBondExpectedRedeemEnabled: wx.getStorageSync('convertibleBondExpectedRedeemEnabled') || false,
      convertibleBondLowerEnabled: wx.getStorageSync('convertibleBondLowerEnabled') || false,

      convertibleBondLagEnabled: wx.getStorageSync('convertibleBondLagEnabled') || false,
      bondPriceThreshold: wx.getStorageSync('bondPriceThreshold') || '',
      bondPremiumThreshold: wx.getStorageSync('bondPremiumThreshold') || '',

      convertibleBondMedianEnabled: wx.getStorageSync('convertibleBondMedianEnabled') || false
    });
  },

  // 基金套利提醒阈值相关方法
  onFundArbitrageToggle(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('fundArbitrageEnabled', enabled);
    this.setData({ fundArbitrageEnabled: enabled });
  },

  onStockLOFToggle(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('stockLOFEnabled', enabled);
    this.setData({ stockLOFEnabled: enabled });
  },

  onIndexLOFToggle(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('indexLOFEnabled', enabled);
    this.setData({ indexLOFEnabled: enabled });
  },

  onOtherLOFToggle(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('otherLOFEnabled', enabled);
    this.setData({ otherLOFEnabled: enabled });
  },

  onPremiumThresholdInput(e) {
    const value = parseFloat(e.detail.value) || 0.5;
    this.setData({ premiumThreshold: value });
    wx.setStorageSync('premiumThreshold', value);
  },

  onDiscountThresholdInput(e) {
    const value = parseFloat(e.detail.value) || -1;
    this.setData({ discountThreshold: value });
    wx.setStorageSync('discountThreshold', value);
  },

  onTurnoverThresholdInput(e) {
    const value = parseFloat(e.detail.value) || 100;
    this.setData({ turnoverThreshold: value });
    wx.setStorageSync('turnoverThreshold', value);
  },

  // 盘中高溢价套利机会提醒相关方法
  onRealtimePremiumToggle(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('realtimePremiumEnabled', enabled);
    this.setData({ realtimePremiumEnabled: enabled });
  },

  onBuy1AmountInput(e) {
    const value = parseFloat(e.detail.value) || 5000;
    this.setData({ buy1AmountThreshold: value });
  },

  onRealtimePremiumInput(e) {
    const value = parseFloat(e.detail.value) || 1.88;
    this.setData({ realtimePremiumThreshold: value });
  },

  saveRealtimePremiumSettings() {
    wx.setStorageSync('buy1AmountThreshold', this.data.buy1AmountThreshold);
    wx.setStorageSync('realtimePremiumThreshold', this.data.realtimePremiumThreshold);
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  },

  // 其他开关方法
  onClosedFundDiscountToggle(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('closedFundDiscountEnabled', enabled);
    this.setData({ closedFundDiscountEnabled: enabled });
  },

  onMorningSubscribeToggle(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('morningSubscribeEnabled', enabled);
    this.setData({ morningSubscribeEnabled: enabled });
  },

  onAfternoonSubscribeToggle(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('afternoonSubscribeEnabled', enabled);
    this.setData({ afternoonSubscribeEnabled: enabled });
  },

  onConvertibleBondListToggle(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('convertibleBondListEnabled', enabled);
    this.setData({ convertibleBondListEnabled: enabled });
  },

  onConvertibleBondRedeemToggle(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('convertibleBondRedeemEnabled', enabled);
    this.setData({ convertibleBondRedeemEnabled: enabled });
  },

  onConvertibleBondExpectedRedeemToggle(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('convertibleBondExpectedRedeemEnabled', enabled);
    this.setData({ convertibleBondExpectedRedeemEnabled: enabled });
  },

  onConvertibleBondLowerToggle(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('convertibleBondLowerEnabled', enabled);
    this.setData({ convertibleBondLowerEnabled: enabled });
  },

  // 可转债涨幅落后正股提醒相关方法
  onConvertibleBondLagToggle(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('convertibleBondLagEnabled', enabled);
    this.setData({ convertibleBondLagEnabled: enabled });
  },

  onBondPriceInput(e) {
    const value = parseFloat(e.detail.value) || '';
    this.setData({ bondPriceThreshold: value });
  },

  onBondPremiumInput(e) {
    const value = parseFloat(e.detail.value) || '';
    this.setData({ bondPremiumThreshold: value });
  },

  saveConvertibleBondLagSettings() {
    wx.setStorageSync('bondPriceThreshold', this.data.bondPriceThreshold);
    wx.setStorageSync('bondPremiumThreshold', this.data.bondPremiumThreshold);
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  },

  // 可转债中位数提醒
  onConvertibleBondMedianToggle(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('convertibleBondMedianEnabled', enabled);
    this.setData({ convertibleBondMedianEnabled: enabled });
  }
});
