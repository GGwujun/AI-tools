function parsePercent(value) {
  return Number(String(value).replace('%', '')) || 0;
}

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
    sortField: 'code',
    sortOrder: 'desc',
    sortIndicators: {
      code: '↓',
      annualized: '↓',
      followed: '↓',
      remainingYears: '↓'
    },
    funds: [
      {
        code: '506006',
        name: '汇添富科创板',
        venuePrice: '1.221',
        changeRate: '1.33%',
        daySpread: '1.56%',
        weekSpread: '0.49%',
        discountRate: '8.24%',
        annualized: '24.25%',
        remainingYears: 0.34,
        remainingText: '0.34年',
        followed: false
      },
      {
        code: '506003',
        name: '富国科创板',
        venuePrice: '1.020',
        changeRate: '1.49%',
        daySpread: '0.21%',
        weekSpread: '0.35%',
        discountRate: '8.09%',
        annualized: '23.82%',
        remainingYears: 0.34,
        remainingText: '0.34年',
        followed: false
      },
      {
        code: '506000',
        name: '科创板基金',
        venuePrice: '1.149',
        changeRate: '0.79%',
        daySpread: '0.26%',
        weekSpread: '0.93%',
        discountRate: '7.84%',
        annualized: '22.90%',
        remainingYears: 0.34,
        remainingText: '0.34年',
        followed: false
      },
      {
        code: '506005',
        name: '科创板博时',
        venuePrice: '1.430',
        changeRate: '1.63%',
        daySpread: '0.43%',
        weekSpread: '0.24%',
        discountRate: '7.07%',
        annualized: '23.46%',
        remainingYears: 0.30,
        remainingText: '0.30年',
        followed: false
      },
      {
        code: '506001',
        name: '万家科创板',
        venuePrice: '1.341',
        changeRate: '0.98%',
        daySpread: '1.19%',
        weekSpread: '1.77%',
        discountRate: '7.92%',
        annualized: '21.91%',
        remainingYears: 0.36,
        remainingText: '0.36年',
        followed: false
      },
      {
        code: '160143',
        name: '创业板定开南方',
        venuePrice: '1.453',
        changeRate: '1.75%',
        daySpread: '1.40%',
        weekSpread: '0.51%',
        discountRate: '7.53%',
        annualized: '20.83%',
        remainingYears: 0.36,
        remainingText: '0.36年',
        followed: false
      },
      {
        code: '160926',
        name: '创业板定开',
        venuePrice: '1.105',
        changeRate: '1.01%',
        daySpread: '0.62%',
        weekSpread: '-0.01%',
        discountRate: '6.22%',
        annualized: '20.09%',
        remainingYears: 0.31,
        remainingText: '0.31年',
        followed: false
      }
    ],
    displayFunds: []
  },

  onLoad() {
    this.setData({
      updateTime: formatUpdateTime()
    });
    this.refreshDisplayFunds();
  },

  refreshDisplayFunds() {
    const { funds, sortField, sortOrder } = this.data;
    const factor = sortOrder === 'desc' ? -1 : 1;
    const sortedFunds = [...funds].sort((left, right) => {
      if (sortField === 'code') {
        return factor * (Number(left.code) - Number(right.code));
      }

      if (sortField === 'annualized') {
        return factor * (parsePercent(left.annualized) - parsePercent(right.annualized));
      }

      if (sortField === 'remainingYears') {
        return factor * (left.remainingYears - right.remainingYears);
      }

      if (sortField === 'followed') {
        return factor * (Number(left.followed) - Number(right.followed));
      }

      return 0;
    });

    this.setData({
      displayFunds: sortedFunds.map((item, index) => ({
        ...item,
        weekSpreadTone: String(item.weekSpread).startsWith('-') ? 'down' : '',
        rowClass: index % 2 === 1 ? 'alt' : ''
      }))
    });
  },

  onSort(e) {
    const field = e.currentTarget.dataset.field;
    let { sortField, sortOrder } = this.data;

    if (sortField === field) {
      sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    } else {
      sortField = field;
      sortOrder = 'desc';
    }

    this.setData({
      sortField,
      sortOrder,
      sortIndicators: {
        code: sortField === 'code' ? (sortOrder === 'desc' ? '↓' : '↑') : '↓',
        annualized: sortField === 'annualized' ? (sortOrder === 'desc' ? '↓' : '↑') : '↓',
        followed: sortField === 'followed' ? (sortOrder === 'desc' ? '↓' : '↑') : '↓',
        remainingYears: sortField === 'remainingYears' ? (sortOrder === 'desc' ? '↓' : '↑') : '↓'
      }
    }, () => {
      this.refreshDisplayFunds();
    });
  },

  onToggleFollow(e) {
    const code = e.currentTarget.dataset.code;
    const funds = this.data.funds.map((item) => {
      if (item.code !== code) {
        return item;
      }

      return {
        ...item,
        followed: !item.followed
      };
    });

    this.setData({ funds }, () => {
      this.refreshDisplayFunds();
    });
  }
});
