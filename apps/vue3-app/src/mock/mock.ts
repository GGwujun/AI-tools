import Mock from 'mockjs'
import type {
  AdvancedSettings,
  BasicSettings,
  BondDetailResponse,
  BondLotteryItem,
  BondLotteryQueryResponse,
  BondLotteryResponse,
  BondSubscribeItem,
  BondSubscribeListResponse,
  SaveAiAnalysisResponse,
  SaveCalendarResponse,
  SaveFundDetailResponse,
  SaveFundItem,
  SaveFundListResponse,
  SaveFilterOptionsResponse,
  SaveHomeResponse,
  SaveProfileResponse,
  SaveWatchlistResponse,
  SettingsResponse,
} from '@/lib/save-api'

const mockBase = '/fund-api/api/save'

const tabs = [
  { key: 'stock_lof', name: '股债型LOF', description: '更适合看历史套利统计与样本表现', note: '历史样本更充分' },
  { key: 'index_lof', name: '指数型LOF', description: '更适合看折溢价与估值误差', note: '更适合跟踪估值' },
  { key: 'etf', name: '无时差ETF', description: '更适合看实时盘口与折溢价变化', note: '更适合盘中观察' },
  { key: 'favorites', name: '自选', description: '查看你重点关注的标的', note: '便于统一跟踪' },
  { key: 'opportunity', name: '今日机会', description: '系统筛出的可关注标的', note: '仅供参考' },
] as const

const syncStatus = {
  status: 'success',
  message: '以下内容基于历史数据、规则模型与公开信息生成，仅供参考。',
  last_started_at: '2026-05-01 09:20:00',
  last_success_at: '2026-05-01 11:20:00',
  last_finished_at: '2026-05-01 11:20:05',
  last_synced_count: 28,
}

let basicSettings: BasicSettings = {
  master_enabled: true,
  market_enabled: true,
  followed_enabled: true,
  optional_enabled: true,
  alert_threshold: 0.5,
}

let advancedSettings: AdvancedSettings = {
  fund_arbitrage_enabled: true,
  stock_lof_enabled: true,
  index_lof_enabled: true,
  other_lof_enabled: false,
  premium_threshold: 0.5,
  discount_threshold: -1,
  turnover_threshold: 100,
  realtime_premium_enabled: true,
  buy1_amount_threshold: 5000,
  realtime_premium_threshold: 1.88,
  closed_fund_discount_enabled: false,
  morning_subscribe_enabled: true,
  afternoon_subscribe_enabled: false,
  convertible_bond_list_enabled: true,
  convertible_bond_redeem_enabled: true,
  convertible_bond_expected_redeem_enabled: true,
  convertible_bond_lower_enabled: false,
  convertible_bond_lag_enabled: true,
  bond_price_threshold: '100',
  bond_premium_threshold: '20',
  convertible_bond_median_enabled: true,
}

let favoriteCodes = new Set(['160629', '123456'])

const allFunds: SaveFundItem[] = [
  createFund('160629', '鹏华中证传媒LOF', 'stock_lof', 1.352, 1.309, 3.25, true, false, '可申购', '股债型LOF'),
  createFund('160616', '华夏中证500LOF', 'index_lof', 1.287, 1.258, 2.18, true, false, '可申购', '指数型LOF'),
  createFund('160618', '嘉实新兴产业LOF', 'stock_lof', 1.196, 1.174, 1.86, true, false, '限额开放', '股债型LOF'),
  createFund('160625', '易方达消费行业LOF', 'stock_lof', 1.088, 1.070, 1.75, true, false, '可申购', '股债型LOF'),
  createFund('510048', '汇添富中证主要消费ETF', 'etf', 1.063, 1.047, 1.63, true, false, '可T+0', '无时差ETF'),
]

