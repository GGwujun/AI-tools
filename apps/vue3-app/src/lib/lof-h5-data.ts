export type OpportunityItem = {
  code: string
  name: string
  change: string
  premium: string
  risk: string
  volume: string
  tags: string[]
  category?: 'stock_lof' | 'index_lof' | 'etf' | 'bond'
  status?: 'subscribable' | 'limited' | 'paused' | 't0'
  cycle?: 't1' | 't2' | 't3' | 'long'
  type?: 'fund' | 'bond'
  chartColor?: string
  chart?: number[]
  badge?: string
}

export const overviewMetrics = [
  { label: '可关注机会', value: '23', note: '较昨日 +4' },
  { label: '高溢价信号', value: '6', note: '较昨日 +2' },
  { label: '跟踪ETF数', value: '12', note: '较昨日 -3' },
  { label: '风险变化', value: '2', note: '较昨日 +1' },
]

export const todayOpportunity: OpportunityItem = {
  code: '160629',
  name: '鹏华中证传媒LOF',
  change: '3.25%',
  premium: '0.48%',
  risk: '68%',
  volume: '5万',
  tags: ['历史走势', '可申购', '中风险'],
  category: 'stock_lof',
  status: 'subscribable',
  cycle: 't2',
  type: 'fund',
}

export const opportunityList: OpportunityItem[] = [
  todayOpportunity,
  { code: '160616', name: '华夏中证500LOF', change: '2.18%', premium: '0.35%', risk: '62%', volume: '3万', tags: ['可申购', '中风险'], category: 'index_lof', status: 'subscribable', cycle: 't2', type: 'fund' },
  { code: '160618', name: '嘉实新兴产业LOF', change: '1.86%', premium: '0.42%', risk: '58%', volume: '2万', tags: ['可申购', '中风险'], category: 'stock_lof', status: 'limited', cycle: 't2', type: 'fund' },
  { code: '160625', name: '易方达消费行业LOF', change: '1.75%', premium: '0.41%', risk: '57%', volume: '2万', tags: ['可申购', '中风险'], category: 'stock_lof', status: 'subscribable', cycle: 't3', type: 'fund' },
  { code: '510048', name: '汇添富中证主要消费LOF', change: '1.63%', premium: '0.38%', risk: '55%', volume: '1万', tags: ['低波动', '中风险'], category: 'etf', status: 't0', cycle: 't1', type: 'fund' },
]

export const fundStats = [
  { label: '当前价格', value: '1.352', hint: '估值前更新' },
  { label: '目标估值', value: '1.309', hint: '昨日估值' },
  { label: '溢价率', value: '3.25%', hint: '历史均值 2.18%' },
  { label: '估值变化', value: '0.48%', hint: '近 5 日偏离' },
  { label: '日成交额', value: '2.18亿', hint: '成交活跃' },
  { label: '成交量', value: '1.28亿', hint: '近 5 日均量' },
  { label: '份额变化', value: '+1200万', hint: '升申赎比' },
  { label: '可申购状态', value: '可申购', hint: 'T+1' },
]

export const realtimeOrderbook = [
  ['5', '1.356', '1.348', '3.55%', '1200'],
  ['4', '1.355', '1.347', '3.48%', '980'],
  ['3', '1.354', '1.346', '3.40%', '860'],
  ['2', '1.353', '1.345', '3.33%', '750'],
  ['1', '1.352', '1.344', '3.25%', '620'],
]

export const historyRows = [
  ['04-24', '1.309', '3.25%', '3.18%', '0.07%', '+1200'],
  ['04-23', '1.297', '2.18%', '2.12%', '0.06%', '+800'],
  ['04-22', '1.285', '1.66%', '1.80%', '0.06%', '+600'],
  ['04-19', '1.278', '0.95%', '0.91%', '0.04%', '+300'],
  ['04-18', '1.275', '-0.12%', '-0.14%', '-0.02%', '-200'],
  ['04-17', '1.280', '-0.45%', '-0.48%', '0.03%', '-400'],
  ['04-16', '1.286', '0.28%', '0.26%', '0.04%', '+250'],
  ['04-15', '1.283', '0.57%', '0.71%', '0.04%', '+500'],
]

