from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass(slots=True)
class ProviderResult:
    source: str
    as_of: datetime | None = None
    stale: bool = False
    quality_score: float = 1.0
    raw_ref: str | None = None


@dataclass(slots=True)
class QuoteProviderResult(ProviderResult):
    code: str = ""
    market: str = ""
    last_price: float | None = None
    amount: float | None = None
    volume: float | None = None
    open_price: float | None = None
    high_price: float | None = None
    low_price: float | None = None
    bid_levels: list[dict] = field(default_factory=list)
    ask_levels: list[dict] = field(default_factory=list)


@dataclass(slots=True)
class NavProviderResult(ProviderResult):
    code: str = ""
    nav_type: str = ""
    nav_value: float | None = None
    nav_date: date | None = None
    change_pct: float | None = None


@dataclass(slots=True)
class FeeProviderResult(ProviderResult):
    code: str = ""
    fee_text: str = ""
    purchase_fee_rate: float | None = None
    redemption_fee_rate: float | None = None
    management_fee_rate: float | None = None
    custody_fee_rate: float | None = None
    service_fee_rate: float | None = None


@dataclass(slots=True)
class StatusProviderResult(ProviderResult):
    code: str = ""
    can_subscribe: bool = True
    can_redeem: bool = True
    limit_status: str = ""
    is_suspended: bool = False
    status_text: str = ""
