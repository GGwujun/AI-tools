Page({
  data: {
    amount: '100',
    fromCurrency: 'CNY',
    toCurrency: 'USD',
    result: '',
    fromSymbol: '¥',
    fromName: '人民币',
    toSymbol: '$',
    toName: '美元',
    currencies: [
      { code: 'CNY', name: '人民币', symbol: '¥', rate: 1 },
      { code: 'USD', name: '美元', symbol: '$', rate: 0.138 },
      { code: 'EUR', name: '欧元', symbol: '€', rate: 0.128 },
      { code: 'JPY', name: '日元', symbol: '¥', rate: 20.5 },
      { code: 'GBP', name: '英镑', symbol: '£', rate: 0.11 },
      { code: 'KRW', name: '韩元', symbol: '₩', rate: 182 },
      { code: 'HKD', name: '港币', symbol: '$', rate: 1.08 },
      { code: 'TWD', name: '新台币', symbol: '$', rate: 4.4 }
    ],
    showFromPicker: false,
    showToPicker: false
  },

  onLoad(options) {
    this.updateCurrencyInfo();
    if (options.amount) {
      this.setData({ amount: options.amount });
      this.calculate();
    }
  },

  onInputAmount(e) {
    this.setData({ amount: e.detail.value });
    this.calculate();
  },

  showFromPicker() {
    this.setData({ showFromPicker: true });
  },

  showToPicker() {
    this.setData({ showToPicker: true });
  },

  selectFrom(e) {
    const code = e.currentTarget.dataset.code;
    this.setData({ 
      fromCurrency: code,
      showFromPicker: false
    });
    this.updateCurrencyInfo();
    this.calculate();
  },

  selectTo(e) {
    const code = e.currentTarget.dataset.code;
    this.setData({ 
      toCurrency: code,
      showToPicker: false
    });
    this.updateCurrencyInfo();
    this.calculate();
  },

  updateCurrencyInfo() {
    const { currencies, fromCurrency, toCurrency } = this.data;
    const fromCurr = currencies.find(c => c.code === fromCurrency);
    const toCurr = currencies.find(c => c.code === toCurrency);
    
    this.setData({
      fromSymbol: fromCurr.symbol,
      fromName: fromCurr.name,
      toSymbol: toCurr.symbol,
      toName: toCurr.name
    });
  },

  swapCurrency() {
    const { fromCurrency, toCurrency } = this.data;
    this.setData({
      fromCurrency: toCurrency,
      toCurrency: fromCurrency
    });
    this.updateCurrencyInfo();
    this.calculate();
  },

  calculate() {
    const { amount, fromCurrency, toCurrency, currencies } = this.data;
    if (!amount || isNaN(amount)) {
      this.setData({ result: '' });
      return;
    }

    const fromRate = currencies.find(c => c.code === fromCurrency).rate;
    const toRate = currencies.find(c => c.code === toCurrency).rate;
    
    // 以人民币为基准计算
    const rmbAmount = parseFloat(amount) / fromRate;
    const finalResult = (rmbAmount * toRate).toFixed(2);
    
    this.setData({ result: finalResult });
  },

  copyResult() {
    if (!this.data.result) return;
    wx.setClipboardData({
      data: this.data.result,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  }
});