const bondSubscribeItems: BondSubscribeItem[] = [
  {
    code: '123001',
    name: '新能转债',
    subscribe_date: '2026-05-06',
    pay_date: '2026-05-07',
    listing_date: '2026-05-20',
    stock_name: '新能科技',
    stock_code: '300001',
    convert_value: 98.2,
    premium_rate: 3.26,
    issue_size: '38亿',
    rating: 'AA+',
    reference_price: 28.5,
    reference_price_change: 2.16,
    circulation_scale: '中等',
    themes: ['新能源', '机器人'],
    suggestion: '仅供参考：中签后关注上市首日强弱',
    paused: false,
    limit_tag: '可申购',
  },
  {
    code: '123002',
    name: '医药转债',
    subscribe_date: '2026-05-08',
    pay_date: '2026-05-09',
    listing_date: '2026-05-23',
    stock_name: '康宁医药',
    stock_code: '300002',
    convert_value: 101.4,
    premium_rate: 1.28,
    issue_size: '24亿',
    rating: 'AA',
    reference_price: 19.8,
    reference_price_change: 0.82,
    circulation_scale: '偏小',
    themes: ['医疗', '创新药'],
    suggestion: '仅供参考：偏防守标的，关注规模与上市情绪',
    paused: false,
    limit_tag: '关注',
  },
]

const bondLotteryItems: BondLotteryItem[] = [
  {
    code: '123001',
    name: '新能转债',
    winning_rate: 0.018,
    announce_date: '2026-05-08',
    listing_date: '2026-05-20',
    groups: [
      { label: '末“4”位数', suffixes: ['1532', '6032', '9032'] },
      { label: '末“5”位数', suffixes: ['10618', '88618'] },
      { label: '末“6”位数', suffixes: ['018625', '118625'] },
    ],
  },
  {
    code: '123002',
    name: '医药转债',
    winning_rate: 0.012,
    announce_date: '2026-05-10',
    listing_date: '2026-05-23',
    groups: [
      { label: '末“4”位数', suffixes: ['2258', '6658', '9258'] },
      { label: '末“5”位数', suffixes: ['10688', '88688'] },
    ],
  },
]

function createFund(
  code: string,
  name: string,
  marketType: string,
  marketPrice: number,
  navPrice: number,
  premiumRate: number,
  starred: boolean,
  paused: boolean,
  fundState: string,
  fundType: string,
): SaveFundItem {
  return {
    code,
    market_type: marketType,
    name,
    market: 'SZ',
    market_price: marketPrice,
    market_price_display: marketPrice.toFixed(3),
    nav_price: navPrice,
    nav_price_display: navPrice.toFixed(3),
    premium_rate: premiumRate,
    premium_display: `${premiumRate.toFixed(2)}%`,
    up: premiumRate >= 0,
    starred,
    paused,
    down_days: 3,
    max_down_days: 5,
    fund_state: fundState,
    fund_type: fundType,
    is_no_gap: marketType === 'etf',
    market_time: '2026-05-01 11:20:00',
    nav_date: '2026-04-30',
  }
}

function buildList(tab: string): SaveFundListResponse {
  const currentTab = tab || 'stock_lof'
  const funds =
    currentTab === 'favorites'
      ? allFunds.filter((item) => favoriteCodes.has(item.code))
      : currentTab === 'opportunity'
        ? allFunds.slice(0, 4)
        : allFunds.filter((item) => item.market_type === currentTab)

  return Mock.mock({
    success: true,
    current_tab: currentTab,
    tabs,
    funds: funds.map((item) => ({ ...item, starred: favoriteCodes.has(item.code) })),
    special_notes: [
      '当前内容仅供参考，不构成投资建议',
      '建议先看历史统计，再看实时数据与风险提示',
    ],
    update_time: '2026-05-01 11:20:00',
    stats: {
      current_count: funds.length,
      favorite_count: favoriteCodes.size,
    },
    sync_status: syncStatus,
  })
}

function createMockCategoryFunds(
  marketType: 'stock_lof' | 'index_lof' | 'etf' | 'bond',
  rows: Array<[string, string, string, string, string, string]>,
): SaveFundItem[] {
  return rows.map(([name, code, premiumText, priceText, state, fundType], index) => {
    const premiumValue = Number.parseFloat(premiumText.replace('%', '')) || 0
    const marketPrice = Number.parseFloat(priceText) || 0
    const navPrice =
      marketType === 'bond'
        ? Math.max(80, marketPrice - 3.2 - index * 0.15)
        : Math.max(0.1, marketPrice - premiumValue / 100 - index * 0.002)

    return createFund(
      code,
      name,
      marketType,
      marketPrice,
      navPrice,
      premiumValue,
      favoriteCodes.has(code),
      false,
      state,
      fundType,
    )
  })
}

