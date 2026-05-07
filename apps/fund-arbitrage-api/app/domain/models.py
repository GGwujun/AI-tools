from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass(slots=True)
class FundProfile:
    code: str
    market_type: str
    exchange: str = ""
    name: str = ""
    fund_category: str = ""
    underlying_index_code: str = ""
    fund_company: str = ""
    is_lof: bool = False
    is_etf: bool = False
    is_qdii: bool = False
    is_cross_border: bool = False
    arbitrage_category: str = ""
    risk_level: str = "MID"
    calendar_market: str = "CN"
    default_subscribe_t_plus: int | None = None
    default_redeem_t_plus: int | None = None


@dataclass(slots=True)
class MarketQuote:
    code: str
    market: str = ""
    last_price: float | None = None
    amount: float | None = None
    volume: float | None = None
    open_price: float | None = None
    high_price: float | None = None
    low_price: float | None = None
    bid_levels: list[dict] = field(default_factory=list)
    ask_levels: list[dict] = field(default_factory=list)
    market_time: datetime | None = None


@dataclass(slots=True)
class NavSnapshot:
    code: str
    nav_type: str
    nav_value: float | None = None
    nav_date: date | None = None
    nav_time: datetime | None = None
    change_pct: float | None = None


@dataclass(slots=True)
class FundStatusSnapshot:
    code: str
    can_subscribe: bool = True
    can_redeem: bool = True
    limit_status: str = ""
    is_suspended: bool = False
    status_text: str = ""
    last_verified_at: datetime | None = None


@dataclass(slots=True)
class OpportunitySnapshotModel:
    code: str
    market_type: str
    benchmark_type: str
    benchmark_value: float | None
    gross_premium_rate: float | None
    valuation_error_rate: float | None
    fee_cost_rate: float
    slippage_cost_rate: float
    estimated_net_profit_rate: float | None
    liquidity_score: float
    status_score: float
    quality_score: float
    risk_score: float
    risk_level: str
    opportunity_level: str
    estimate_premium_rate: float | None = None
    risk_tags: list[str] = field(default_factory=list)
    displayable: bool = True
    trigger_count: int = 0
    historical_success_rate: float | None = None
    occurrence_probability: float | None = None
    data_quality_status: str = "OK"
    quality_flags: list[str] = field(default_factory=list)
    final_score: float = 0.0
    score_level: str = "WATCH"
    crowding_score: float = 0.0
    crowding_level: str = "LOW"
    expected_confirm_date: date | None = None
    expected_arrival_date: date | None = None
    expected_sell_date: date | None = None
    calculated_at: datetime | None = None
    algorithm_version: str = "v2"
