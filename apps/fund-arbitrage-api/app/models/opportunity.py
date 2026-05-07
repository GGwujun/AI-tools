from __future__ import annotations

from pydantic import BaseModel, Field


class OpportunityItem(BaseModel):
    code: str
    market_type: str
    name: str = ""
    benchmark_type: str
    benchmark_value: float | None = None
    gross_premium_rate: float | None = None
    estimate_premium_rate: float | None = None
    valuation_error_rate: float | None = None
    estimated_net_profit_rate: float | None = None
    historical_success_rate: float | None = None
    trigger_count: int = 0
    occurrence_probability: float | None = None
    quality_score: float = 0.0
    liquidity_score: float = 0.0
    status_score: float = 0.0
    risk_score: float = 0.0
    risk_level: str = "MID"
    data_quality_status: str = "OK"
    quality_flags: list[str] = Field(default_factory=list)
    final_score: float = 0.0
    score_level: str = "WATCH"
    crowding_score: float = 0.0
    crowding_level: str = "LOW"
    display_label: str = "观察中"
    advisory_text: str = "当前仅供观察参考"
    opportunity_level: str
    risk_tags: list[str] = Field(default_factory=list)
    expected_confirm_date: str | None = None
    expected_arrival_date: str | None = None
    expected_sell_date: str | None = None
    calculated_at: str | None = None
    algorithm_version: str = "v2"


class OpportunityListResponse(BaseModel):
    success: bool
    items: list[OpportunityItem]
    update_time: str | None = None


class OpportunityDetailResponse(BaseModel):
    success: bool
    item: OpportunityItem


class BacktestStatItem(BaseModel):
    fund_code: str
    threshold_type: str
    threshold_value: float
    total_trade_days: int = 0
    trigger_count: int = 0
    success_count: int = 0
    success_rate: float | None = None
    occurrence_probability: float | None = None
    sum_return_rate: float | None = None
    compound_return_rate: float | None = None
    avg_return_rate: float | None = None
    max_return_rate: float | None = None
    min_return_rate: float | None = None
    data_quality_warning: str = ""
    updated_at: str | None = None


class BacktestEventItem(BaseModel):
    trigger_date: str
    threshold_value: float
    trigger_premium_rate: float | None = None
    subscribe_nav: float | None = None
    sell_date: str | None = None
    sell_price: float | None = None
    fee_rate: float | None = None
    slippage_rate: float | None = None
    return_rate: float | None = None
    success: bool | None = None
    status: str


class BacktestResultResponse(BaseModel):
    success: bool
    stat: BacktestStatItem | None = None
    events: list[BacktestEventItem] = Field(default_factory=list)


class OpportunityHighlightResponse(BaseModel):
    success: bool
    items: list[OpportunityItem]
    update_time: str | None = None