function buildMockFunds(tab: string): SaveFundItem[] {
  const stockLofFunds = createMockCategoryFunds('stock_lof', [
    ['鹏华中证传媒LOF', '160629', '3.25%', '0.48', '可申购', '股债型LOF'],
    ['华夏中证500LOF', '160616', '2.18%', '0.35', '可申购', '股债型LOF'],
    ['富安达消费主题LOF', '160518', '1.86%', '0.42', '限额开放', '股债型LOF'],
    ['易方达消费LOF', '110022', '1.75%', '0.41', '可申购', '股债型LOF'],
    ['汇添富中证主要消费LOF', '501048', '1.63%', '0.38', '可申购', '股债型LOF'],
    ['招商中证白酒LOF', '161725', '1.42%', '0.22', '可申购', '股债型LOF'],
    ['景顺长城沪港深精选LOF', '501301', '1.25%', '0.36', '限额友好', '股债型LOF'],
    ['南方中证500LOF', '160119', '1.15%', '0.33', '可申购', '股债型LOF'],
    ['汇银瑞信文体产业LOF', '164813', '0.98%', '0.39', '可申购', '股债型LOF'],
    ['国泰大农业LOF', '160505', '0.86%', '0.19', '可申购', '股债型LOF'],
    ['广发多因子LOF', '162719', '0.72%', '0.21', '限额友好', '股债型LOF'],
    ['华宝生态中国LOF', '501000', '0.65%', '0.27', '可申购', '股债型LOF'],
    ['兴全合润LOF', '163406', '0.58%', '0.18', '可申购', '股债型LOF'],
    ['国联安中证医药LOF', '162415', '0.52%', '0.16', '可申购', '股债型LOF'],
    ['银华抗通胀LOF', '161815', '0.46%', '0.15', '限额开放', '股债型LOF'],
    ['万家双引擎LOF', '161903', '0.39%', '0.14', '可申购', '股债型LOF'],
  ])

  const indexLofFunds = createMockCategoryFunds('index_lof', [
    ['华夏沪深300LOF', '510300', '2.32%', '0.31', '可申购', '指数型LOF'],
    ['易方达沪深300LOF', '160706', '1.95%', '0.28', '可申购', '指数型LOF'],
    ['南方中证500LOF', '160119', '1.68%', '0.26', '可申购', '指数型LOF'],
    ['招商中证白酒LOF', '161725', '1.42%', '0.22', '可申购', '指数型LOF'],
    ['景顺长城沪港深LOF', '501045', '1.25%', '0.19', '可申购', '指数型LOF'],
    ['嘉实中证科技LOF', '160211', '1.18%', '0.21', '限额开放', '指数型LOF'],
    ['天弘中证军工LOF', '164402', '1.03%', '0.18', '可申购', '指数型LOF'],
    ['富国中证新能源LOF', '161028', '0.96%', '0.16', '可申购', '指数型LOF'],
    ['华安创业板LOF', '160420', '0.88%', '0.14', '可申购', '指数型LOF'],
    ['融通深证100LOF', '161604', '0.74%', '0.13', '限额友好', '指数型LOF'],
  ])

  const etfFunds = createMockCategoryFunds('etf', [
    ['国泰中证煤炭ETF', '510883', '1.48%', '1.132', '可T+0', '无时差ETF'],
    ['华泰柏瑞红利ETF', '515790', '1.23%', '1.109', '可T+0', '无时差ETF'],
    ['南方中证银行ETF', '512070', '1.15%', '1.103', '可T+0', '无时差ETF'],
    ['鹏华中证军工ETF', '159915', '0.98%', '1.087', '可T+0', '无时差ETF'],
    ['广发中证基建ETF', '159607', '0.88%', '1.079', '可T+0', '无时差ETF'],
    ['易方达黄金ETF', '159934', '0.75%', '1.062', '可T+0', '无时差ETF'],
    ['华夏恒生ETF', '159920', '0.68%', '1.041', '可T+0', '无时差ETF'],
    ['博时标普ETF', '513500', '0.62%', '1.036', '可T+0', '无时差ETF'],
  ])

  const bondFunds = createMockCategoryFunds('bond', [
    ['岭南转债', '123456', '18.3', '132', '低强赎风险', '可转债'],
    ['赛力转债', '123458', '16.8', '128', '双低', '可转债'],
    ['天阳转债', '123457', '15.4', '135', '双低', '可转债'],
    ['明电转债', '123459', '14.2', '138', '低溢价', '可转债'],
    ['新致转债', '123460', '13.8', '142', '低溢价', '可转债'],
    ['拓普转债', '123461', '12.6', '145', '中风险', '可转债'],
    ['长汽转债', '123462', '11.9', '148', '中风险', '可转债'],
    ['芯能转债', '123463', '10.8', '151', '中风险', '可转债'],
  ])

  const allMockFunds = [...stockLofFunds, ...indexLofFunds, ...etfFunds, ...bondFunds]
  if (tab === 'favorites') return allMockFunds.filter((item) => favoriteCodes.has(item.code))
  if (tab === 'opportunity') return [...stockLofFunds.slice(0, 2), ...indexLofFunds.slice(0, 1), ...etfFunds.slice(0, 1), ...bondFunds.slice(0, 2)]
  if (tab === 'bond') return bondFunds
  return allMockFunds.filter((item) => item.market_type === tab)
}

