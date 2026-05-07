from __future__ import annotations

from pydantic import BaseModel


class RebuildStatsResponse(BaseModel):
    success: bool
    processed: int = 0
    updated: int = 0
    filled: int = 0
    code: str | None = None
    market_type: str | None = None


class TradingCalendarResponse(BaseModel):
    success: bool
    market: str = "CN"
    from_date: str
    offset: int
    next_trade_date: str


class TradingCalendarDayItem(BaseModel):
    market: str
    trade_date: str
    is_open: bool
    note: str = ""


class TradingCalendarDayResponse(BaseModel):
    success: bool
    item: TradingCalendarDayItem


class TradingCalendarListResponse(BaseModel):
    success: bool
    items: list[TradingCalendarDayItem]


class TradingCalendarUpsertRequest(BaseModel):
    market: str = "CN"
    trade_date: str
    is_open: bool
    note: str = ""


class StandardValuationResponse(BaseModel):
    success: bool
    fund_code: str
    snapshot_time: str | None = None
    standard_estimated_nav: float | None = None
    confidence_level: str = "LOW"
    valuation_source_code: str = ""
    valuation_quality_status: str = "OK"
    quality_flags: list[str] = []


class RawDataEventItem(BaseModel):
    source_code: str
    data_type: str
    biz_key: str
    raw_payload: dict
    collected_at: str


class RawDataEventListResponse(BaseModel):
    success: bool
    items: list[RawDataEventItem]


class StandardValuationHistoryItem(BaseModel):
    fund_code: str
    snapshot_time: str
    standard_estimated_nav: float | None = None
    confidence_level: str = "LOW"
    valuation_source_code: str = ""
    valuation_quality_status: str = "OK"
    quality_flags: list[str] = []


class StandardValuationHistoryResponse(BaseModel):
    success: bool
    items: list[StandardValuationHistoryItem]


class OpportunityScoreResponse(BaseModel):
    success: bool
    fund_code: str
    market_type: str
    snapshot_time: str | None = None
    final_score: float = 0.0
    level: str = "WATCH"
    profit_score: float = 0.0
    reliability_score: float = 0.0
    execution_score: float = 0.0
    liquidity_score: float = 0.0
    risk_score: float = 0.0
    crowding_score: float = 0.0


class TaskRunItem(BaseModel):
    id: int
    task_name: str
    status: str
    processed_count: int = 0
    failed_count: int = 0
    message: str = ""
    started_at: str
    finished_at: str | None = None


class TaskRunListResponse(BaseModel):
    success: bool
    items: list[TaskRunItem]
