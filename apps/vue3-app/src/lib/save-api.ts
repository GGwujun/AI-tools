export interface SaveSyncStatus {
  status: string
  message: string
  last_started_at?: string | null
  last_success_at?: string | null
  last_finished_at?: string | null
  last_synced_count: number
}

export interface AuthUserProfile {
  id: number
  mobile: string
  nickname: string
  avatar: string | null
  mobile_bound: boolean
  level: string
}

export interface SendCodeResponse {
  success: boolean
  message: string
  expires_in_seconds: number
  debug_code?: string | null
}

export interface LoginResponse {
  success: boolean
  token: string
  user: AuthUserProfile
}

export interface MeResponse {
  success: boolean
  user: AuthUserProfile
}

export interface SaveTabItem {
  key: string
  name: string
  description: string
  note: string
}

export interface SaveHomeResponse {
  success: boolean
  update_time: string
  risk_notice: string
  current_tab: string
  tabs: SaveTabItem[]
  overview: Array<{
    label: string
    value: string
    note: string
  }>
  ai_summary: string
  featured: SaveFundItem[]
  sections: Array<{
    key: string
    title: string
    items: SaveFundItem[]
  }>
}

export interface SaveFundItem {
  code: string
  market_type: string
  name: string
  market: string
  market_price: number | null
  market_price_display: string
  market_change_pct: number | null
  market_change_display: string
  nav_price: number | null
  nav_price_display: string
  premium_rate: number | null
  premium_display: string
  up: boolean
  starred: boolean
  paused: boolean
  down_days: number
  max_down_days: number
  fund_state: string
  fund_type: string
  is_no_gap: boolean
  market_time?: string | null
  nav_date?: string | null
}

export interface SaveFundListResponse {
  success: boolean
  current_tab: string
  tabs: SaveTabItem[]
  funds: SaveFundItem[]
  special_notes: string[]
  update_time?: string | null
  page?: number
  page_size?: number
  total?: number
  has_more?: boolean
  stats: {
    current_count: number
    favorite_count: number
  }
  sync_status: SaveSyncStatus
}

export interface FiveLevelItem {
  price: number | null
  volume: string
  premium: string
}

export interface FiveLevelData {
  update_time?: string | null
  bid: FiveLevelItem[]
  ask: FiveLevelItem[]
}

export interface NavHistoryItem {
  date: string
  nav: number
  nav_change: string
  premium: string
  estimated_profit: string
}

export interface ArbitrageStrategy {
  title: string
  strategy: string
  success_rate: string
  occurrence_count: string
  total_return: string
  probability: string
  start_time: string
}

export interface HistoricalArbitrageStats {
  start_date?: string | null
  trigger_count: number
  success_rate: string
  occurrence_probability: string
  avg_return_rate: string
}

export interface RiskSummary {
  risk_score: number
  risk_level: string
  risk_tags: string[]
}

export interface QualitySummary {
  data_quality_status: string
  quality_flags: string[]
  confidence_level: string
  valuation_source_code: string
}

export interface FeeProfileSummary {
  source: string
  fee_text: string
  purchase_fee_rate: number | null
  redemption_fee_rate: number | null
  management_fee_rate: number | null
  custody_fee_rate: number | null
  service_fee_rate: number | null
}

export interface ValuationSummary {
  official_nav_source: string
  estimate_nav_source: string
  iopv_source: string
  estimate_nav_value: number | null
  iopv_nav_value: number | null
}

export interface QdiiSummary {
  is_qdii: boolean
  is_cross_border: boolean
  calendar_market: string
  arbitrage_category: string
  underlying_index_code: string
}

export interface SaveFundDetailResponse {
  success: boolean
  update_time?: string | null
  sync_status: SaveSyncStatus
  fund: SaveFundItem
  five_level: FiveLevelData
  nav_history: NavHistoryItem[]
  arbitrage_strategies: ArbitrageStrategy[]
  historical_stats: HistoricalArbitrageStats
  risk: RiskSummary
  quality: QualitySummary
  fee_profile: FeeProfileSummary
  valuation: ValuationSummary
  qdii: QdiiSummary
  scale: string
  turnover: string
}