function buildPagedList(tab: string, page = 1, pageSize = 20): SaveFundListResponse {
  const currentTab = tab || 'stock_lof'
  const funds = buildMockFunds(currentTab)
  const safePage = Math.max(1, page)
  const safePageSize = Math.max(1, pageSize)
  const start = (safePage - 1) * safePageSize
  const pagedFunds = funds.slice(start, start + safePageSize)

  return {
    success: true,
    current_tab: currentTab,
    tabs: tabs as unknown as SaveFundListResponse['tabs'],
    funds: pagedFunds.map((item) => ({ ...item, starred: favoriteCodes.has(item.code) })),
    special_notes: [
      '当前内容仅供参考，不构成投资建议',
      '建议先看历史统计，再看实时数据与风险提示',
    ],
    update_time: '2026-05-01 11:20:00',
    page: safePage,
    page_size: safePageSize,
    total: funds.length,
    has_more: start + pagedFunds.length < funds.length,
    stats: {
      current_count: funds.length,
      favorite_count: favoriteCodes.size,
    },
    sync_status: syncStatus,
  }
}

function buildHome(tab: string): SaveHomeResponse {
  const currentTab = tab || 'stock_lof'
  const stockLofItems = allFunds
    .filter((item) => item.market_type === 'stock_lof')
    .slice(0, 3)
    .map((item, index) => ({
      ...item,
      premium_display: ['3.25%', '1.86%', '1.75%'][index] || item.premium_display,
      market_price_display: ['0.48%', '0.42%', '0.41%'][index] || item.market_price_display,
      fund_state: ['历史走势', '可申购', '中风险'][index] || item.fund_state,
    }))

  const indexItems = [
    {
      ...allFunds.find((item) => item.market_type === 'index_lof')!,
      premium_display: '2.18%',
      market_price_display: '0.35%',
      fund_state: '中风险',
    },
  ]

  const etfItems = [
    {
      ...allFunds.find((item) => item.market_type === 'etf')!,
      premium_display: '1.63%',
      market_price_display: '0.38%',
      fund_state: '低波动',
    },
  ]

  const sections = [
    { key: 'stock_lof', title: '股债型LOF 今日机会', items: stockLofItems },
    { key: 'index_lof', title: '指数型LOF 今日机会', items: indexItems },
    { key: 'etf', title: '无时差ETF 今日机会', items: etfItems },
    {
      key: 'bond',
      title: '可转债 今日机会',
      items: [
        createFund('123456', '岭南转债', 'bond', 102.35, 98.76, 3.62, favoriteCodes.has('123456'), false, '双低可关注', '可转债'),
      ],
    },
  ]

  return {
    success: true,
    update_time: '2026-05-01 11:20:00',
    risk_notice: 'ETF 日历已更新，了解最新套利机会',
    current_tab: currentTab,
    tabs,
    overview: [
      { label: '可关注机会', value: '23', note: '较昨日 +4' },
      { label: '高溢价信号', value: '6', note: '较昨日 +2' },
      { label: '跟踪ETF数', value: '12', note: '较昨日 -3' },
      { label: '风险变化', value: '2', note: '较昨日 +1' },
    ],
    ai_summary:
      '今天基金套利机会分布均衡，股债型LOF的历史样本优势更明显，可优先关注交易量匹配且估值回落的标的，仅供参考。',
    featured: [
      {
        ...allFunds[0],
        premium_display: '3.25%',
        market_price_display: '0.48%',
        nav_price_display: '68%',
        fund_state: '可申购',
      },
      createFund('123456', '岭南转债', 'bond', 102.35, 98.76, 3.62, favoriteCodes.has('123456'), false, '双低可关注', '可转债'),
    ],
    sections,
  }
}

