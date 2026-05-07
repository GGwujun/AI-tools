from __future__ import annotations

from pydantic import BaseModel, Field


class BondSubscribeItem(BaseModel):
    code: str
    name: str
    subscribe_date: str | None = None
    pay_date: str | None = None
    listing_date: str | None = None
    stock_name: str = "--"
    stock_code: str = "--"
    convert_value: float | None = None
    premium_rate: float | None = None
    issue_size: str = "--"
    rating: str = "--"
    reference_price: float | None = None
    reference_price_change: float | None = None
    circulation_scale: str = "--"
    themes: list[str] = Field(default_factory=list)
    suggestion: str = "--"
    paused: bool = False
    limit_tag: str | None = None


class BondSubscribeListResponse(BaseModel):
    success: bool
    update_time: str
    items: list[BondSubscribeItem]


class BondLotteryGroup(BaseModel):
    label: str
    suffixes: list[str]


class BondLotteryItem(BaseModel):
    code: str
    name: str
    winning_rate: float | None = None
    announce_date: str | None = None
    listing_date: str | None = None
    groups: list[BondLotteryGroup] = Field(default_factory=list)


class BondLotteryResponse(BaseModel):
    success: bool
    update_time: str
    selected: BondLotteryItem
    bonds: list[BondLotteryItem]


class BondLotteryQueryRequest(BaseModel):
    allocation_numbers: str


class BondLotteryQueryHit(BaseModel):
    allocation_number: str
    matched: bool
    hit_labels: list[str] = Field(default_factory=list)
    hit_suffixes: list[str] = Field(default_factory=list)


class BondLotteryQueryResponse(BaseModel):
    success: bool
    code: str
    name: str
    update_time: str
    results: list[BondLotteryQueryHit]
