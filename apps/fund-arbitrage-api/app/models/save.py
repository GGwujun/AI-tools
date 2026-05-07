from __future__ import annotations

from pydantic import BaseModel, Field


class SaveSyncStatus(BaseModel):
    status: str = "idle"
    message: str = ""
    last_started_at: str | None = None
    last_success_at: str | None = None
    last_finished_at: str | None = None
    last_synced_count: int = 0


class SaveTabItem(BaseModel):
    key: str
    name: str
    description: str
    note: str = ""


class SaveFundItem(BaseModel):
    code: str
    market_type: str
    name: str
    market: str = ""
    market_price: float | None = None
    market_price_display: str = "--"
    market_change_pct: float | None = None
    market_change_display: str = "--"
    nav_price: float | None = None
    nav_price_display: str = "--"
    premium_rate: float | None = None
    premium_display: str = "--"
    estimate_premium_rate: float | None = None
    estimate_premium_rate_display: str = "--"
    up: bool = False
    starred: bool = False
    paused: bool = False
    down_days: int = 0
    max_down_days: int = 0
    fund_state: str = ""
    fund_type: str = ""
    purchase_limit_display: str = "--"
    purchase_status: str = ""
    is_no_gap: bool = False
    market_time: str | None = None
    nav_date: str | None = None


class SaveFundListStats(BaseModel):
    current_count: int = 0
    favorite_count: int = 0


class SaveFundListResponse(BaseModel):
    success: bool
    current_tab: str
    tabs: list[SaveTabItem]
    funds: list[SaveFundItem]
    special_notes: list[str] = Field(default_factory=list)
    update_time: str | None = None
    page: int = 1
    page_size: int = 20
    total: int = 0
    has_more: bool = False
    stats: SaveFundListStats
    sync_status: SaveSyncStatus


class FiveLevelItem(BaseModel):
    price: float | None = None
    volume: str = "--"
    premium: str = "--"


class FiveLevelData(BaseModel):
    update_time: str | None = None
    bid: list[FiveLevelItem] = Field(default_factory=list)
    ask: list[FiveLevelItem] = Field(default_factory=list)


class NavHistoryItem(BaseModel):
    date: str
    nav: float
    nav_change: str = "--"
    premium: str = "--"
    estimated_profit: str = "--"


class ArbitrageStrategy(BaseModel):
    title: str
    strategy: str
    success_rate: str = "--"
    occurrence_count: str = "--"
    total_return: str = "--"
    probability: str = "--"
    start_time: str = "--"


class HistoricalArbitrageStats(BaseModel):
    start_date: str | None = None
    trigger_count: int = 0
    success_rate: str = "--"
    occurrence_probability: str = "--"
    avg_return_rate: str = "--"


class RhythmReference(BaseModel):
    expected_confirm_date: str | None = None
    expected_arrival_date: str | None = None
    expected_sell_date: str | None = None


class RiskSummary(BaseModel):
    risk_score: float = 0.0
    risk_level: str = "MID"
    risk_tags: list[str] = Field(default_factory=list)


class QualitySummary(BaseModel):
    data_quality_status: str = "OK"
    quality_flags: list[str] = Field(default_factory=list)
    confidence_level: str = "LOW"
    valuation_source_code: str = ""


class FeeProfileSummary(BaseModel):
    source: str = ""
    fee_text: str = ""
    purchase_fee_rate: float | None = None
    redemption_fee_rate: float | None = None
    management_fee_rate: float | None = None
    custody_fee_rate: float | None = None
    service_fee_rate: float | None = None


class ValuationSummary(BaseModel):
    official_nav_source: str = ""
    estimate_nav_source: str = ""
    iopv_source: str = ""
    estimate_nav_value: float | None = None
    iopv_nav_value: float | None = None
    estimate_premium_rate: float | None = None


class QdiiSummary(BaseModel):
    is_qdii: bool = False
    is_cross_border: bool = False
    calendar_market: str = "CN"
    arbitrage_category: str = ""
    underlying_index_code: str = ""


class SaveFundDetailResponse(BaseModel):
    success: bool
    update_time: str | None = None
    sync_status: SaveSyncStatus
    fund: SaveFundItem
    five_level: FiveLevelData
    nav_history: list[NavHistoryItem] = Field(default_factory=list)
    arbitrage_strategies: list[ArbitrageStrategy] = Field(default_factory=list)
    historical_stats: HistoricalArbitrageStats = Field(default_factory=HistoricalArbitrageStats)
    rhythm: RhythmReference = Field(default_factory=RhythmReference)
    risk: RiskSummary = Field(default_factory=RiskSummary)
    quality: QualitySummary = Field(default_factory=QualitySummary)
    fee_profile: FeeProfileSummary = Field(default_factory=FeeProfileSummary)
    valuation: ValuationSummary = Field(default_factory=ValuationSummary)
    qdii: QdiiSummary = Field(default_factory=QdiiSummary)
    scale: str = "--"
    turnover: str = "--"


class BasicSettings(BaseModel):
    master_enabled: bool = False
    market_enabled: bool = False
    followed_enabled: bool = False
    optional_enabled: bool = False
    alert_threshold: int = 3