function buildFundDetail(code: string): SaveFundDetailResponse {
  const fund = allFunds.find((item) => item.code === code) || allFunds[0]
  return Mock.mock({
    success: true,
    update_time: '2026-05-01 11:20:00',
    sync_status: syncStatus,
    fund: {
      ...fund,
      starred: favoriteCodes.has(fund.code),
    },
    five_level: {
      update_time: '2026-05-01 11:20:00',
      ask: [
        { price: 1.356, volume: '1200', premium: '3.55%' },
        { price: 1.355, volume: '980', premium: '3.48%' },
        { price: 1.354, volume: '860', premium: '3.40%' },
      ],
      bid: [
        { price: 1.352, volume: '620', premium: '3.25%' },
        { price: 1.351, volume: '510', premium: '3.18%' },
        { price: 1.350, volume: '430', premium: '3.10%' },
      ],
    },
    nav_history: [
      { date: '04-24', nav: 1.309, nav_change: '3.25%', premium: '3.18%', estimated_profit: '+1200' },
      { date: '04-23', nav: 1.297, nav_change: '2.18%', premium: '2.12%', estimated_profit: '+800' },
      { date: '04-22', nav: 1.285, nav_change: '1.66%', premium: '1.80%', estimated_profit: '+600' },
      { date: '04-21', nav: 1.278, nav_change: '0.95%', premium: '0.91%', estimated_profit: '+300' },
    ],
    arbitrage_strategies: [
      {
        title: '半仓试错',
        strategy: '当前已达到基础阈值，但仍需观察后续误差变化，仅供参考。',
        success_rate: '68%',
        occurrence_count: '124',
        total_return: '58.27%',
        probability: '18.79%',
        start_time: '2023-01-01',
      },
      {
        title: '分批申购',
        strategy: '适合溢价有分层、希望分散节奏的场景，仅供参考。',
        success_rate: '93.3%',
        occurrence_count: '75',
        total_return: '52.33%',
        probability: '11.36%',
        start_time: '2023-01-01',
      },
    ],
    scale: '26.3亿',
    turnover: '2.18亿',
  })
}

function buildBondDetail(code: string): BondDetailResponse {
  return {
    success: true,
    update_time: '2026-05-01 11:20:00',
    bond: {
      code,
      name: '岭南转债',
      stock_name: '岭南科技',
      tags: ['双低', '低强赎风险', '中风险'],
      price: '102.35',
      convert_value: '98.76',
      premium_rate: '3.62%',
      dual_low: '18.3',
      pure_bond_value: '95.20',
      maturity_yield: '1.85%',
      scale: '6.21亿',
      remain_years: '2.35年',
      redeem_status: '低风险',
      last_trade_date: '2026-05-08',
      last_convert_date: '2026-05-09',
    },
    conclusion: {
      title: '当前处于可关注双低区间，仅供参考',
      summary: '主要逻辑来自双低值与低溢价的防御配置窗口。',
      risk: '主要风险来自正股波动与资金拥挤变化。',
    },
    strategy_cards: [
      {
        title: '双低关注',
        summary: '估值相对合理，更适合耐心跟踪，仅供参考。',
        position: '适合分批关注',
        exit: '若高溢价快速拔高，可分批降低关注仓位',
        risk: '正股回撤可能影响弹性表现',
      },
      {
        title: '强赎回避',
        summary: '强赎风险抬升时，应优先处理时间风险，仅供参考。',
        position: '更适合谨慎处理',
        exit: '关注最后交易日与最后转股日',
        risk: '忽略强赎节奏可能带来被动风险',
      },
    ],
    risk_items: [
      { label: '距离触发强赎', value: '15/30 | 130%' },
      { label: '距离回售触发溢价', value: '-4.5%' },
      { label: '强赎观察剩余计时', value: '5 个交易日' },
      { label: '距离可下修触发时间', value: '18/30 天' },
    ],
  }
}

