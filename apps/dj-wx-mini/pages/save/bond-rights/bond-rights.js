function formatUpdateTime() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${month}月${date}日 ${hours}:${minutes}`;
}

Page({
  data: {
    updateTime: '',
    entries: [
      {
        stockName: '宝钛股份',
        stockCode: '600456',
        convertPrice: '34.31元',
        convertValue: '106.18元',
        allocateTenLots: '100股',
        requiredCapital: '3643.00元',
        progressDate: '2026-04-21',
        progressStage: '同意注册',
        issueScale: '35.00亿',
        hundredValue: '27.45元'
      },
      {
        stockName: '华翔股份',
        stockCode: '603112',
        convertPrice: '19.12元',
        convertValue: '115.43元',
        allocateTenLots: '300股',
        requiredCapital: '6621.00元',
        progressDate: '2026-04-13',
        progressStage: '同意注册',
        issueScale: '13.01亿',
        hundredValue: '15.10元'
      },
      {
        stockName: '迪威尔',
        stockCode: '688377',
        convertPrice: '37.99元',
        convertValue: '107.42元',
        allocateTenLots: '200股',
        requiredCapital: '8162.00元',
        progressDate: '2026-04-08',
        progressStage: '同意注册',
        issueScale: '9.08亿',
        hundredValue: '12.25元'
      },
      {
        stockName: '金三江',
        stockCode: '301059',
        convertPrice: '13.76元',
        convertValue: '103.63元',
        allocateTenLots: '797股',
        requiredCapital: '11365.22元',
        progressDate: '2026-04-07',
        progressStage: '同意注册',
        issueScale: '2.90亿',
        hundredValue: '8.80元'
      },
      {
        stockName: '奥士康',
        stockCode: '002913',
        convertPrice: '49.56元',
        convertValue: '103.19元',
        allocateTenLots: '318股',
        requiredCapital: '16262.52元',
        progressDate: '2026-04-02',
        progressStage: '同意注册',
        issueScale: '10.00亿',
        hundredValue: '6.15元'
      },
      {
        stockName: '爱科科技',
        stockCode: '688092',
        convertPrice: '28.81元',
        convertValue: '102.05元',
        allocateTenLots: '200股',
        requiredCapital: '5880.00元',
        progressDate: '2026-04-01',
        progressStage: '同意注册',
        issueScale: '2.67亿',
        hundredValue: '17.01元'
      },
      {
        stockName: '申能股份',
        stockCode: '600642',
        convertPrice: '9.04元',
        convertValue: '103.21元',
        allocateTenLots: '1300股',
        requiredCapital: '12129.00元',
        progressDate: '2026-03-18',
        progressStage: '同意注册',
        issueScale: '20.00亿',
        hundredValue: '8.24元'
      }
    ],
    bottomActions: [
      { key: 'guide', icon: '📘', label: '投资秘籍', tone: '' },
      { key: 'week', icon: '📊', label: '躺赢(周)策略', tone: 'accent' },
      { key: 'day', icon: '📈', label: '躺赢(天)策略', tone: 'accent' },
      { key: 'chance', icon: '🔥', label: '弯腰捡钱', tone: 'accent' },
      { key: 'real', icon: '👤', label: '打新实盘', tone: 'muted' }
    ]
  },

  onLoad() {
    this.setData({
      updateTime: formatUpdateTime()
    });
  },

  onBottomActionTap(e) {
    const label = e.currentTarget.dataset.label;
    wx.showToast({
      title: `${label} 功能开发中`,
      icon: 'none'
    });
  }
});