export interface BondDetailResponse {
  success: boolean
  update_time: string
  bond: {
    code: string
    name: string
    stock_name: string
    tags: string[]
    price: string
    convert_value: string
    premium_rate: string
    dual_low: string
    pure_bond_value: string
    maturity_yield: string
    scale: string
    remain_years: string
    redeem_status: string
    last_trade_date: string
    last_convert_date: string
  }
  conclusion: {
    title: string
    summary: string
    risk: string
  }
  strategy_cards: Array<{
    title: string
    summary: string
    position: string
    exit: string
    risk: string
  }>
  risk_items: Array<{
    label: string
    value: string
  }>
}

export interface BasicSettings {
  master_enabled: boolean
  market_enabled: boolean
  followed_enabled: boolean
  optional_enabled: boolean
  alert_threshold: number
}

export interface AdvancedSettings {
  fund_arbitrage_enabled: boolean
  stock_lof_enabled: boolean
  index_lof_enabled: boolean
  other_lof_enabled: boolean
  premium_threshold: number
  discount_threshold: number
  turnover_threshold: number
  realtime_premium_enabled: boolean
  buy1_amount_threshold: number
  realtime_premium_threshold: number
  closed_fund_discount_enabled: boolean
  morning_subscribe_enabled: boolean
  afternoon_subscribe_enabled: boolean
  convertible_bond_list_enabled: boolean
  convertible_bond_redeem_enabled: boolean
  convertible_bond_expected_redeem_enabled: boolean
  convertible_bond_lower_enabled: boolean
  convertible_bond_lag_enabled: boolean
  bond_price_threshold: string
  bond_premium_threshold: string
  convertible_bond_median_enabled: boolean
}

export interface SettingsResponse {
  success: boolean
  update_time: string
  basic_settings: BasicSettings
  advanced_settings: AdvancedSettings
}

export interface SaveWatchlistResponse {
  success: boolean
  update_time: string
  summary: {
    funds: number
    bonds: number
    changed: number
    pending: number
  }
  items: Array<{
    code: string
    name: string
    type: 'fund' | 'bond'
    market_type?: string | null
    change: string
    subtitle: string
    time: string
    badge: string
    chart: number[]
    chart_color: string
    starred: boolean
  }>
}

export interface SaveCalendarResponse {
  success: boolean
  update_time: string
  month: string
  filters: Array<{ key: string; label: string }>
  selected_filter: string
  weeks: string[][]
  markers: Array<{ day: string; type: string; label: string }>
  events: Array<{
    date: string
    weekday: string
    title: string
    items: Array<{
      title: string
      note: string
      time: string
      accent: string
    }>
  }>
}

export interface SaveProfileResponse {
  success: boolean
  profile: {
    name: string
    level: string
    member_label: string
  }
  quick_actions: Array<{ key: string; label: string }>
  services: Array<{ title: string; note: string }>
}

export interface SaveAiAnalysisResponse {
  success: boolean
  tabs: Array<{ key: string; label: string }>
  current_tab: string
  title: string
  content: string
  source: {
    author: string
    time: string
    likes: number
    dislikes: number
  }
  keywords: string[]
}

export interface SaveFilterOptionsResponse {
  success: boolean
  groups: Array<{
    title: string
    options: string[]
    selected: string[]
  }>
  sort_options: string[]
  selected_sort: string
}

export interface BondSubscribeItem {
  code: string
  name: string
  subscribe_date?: string | null
  pay_date?: string | null
  listing_date?: string | null
  stock_name: string
  stock_code: string
  convert_value: number | null
  premium_rate: number | null
  issue_size: string
  rating: string
  reference_price: number | null
  reference_price_change: number | null
  circulation_scale: string
  themes: string[]
  suggestion: string
  paused: boolean
  limit_tag?: string | null
}

export interface BondSubscribeListResponse {
  success: boolean
  update_time: string
  items: BondSubscribeItem[]
}

export interface BondLotteryGroup {
  label: string
  suffixes: string[]
}

export interface BondLotteryItem {
  code: string
  name: string
  winning_rate: number | null
  announce_date?: string | null
  listing_date?: string | null
  groups: BondLotteryGroup[]
}

export interface BondLotteryResponse {
  success: boolean
  update_time: string
  selected: BondLotteryItem
  bonds: BondLotteryItem[]
}

export interface BondLotteryQueryResponse {
  success: boolean
  code: string
  name: string
  update_time: string
  results: Array<{
    allocation_number: string
    matched: boolean
    hit_labels: string[]
    hit_suffixes: string[]
  }>
}

const API_BASE = (import.meta.env.VITE_FUND_API_BASE_URL || '/fund-api').replace(/\/$/, '')