function buildSettings(): SettingsResponse {
  return {
    success: true,
    update_time: '2026-05-01 11:20:00',
    basic_settings: basicSettings,
    advanced_settings: advancedSettings,
  }
}

function buildWatchlist(): SaveWatchlistResponse {
  return {
    success: true,
    update_time: '2026-05-01 11:20:00',
    summary: {
      funds: 8,
      bonds: 10,
      changed: 5,
      pending: 3,
    },
    items: [
      { code: '160629', name: '鹏华中证传媒LOF', type: 'fund', change: '3.25%', subtitle: '达预警提醒', time: '11:20', badge: '达预警提醒', chart: [18, 22, 26, 24, 32, 45, 53, 60], chart_color: '#f45f5f', starred: favoriteCodes.has('160629') },
      { code: '123456', name: '岭南转债', type: 'bond', change: '18.3', subtitle: '进入低估区', time: '10:15', badge: '进入低估区', chart: [14, 16, 18, 17, 21, 24, 27, 31], chart_color: '#3bb88f', starred: favoriteCodes.has('123456') },
      { code: '160616', name: '华夏中证500LOF', type: 'fund', change: '2.18%', subtitle: '预计日内上行', time: '09:22', badge: '预计日内上行', chart: [16, 15, 19, 23, 21, 29, 34, 38], chart_color: '#ff7f57', starred: favoriteCodes.has('160616') },
      { code: '112356', name: '大秦转债', type: 'bond', change: '1.33', subtitle: '强赎倒计时', time: '08:45', badge: '强赎倒计时', chart: [12, 14, 13, 15, 19, 20, 24, 28], chart_color: '#ff6655', starred: favoriteCodes.has('112356') },
    ],
  }
}

function buildCalendar(filter: string): SaveCalendarResponse {
  return {
    success: true,
    update_time: '2026-05-01 11:20:00',
    month: '2026年04月',
    filters: [
      { key: 'all', label: '全部' },
      { key: 'arrival', label: '基金到账' },
      { key: 'sell', label: '基金卖点' },
      { key: 'new-bond', label: '新债' },
      { key: 'redeem', label: '强赎' },
    ],
    selected_filter: filter || 'all',
    weeks: [
      ['', '', '', '', '1', '2', '3'],
      ['4', '3', '7', '8', '8', '9', '10'],
      ['13', '15', '18', '18', '10', '13', '17'],
      ['22', '23', '28', '27', '22', '24', '26'],
      ['28', '29', '30', '', '', '', '25'],
    ],
    markers: [
      { day: '25', type: 'green', label: '到账' },
      { day: '18', type: 'orange', label: '申购' },
      { day: '22', type: 'red', label: '折价' },
    ],
    events: [
      {
        date: '04月25日',
        weekday: '星期五（今天）',
        title: '今日重点',
        items: [
          { title: '鹏华中证传媒LOF', note: '折价提醒', time: '预计 T+2', accent: 'red' },
          { title: '华夏中证500LOF', note: '折价提醒', time: '预计 T+2', accent: 'orange' },
          { title: '新时代申购·XX转债', note: '申购日', time: '中签日', accent: 'red' },
          { title: '岭南转债', note: '强赎倒计时', time: '18/30', accent: 'green' },
        ],
      },
    ],
  }
}

function buildProfile(): SaveProfileResponse {
  return {
    success: true,
    profile: {
      name: '微信用户 -',
      level: '普通用户',
      member_label: '会员权益',
    },
    quick_actions: [
      { key: 'favorites', label: '我的收藏' },
      { key: 'reminders', label: '我的提醒' },
      { key: 'records', label: '申购记录' },
      { key: 'messages', label: '消息机会' },
    ],
    services: [
      { title: '风险偏好设置', note: '稳健型' },
      { title: '策略偏好设置', note: '到期赎回' },
      { title: '消息通知设置', note: '已开启' },
      { title: '新手教学', note: '查看说明' },
      { title: '帮助与反馈', note: '常见问题' },
      { title: '关于我们', note: '版本信息' },
    ],
  }
}

