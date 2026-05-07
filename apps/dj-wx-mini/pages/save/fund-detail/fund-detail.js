Page({
  data: {
    fund: null,
    updateTime: '',
    estimatedProfit: '',
    arbitrageSpace: '',
    riskTitle: '',
    riskDesc: '',
    // 五档数据
    fiveLevel: {
      updateTime: '16:11分18秒',
      bid: [
        { price: '1.876', volume: '7万', premium: '1.86%' },
        { price: '1.874', volume: '9万', premium: '1.64%' },
        { price: '1.872', volume: '4万', premium: '1.43%' },
        { price: '1.870', volume: '6万', premium: '1.22%' },
        { price: '1.868', volume: '3万', premium: '1.01%' }
      ],
      ask: [
        { price: '1.901', volume: '8万', premium: '2.85%' },
        { price: '1.902', volume: '5万', premium: '2.91%' },
        { price: '1.903', volume: '12万', premium: '2.97%' },
        { price: '1.904', volume: '3万', premium: '3.04%' },
        { price: '1.905', volume: '6万', premium: '3.10%' }
      ]
    },
    // 历史净值数据
    navHistory: [
      { date: '04-10', nav: '1.9018', navChange: '-0.24%', aShareClose: '2.85%', premium: '1.86%', errorRate: '-0.08%', profit: '0' },
      { date: '04-09', nav: '1.9064', navChange: '+1.24%', aShareClose: '0.97%', premium: '0.49%', errorRate: '-0.55%', profit: '-7' },
      { date: '04-08', nav: '1.8831', navChange: '+2.40%', aShareClose: '0.46%', premium: '0.44%', errorRate: '-0.37%', profit: '0' },
      { date: '04-07', nav: '1.8389', navChange: '-0.01%', aShareClose: '-0.37%', premium: '0.35%', errorRate: '-0.65%', profit: '-15' },
      { date: '04-03', nav: '1.8390', navChange: '+1.59%', aShareClose: '-0.37%', premium: '0.84%', errorRate: '-0.73%', profit: '0' },
      { date: '04-02', nav: '1.8103', navChange: '-0.31%', aShareClose: '-0.10%', premium: '-0.55%', errorRate: '-0.37%', profit: '-12' }
    ],
    // 基金统计数据
    fundStats: {
      threshold1: { minPremium: '>0.5%', position: '1/2仓', startDate: '23年7月19日', count: 152, successRate: '90.13%', totalProfit: '76.75%', prob: '23.03%' },
      threshold2: { minPremium: '>1%', position: '1/2仓', startDate: '', count: 126, successRate: '93.65%', totalProfit: '74.81%', prob: '19.09%', starred: true }
    },
    scale: '0.30亿',
    turnover: '49万'
  },

  onLoad(options) {
    if (options.data) {
      const fund = JSON.parse(decodeURIComponent(options.data));
      const updateTime = this.getUpdateTime();
      const { estimatedProfit, arbitrageSpace, riskTitle, riskDesc } = this.calcProfit(fund);
      this.setData({ fund, updateTime, estimatedProfit, arbitrageSpace, riskTitle, riskDesc });
    }
  },

  getUpdateTime() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return `${month}月${date}日 ${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
  },

  calcProfit(fund) {
    const premiumStr = fund.premium || '0%';
    const premium = parseFloat(premiumStr.replace(/[+%]/g, '')) || 0;
    const estimatedProfit = `约${(premium * 0.39).toFixed(2)}%`;

    let arbitrageSpace = '一般';
    let riskTitle = '风险提示';
    let riskDesc = '请注意操作风险，谨慎投资';

    if (premium >= 3) {
      arbitrageSpace = '很大';
      riskTitle = '温馨提示';
      riskDesc = '溢价率较高，套利空间较大，可重点关注';
    } else if (premium >= 2) {
      arbitrageSpace = '较大';
      riskTitle = '温馨提示';
      riskDesc = '溢价率良好，有一定套利空间';
    } else if (premium >= 1) {
      arbitrageSpace = '中等';
      riskTitle = '风险提示';
      riskDesc = '溢价率一般，需结合其他因素综合判断';
    } else if (premium > 0) {
      arbitrageSpace = '较小';
      riskTitle = '风险提示';
      riskDesc = '溢价率较低，套利空间有限';
    } else {
      arbitrageSpace = '无';
      riskTitle = '风险提示';
      riskDesc = '溢价为负，不建议套利';
    }

    return { estimatedProfit, arbitrageSpace, riskTitle, riskDesc };
  },

  onCopyCode() {
    if (this.data.fund) {
      wx.setClipboardData({
        data: this.data.fund.code,
        success: () => {
          wx.showToast({ title: '基金代码已复制', icon: 'success' });
        }
      });
    }
  },

  onCopyName() {
    if (this.data.fund) {
      wx.setClipboardData({
        data: this.data.fund.name,
        success: () => {
          wx.showToast({ title: '基金名称已复制', icon: 'success' });
        }
      });
    }
  }
});