export const strategyCards = [
  { title: '半仓试错', note: '说明', content: '溢价已回到基础阈值，但仍需观察后续波动变化。' },
  { title: '分批申购', note: '进阶思路', content: '适合溢价修复分层，本轮仍以执行纪律的方案为主。' },
]

export const convertibleCoreStats = [
  { label: '转债价格', value: '102.35' },
  { label: '转股价值', value: '98.76' },
  { label: '转股溢价率', value: '3.62%' },
  { label: '双低值', value: '18.3' },
  { label: '估值中位数', value: '95.20' },
  { label: '剩余规模', value: '1.85亿' },
  { label: '剩余年限', value: '6.21亿' },
  { label: '到期年限', value: '2.35年' },
  { label: '强赎状态', value: '低风险' },
]

export const riskChecklist = [
  { label: '距离触发强赎', value: '15/30 | 130%' },
  { label: '距离回售触发溢价', value: '-4.5%' },
  { label: '强赎观察剩余计时', value: '5 个交易日' },
  { label: '距离可下修触发时间', value: '18/30 天' },
]

export const watchlistItems: OpportunityItem[] = [
  { ...todayOpportunity, chartColor: '#f45f5f', chart: [18, 22, 26, 24, 32, 45, 53, 60], badge: '达预警提醒' },
  { code: '123456', name: '岭南转债', change: '18.3', premium: '实时估值', risk: '双低 102.35', volume: '10:15', tags: ['低风险'], category: 'bond', type: 'bond', chartColor: '#3bb88f', chart: [14, 16, 18, 17, 21, 24, 27, 31], badge: '进入低估区' },
  { code: '160016', name: '华夏中证500LOF', change: '2.18%', premium: '提示日', risk: '折价 0.35%', volume: '09:22', tags: ['中风险'], category: 'index_lof', type: 'fund', chartColor: '#ff7f57', chart: [16, 15, 19, 23, 21, 29, 34, 38], badge: '预计日内上行' },
  { code: '112356', name: '大秦转债', change: '1.33', premium: '双低前列', risk: '剩余规模小', volume: '08:45', tags: ['低风险'], category: 'bond', type: 'bond', chartColor: '#ff6655', chart: [12, 14, 13, 15, 19, 20, 24, 28], badge: '强赎倒计时' },
]

export const calendarDays = [
  ['', '', '', '', '1', '2', '3'],
  ['4', '3', '7', '8', '8', '9', '10'],
  ['13', '15', '18', '18', '10', '13', '17'],
  ['22', '23', '28', '27', '22', '24', '26'],
  ['28', '29', '30', '', '', '', '25'],
]

export const reminderItems = [
  { title: '鹏华中证传媒LOF', note: '折价提醒', time: '预计 T+2', accent: 'red' },
  { title: '华夏中证500LOF', note: '折价提醒', time: '预计 T+2', accent: 'orange' },
  { title: '新时代申购·XX转债', note: '申购日', time: '中签日', accent: 'red' },
  { title: '岭南转债', note: '强赎倒计时', time: '18/30', accent: 'green' },
]

export const filterGroups = [
  { title: '机会类型', options: ['全部', 'LOF', 'ETF', 'QDII', '可转债'] },
  { title: '一级分类', options: ['全部', '股债性LOF', '指数型LOF', '无套利ETF'] },
  { title: '状态', options: ['全部', '可申购', '限额开放', '暂停申购', '可T+0'] },
  { title: '风险评级', options: ['全部', '低风险', '中风险', '高风险'] },
  { title: '到账周期', options: ['全部', 'T+1', 'T+2', 'T+3', '更长'] },
]

export const mineServices = [
  { title: '风险偏好设置', note: '稳健型' },
  { title: '策略偏好设置', note: '到期赎回' },
  { title: '消息通知设置', note: '已开启' },
  { title: '新手教学', note: '查看说明' },
  { title: '帮助与反馈', note: '常见问题' },
  { title: '关于我们', note: '版本信息' },
]

export const settingsNoticeTypes = ['溢价机会', '限额申购', '申购状态变化', '到账提醒', '可转债提醒', '双低区间', '强赎预警', '折价机会']