function buildAiAnalysis(tab: string): SaveAiAnalysisResponse {
  const currentTab = tab || 'opportunity'
  const map: Record<string, { title: string; content: string; keywords: string[] }> = {
    opportunity: {
      title: 'AI 机会解读',
      content:
        '今日股债性 LOF 机会分布较均衡，鹏华传媒位于中高可修复区间。盘中溢价由冲高回落转向缓慢修复，属于可以重点跟踪的机会窗口。若明日开盘仍处在回撤后半段，且成交未同步衰减，可继续观察是否具备低吸配置思路。',
      keywords: ['补水代申', '跟随套利', '双低性价比', '估值错位'],
    },
    watchlist: {
      title: 'AI 自选解读',
      content:
        '自选池中基金与转债分布较均衡，当前需要优先处理的是已进入提醒阈值的折价基金和强赎倒计时转债。建议先关注提醒状态变化，再决定是否继续提高优先级。',
      keywords: ['自选异动', '提醒排序', '优先级重排', '风险变化'],
    },
    risk: {
      title: 'AI 风险雷达',
      content:
        '当前主要风险集中在估值误差扩大、资金拥挤度回升以及部分转债临近强赎观察线。风险并非同步出现，建议以时间节点与状态变化结合看待，仅供参考。',
      keywords: ['误差放大', '拥挤度', '强赎观察', '状态变化'],
    },
    weekly: {
      title: 'AI 本周总结',
      content:
        '本周基金方向的主要机会来自折价修复与限额友好标的，可转债方向则以双低观察与申购节奏为主。整体更适合做观察与轻参与，而不是追逐单点高波动机会。',
      keywords: ['周度回顾', '节奏观察', '套利修复', '轻参与'],
    },
  }
  const selected = map[currentTab] || map.opportunity
  return {
    success: true,
    tabs: [
      { key: 'opportunity', label: '机会解读' },
      { key: 'watchlist', label: '自选解读' },
      { key: 'risk', label: '风险雷达' },
      { key: 'weekly', label: '本周总结' },
    ],
    current_tab: currentTab,
    title: selected.title,
    content: selected.content,
    source: {
      author: '机角',
      time: '今天 09:10',
      likes: 32,
      dislikes: 2,
    },
    keywords: selected.keywords,
  }
}

function buildFilterOptions(): SaveFilterOptionsResponse {
  return {
    success: true,
    groups: [
      { title: '机会类型', options: ['全部', 'LOF', 'ETF', 'QDII', '可转债'], selected: ['全部'] },
      { title: '一级分类', options: ['全部', '股债型LOF', '指数型LOF', '无时差ETF'], selected: ['股债型LOF'] },
      { title: '状态', options: ['全部', '可申购', '限额开放', '暂停申购', '可T+0'], selected: ['可申购'] },
      { title: '风险评级', options: ['全部', '低风险', '中风险', '高风险'], selected: ['低风险'] },
      { title: '到账周期', options: ['全部', 'T+1', 'T+2', 'T+3', '更长'], selected: ['全部'] },
    ],
    sort_options: ['溢价率（从高到低）', '历史成功率', '到账时间', '热度'],
    selected_sort: '溢价率（从高到低）',
  }
}

function buildBondSubscribeList(): BondSubscribeListResponse {
  return {
    success: true,
    update_time: '2026-05-01 11:20:00',
    items: bondSubscribeItems,
  }
}

function buildBondLottery(code?: string): BondLotteryResponse {
  const selected = bondLotteryItems.find((item) => item.code === code) || bondLotteryItems[0]
  return {
    success: true,
    update_time: '2026-05-01 11:20:00',
    selected,
    bonds: bondLotteryItems,
  }
}

function buildLotteryQuery(code: string, allocationNumbers: string): BondLotteryQueryResponse {
  const numbers = allocationNumbers
    .split(/[\s,，]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  const bond = bondLotteryItems.find((item) => item.code === code) || bondLotteryItems[0]
  const hitSet = new Set(bond.groups.flatMap((group) => group.suffixes))

  return {
    success: true,
    code: bond.code,
    name: bond.name,
    update_time: '2026-05-01 11:20:00',
    results: numbers.map((item) => {
      const matchedSuffixes = [...hitSet].filter((suffix) => item.endsWith(suffix))
      return {
        allocation_number: item,
        matched: matchedSuffixes.length > 0,
        hit_labels: matchedSuffixes.length > 0 ? ['末尾号命中'] : [],
        hit_suffixes: matchedSuffixes,
      }
    }),
  }
}

function json(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  )
}