function resolveBaseUrl() {
  if (API_BASE.startsWith('http://') || API_BASE.startsWith('https://')) {
    return API_BASE
  }

  const origin = globalThis.location?.origin || 'http://127.0.0.1'
  return `${origin}${API_BASE}`
}

function buildUrl(path: string, query?: Record<string, string>) {
  const url = new URL(`${resolveBaseUrl()}${path}`)
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }
  return url.toString()
}

async function request<T>(path: string, init?: RequestInit, query?: Record<string, string>): Promise<T> {
  const authToken = typeof window !== 'undefined' ? localStorage.getItem('vue3-app-auth-token') : null
  const response = await fetch(buildUrl(path, query), {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

export function sendLoginCode(mobile: string) {
  return request<SendCodeResponse>('/api/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ mobile }),
  })
}

export function loginWithMobileCode(mobile: string, code: string) {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ mobile, code }),
  })
}

export function fetchCurrentUser() {
  return request<MeResponse>('/api/auth/me')
}

export function logoutSession() {
  return request<{ success: boolean; message: string }>('/api/auth/logout', {
    method: 'POST',
  })
}

export function fetchSaveFunds(tab: string, deviceId: string, options?: { page?: number; pageSize?: number }) {
  return request<SaveFundListResponse>('/api/save/funds', undefined, {
    tab,
    device_id: deviceId,
    page: String(options?.page ?? 1),
    page_size: String(options?.pageSize ?? 20),
  })
}

export function fetchSaveFundDetail(code: string, marketType: string, deviceId: string) {
  return request<SaveFundDetailResponse>(`/api/save/funds/${marketType}/${code}`, undefined, {
    device_id: deviceId,
  })
}

export function fetchSaveHome(tab: string, deviceId: string) {
  return request<SaveHomeResponse>('/api/save/home', undefined, {
    tab,
    device_id: deviceId,
  })
}

export function fetchBondDetail(code: string) {
  return request<BondDetailResponse>(`/api/save/bonds/detail/${code}`)
}

export function fetchSaveSettings(deviceId: string) {
  return request<SettingsResponse>('/api/save/settings', undefined, {
    device_id: deviceId,
  })
}

export function fetchSaveWatchlist(deviceId: string) {
  return request<SaveWatchlistResponse>('/api/save/watchlist', undefined, {
    device_id: deviceId,
  })
}

export function fetchSaveCalendar(filter: string, deviceId: string) {
  return request<SaveCalendarResponse>('/api/save/calendar', undefined, {
    filter,
    device_id: deviceId,
  })
}

export function fetchSaveProfile(deviceId: string) {
  return request<SaveProfileResponse>('/api/save/profile', undefined, {
    device_id: deviceId,
  })
}

export function fetchSaveAiAnalysis(tab: string, deviceId: string) {
  return request<SaveAiAnalysisResponse>('/api/save/analysis', undefined, {
    tab,
    device_id: deviceId,
  })
}

export function fetchSaveFilterOptions(deviceId: string) {
  return request<SaveFilterOptionsResponse>('/api/save/filter-options', undefined, {
    device_id: deviceId,
  })
}

export function updateBasicSettings(deviceId: string, payload: BasicSettings) {
  return request<SettingsResponse>(
    '/api/save/settings/basic',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    { device_id: deviceId },
  )
}

export function updateAdvancedSettings(deviceId: string, payload: AdvancedSettings) {
  return request<SettingsResponse>(
    '/api/save/settings/advanced',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    { device_id: deviceId },
  )
}

export function updateFavorite(code: string, marketType: string, deviceId: string, starred: boolean) {
  return request<{ success: boolean; starred: boolean; favorite_count: number }>(
    `/api/save/favorites/${marketType}/${code}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        device_id: deviceId,
        starred,
      }),
    },
  )
}

export function fetchBondSubscribeList() {
  return request<BondSubscribeListResponse>('/api/save/bonds/subscribe')
}

export function fetchBondLottery(code?: string) {
  return request<BondLotteryResponse>('/api/save/bonds/lottery', undefined, code ? { code } : undefined)
}

export function queryBondLottery(code: string, allocationNumbers: string) {
  return request<BondLotteryQueryResponse>(`/api/save/bonds/lottery/${code}/query`, {
    method: 'POST',
    body: JSON.stringify({
      allocation_numbers: allocationNumbers,
    }),
  })
}
