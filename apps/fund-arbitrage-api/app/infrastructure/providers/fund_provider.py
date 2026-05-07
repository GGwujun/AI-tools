from __future__ import annotations

from datetime import datetime

from app.infrastructure.providers.base import FeeProviderResult, NavProviderResult, QuoteProviderResult, StatusProviderResult
from app.services import arbitrage_service, fund_service


def get_market_list(market_type: str) -> list[dict]:
    if market_type == "ETF":
        return fund_service.get_etf_fund_list_bulk().to_dict("records")
    return fund_service.get_lof_fund_list_bulk().to_dict("records")


def get_realtime_quote(code: str, market_type: str, market: str = "") -> QuoteProviderResult:
    realtime = fund_service.get_fund_realtime_data(code, market_type) or {}
    five_level = arbitrage_service.get_five_level_data(code, market or None)

    amount = None
    volume = None
    if five_level.get("bid") or five_level.get("ask"):
        bid_volume = sum(int(item.get("volume") or 0) for item in five_level.get("bid", []) if str(item.get("volume", "")).isdigit())
        ask_volume = sum(int(item.get("volume") or 0) for item in five_level.get("ask", []) if str(item.get("volume", "")).isdigit())
        volume = bid_volume + ask_volume

    return QuoteProviderResult(
        source="legacy-fund-service",
        as_of=datetime.utcnow(),
        code=code,
        market=market,
        last_price=realtime.get("market_price"),
        amount=amount,
        volume=volume,
        bid_levels=five_level.get("bid", []),
        ask_levels=five_level.get("ask", []),
    )


def get_official_nav(code: str, market_type: str) -> NavProviderResult:
    if market_type == "ETF":
        nav_value, nav_date = fund_service.get_etf_nav_price(code)
    else:
        nav_value, nav_date = fund_service.get_lof_nav_price(code)

    parsed_date = None
    if isinstance(nav_date, str):
        try:
            parsed_date = datetime.strptime(nav_date, "%Y-%m-%d").date()
        except ValueError:
            parsed_date = None

    return NavProviderResult(
        source="legacy-fund-service",
        as_of=datetime.utcnow(),
        code=code,
        nav_type="official",
        nav_value=nav_value,
        nav_date=parsed_date,
    )


def get_estimated_nav(code: str, market_type: str) -> NavProviderResult:
    nav_value, nav_time, nav_change, source = fund_service.get_estimated_nav_info(code)
    if nav_value is None:
        official = get_official_nav(code, market_type)
        official.nav_type = "estimate"
        official.source = f"{official.source}:fallback_for_estimate"
        return official

    parsed_date = None
    if isinstance(nav_time, str):
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%H:%M:%S", "%H:%M"):
            try:
                parsed = datetime.strptime(nav_time, fmt)
                parsed_date = parsed.date()
                break
            except ValueError:
                continue

    return NavProviderResult(
        source=source,
        as_of=datetime.utcnow(),
        code=code,
        nav_type="estimate",
        nav_value=nav_value,
        nav_date=parsed_date,
        change_pct=nav_change,
    )


def get_iopv_nav(code: str, market_type: str) -> NavProviderResult:
    if market_type != "ETF":
        return NavProviderResult(source="legacy-fund-service", as_of=datetime.utcnow(), code=code, nav_type="iopv")
    nav_value, nav_time, nav_change, source = fund_service.get_etf_iopv_info(code)
    if nav_value is None:
        estimate = get_estimated_nav(code, market_type)
        estimate.nav_type = "iopv"
        estimate.source = f"{estimate.source}:fallback_for_iopv"
        return estimate

    parsed_date = None
    if isinstance(nav_time, str):
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
            try:
                parsed = datetime.strptime(nav_time, fmt)
                parsed_date = parsed.date()
                break
            except ValueError:
                continue

    return NavProviderResult(
        source=source,
        as_of=datetime.utcnow(),
        code=code,
        nav_type="iopv",
        nav_value=nav_value,
        nav_date=parsed_date,
        change_pct=nav_change,
    )


def get_fee_profile(code: str, *, market_type: str = "LOF", is_qdii: bool = False) -> FeeProviderResult:
    fee_info = fund_service.get_fund_fee_info(code)
    if not fee_info.get("fee_text") and fee_info.get("purchase_fee_rate") is None:
        purchase_fee_rate = 0.15 if market_type == "LOF" else 0.05
        redemption_fee_rate = 0.15 if market_type == "LOF" else 0.05
        management_fee_rate = 0.50 if market_type == "ETF" else 1.00
        custody_fee_rate = 0.10
        service_fee_rate = 0.10 if is_qdii else 0.0
        fee_info = {
            "source": "heuristic_rule",
            "fee_text": "按规则估算成本，非基金公告原始费率",
            "purchase_fee_rate": purchase_fee_rate,
            "redemption_fee_rate": redemption_fee_rate,
            "management_fee_rate": management_fee_rate,
            "custody_fee_rate": custody_fee_rate,
            "service_fee_rate": service_fee_rate,
        }

    return FeeProviderResult(
        source=fee_info.get("source", "unknown"),
        as_of=datetime.utcnow(),
        code=code,
        fee_text=fee_info.get("fee_text", ""),
        purchase_fee_rate=fee_info.get("purchase_fee_rate"),
        redemption_fee_rate=fee_info.get("redemption_fee_rate"),
        management_fee_rate=fee_info.get("management_fee_rate"),
        custody_fee_rate=fee_info.get("custody_fee_rate"),
        service_fee_rate=fee_info.get("service_fee_rate"),
    )


def get_status(code: str) -> StatusProviderResult:
    fund_state, _fund_type = fund_service.parse_fund_state(code)
    suspended = "暂停" in fund_state
    can_subscribe = "暂停申购" not in fund_state
    can_redeem = "暂停赎回" not in fund_state
    limit_status = "限购" if "限购" in fund_state else ""

    return StatusProviderResult(
        source="legacy-fund-service",
        as_of=datetime.utcnow(),
        code=code,
        can_subscribe=can_subscribe,
        can_redeem=can_redeem,
        limit_status=limit_status,
        is_suspended=suspended,
        status_text=fund_state,
    )