async function parseBody(init?: RequestInit) {
  if (!init?.body) return {}
  try {
    return JSON.parse(String(init.body))
  } catch {
    return {}
  }
}

export function setupMock() {
  const globalFetch = globalThis.fetch?.bind(globalThis)
  if (!globalFetch || typeof window === 'undefined') return

  if ((window as Window & { __LOF_H5_MOCK__?: boolean }).__LOF_H5_MOCK__) return
  ;(window as Window & { __LOF_H5_MOCK__?: boolean }).__LOF_H5_MOCK__ = true

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const url = new URL(requestUrl, window.location.origin)
    const path = url.pathname

    if (!path.startsWith(mockBase)) {
      return globalFetch(input, init)
    }

    if (path === `${mockBase}/funds` && (!init?.method || init.method === 'GET')) {
      return json(
        buildPagedList(
          url.searchParams.get('tab') || 'stock_lof',
          Number.parseInt(url.searchParams.get('page') || '1', 10),
          Number.parseInt(url.searchParams.get('page_size') || '20', 10),
        ),
      )
    }

    if (path === `${mockBase}/home` && (!init?.method || init.method === 'GET')) {
      return json(buildHome(url.searchParams.get('tab') || 'stock_lof'))
    }

    const detailMatch = path.match(/\/funds\/([^/]+)\/([^/]+)$/)
    if (detailMatch && (!init?.method || init.method === 'GET')) {
      return json(buildFundDetail(detailMatch[2]))
    }

    const bondDetailMatch = path.match(/\/bonds\/detail\/([^/]+)$/)
    if (bondDetailMatch && (!init?.method || init.method === 'GET')) {
      return json(buildBondDetail(bondDetailMatch[1]))
    }

    if (path === `${mockBase}/settings` && (!init?.method || init.method === 'GET')) {
      return json(buildSettings())
    }

    if (path === `${mockBase}/watchlist` && (!init?.method || init.method === 'GET')) {
      return json(buildWatchlist())
    }

    if (path === `${mockBase}/calendar` && (!init?.method || init.method === 'GET')) {
      return json(buildCalendar(url.searchParams.get('filter') || 'all'))
    }

    if (path === `${mockBase}/profile` && (!init?.method || init.method === 'GET')) {
      return json(buildProfile())
    }

    if (path === `${mockBase}/analysis` && (!init?.method || init.method === 'GET')) {
      return json(buildAiAnalysis(url.searchParams.get('tab') || 'opportunity'))
    }

    if (path === `${mockBase}/filter-options` && (!init?.method || init.method === 'GET')) {
      return json(buildFilterOptions())
    }

    if (path === `${mockBase}/settings/basic` && init?.method === 'PUT') {
      basicSettings = { ...(await parseBody(init)) }
      return json(buildSettings())
    }

    if (path === `${mockBase}/settings/advanced` && init?.method === 'PUT') {
      advancedSettings = { ...(await parseBody(init)) }
      return json(buildSettings())
    }

    const favoriteMatch = path.match(/\/favorites\/([^/]+)\/([^/]+)$/)
    if (favoriteMatch && init?.method === 'PUT') {
      const payload = (await parseBody(init)) as { starred?: boolean }
      if (payload.starred) favoriteCodes.add(favoriteMatch[2])
      else favoriteCodes.delete(favoriteMatch[2])
      return json({
        success: true,
        starred: !!payload.starred,
        favorite_count: favoriteCodes.size,
      })
    }

    if (path === `${mockBase}/bonds/subscribe` && (!init?.method || init.method === 'GET')) {
      return json(buildBondSubscribeList())
    }

    if (path === `${mockBase}/bonds/lottery` && (!init?.method || init.method === 'GET')) {
      return json(buildBondLottery(url.searchParams.get('code') || undefined))
    }

    const lotteryQueryMatch = path.match(/\/bonds\/lottery\/([^/]+)\/query$/)
    if (lotteryQueryMatch && init?.method === 'POST') {
      const payload = (await parseBody(init)) as { allocation_numbers?: string }
      return json(buildLotteryQuery(lotteryQueryMatch[1], payload.allocation_numbers || ''))
    }

    return json({ success: false, message: 'Mock endpoint not found' }, 404)
  }
}