class AdvancedSettings(BaseModel):
    fund_arbitrage_enabled: bool = False
    stock_lof_enabled: bool = False
    index_lof_enabled: bool = False
    other_lof_enabled: bool = False
    premium_threshold: float = 0.5
    discount_threshold: float = -1.0
    turnover_threshold: float = 100.0
    realtime_premium_enabled: bool = False
    buy1_amount_threshold: float = 5000.0
    realtime_premium_threshold: float = 1.88
    closed_fund_discount_enabled: bool = False
    morning_subscribe_enabled: bool = False
    afternoon_subscribe_enabled: bool = False
    convertible_bond_list_enabled: bool = False
    convertible_bond_redeem_enabled: bool = False
    convertible_bond_expected_redeem_enabled: bool = False
    convertible_bond_lower_enabled: bool = False
    convertible_bond_lag_enabled: bool = False
    bond_price_threshold: str = ""
    bond_premium_threshold: str = ""
    convertible_bond_median_enabled: bool = False


class SettingsResponse(BaseModel):
    success: bool
    update_time: str
    basic_settings: BasicSettings
    advanced_settings: AdvancedSettings


class FavoriteUpdateRequest(BaseModel):
    device_id: str
    starred: bool


class FavoriteUpdateResponse(BaseModel):
    success: bool
    starred: bool
    favorite_count: int


class SyncResponse(BaseModel):
    success: bool
    message: str
    sync_status: SaveSyncStatus


class SaveOverviewItem(BaseModel):
    label: str
    value: str
    note: str


class SaveSection(BaseModel):
    key: str
    title: str
    items: list[SaveFundItem] = Field(default_factory=list)


class SaveHomeResponse(BaseModel):
    success: bool
    update_time: str
    risk_notice: str
    current_tab: str
    tabs: list[SaveTabItem]
    overview: list[SaveOverviewItem] = Field(default_factory=list)
    ai_summary: str
    featured: list[SaveFundItem] = Field(default_factory=list)
    sections: list[SaveSection] = Field(default_factory=list)


class SaveWatchlistItem(BaseModel):
    code: str
    name: str
    type: str
    market_type: str | None = None
    change: str
    subtitle: str
    time: str
    badge: str
    chart: list[int] = Field(default_factory=list)
    chart_color: str
    starred: bool = False


class SaveWatchlistResponse(BaseModel):
    success: bool
    update_time: str
    summary: dict
    items: list[SaveWatchlistItem] = Field(default_factory=list)


class SaveCalendarFilter(BaseModel):
    key: str
    label: str


class SaveCalendarMarker(BaseModel):
    day: str
    type: str
    label: str


class SaveCalendarEventItem(BaseModel):
    title: str
    note: str
    time: str
    accent: str


class SaveCalendarEvent(BaseModel):
    date: str
    weekday: str
    title: str
    items: list[SaveCalendarEventItem] = Field(default_factory=list)


class SaveCalendarResponse(BaseModel):
    success: bool
    update_time: str
    month: str
    filters: list[SaveCalendarFilter] = Field(default_factory=list)
    selected_filter: str
    weeks: list[list[str]] = Field(default_factory=list)
    markers: list[SaveCalendarMarker] = Field(default_factory=list)
    events: list[SaveCalendarEvent] = Field(default_factory=list)


class SaveProfileAction(BaseModel):
    key: str
    label: str


class SaveProfileServiceItem(BaseModel):
    title: str
    note: str


class SaveProfileResponse(BaseModel):
    success: bool
    profile: dict
    quick_actions: list[SaveProfileAction] = Field(default_factory=list)
    services: list[SaveProfileServiceItem] = Field(default_factory=list)


class SaveAiSource(BaseModel):
    author: str
    time: str
    likes: int
    dislikes: int


class SaveAiTab(BaseModel):
    key: str
    label: str


class SaveAiAnalysisResponse(BaseModel):
    success: bool
    tabs: list[SaveAiTab] = Field(default_factory=list)
    current_tab: str
    title: str
    content: str
    source: SaveAiSource
    keywords: list[str] = Field(default_factory=list)


class SaveFilterOptionGroup(BaseModel):
    title: str
    options: list[str] = Field(default_factory=list)
    selected: list[str] = Field(default_factory=list)


class SaveFilterOptionsResponse(BaseModel):
    success: bool
    groups: list[SaveFilterOptionGroup] = Field(default_factory=list)
    sort_options: list[str] = Field(default_factory=list)
    selected_sort: str


class BondDetailBond(BaseModel):
    code: str
    name: str
    stock_name: str
    tags: list[str] = Field(default_factory=list)
    price: str
    convert_value: str
    premium_rate: str
    dual_low: str
    pure_bond_value: str
    maturity_yield: str
    scale: str
    remain_years: str
    redeem_status: str
    last_trade_date: str
    last_convert_date: str


class BondDetailConclusion(BaseModel):
    title: str
    summary: str
    risk: str


class BondStrategyCard(BaseModel):
    title: str
    summary: str
    position: str
    exit: str
    risk: str


class BondRiskItem(BaseModel):
    label: str
    value: str


class BondDetailResponse(BaseModel):
    success: bool
    update_time: str
    bond: BondDetailBond
    conclusion: BondDetailConclusion
    strategy_cards: list[BondStrategyCard] = Field(default_factory=list)
    risk_items: list[BondRiskItem] = Field(default_factory=list)
