from __future__ import annotations

from datetime import datetime

from sqlalchemy import select

from app.application.cache_invalidation_service import invalidate_all_for_fund
from app.db_models import FundArbitrageStat, FundSnapshot
from app.domain.models import FundProfile, FundStatusSnapshot, MarketQuote, NavSnapshot
from app.domain.services import calculate_opportunity
from app.application.data_quality_service import assess_valuation_quality
from app.application.fund_refresh_helpers import (
    build_detail_payload,
    record_raw_events,
    sync_daily_snapshot,
    sync_nav_history,
    sync_opportunity_record,
    sync_profile_record,
    write_standard_valuation_snapshot,
)
from app.application.crowding_score_service import sync_crowding_score
from app.application.condition_reference_service import build_and_store_condition_reference
from app.application.opportunity_score_service import sync_opportunity_score
from app.infrastructure.providers import fund_provider
from app.application.trading_calendar_service import trading_calendar_service
from app.application.valuation_service import merge_valuation_sources
from app.services import arbitrage_service, fund_service


def _infer_profile(snapshot: FundSnapshot, market_record: dict | None = None) -> FundProfile:
    market = market_record or {}
    page_profile = fund_service.get_fund_page_profile(snapshot.code)
    is_etf = snapshot.market_type == "ETF"
    is_qdii = bool(snapshot.is_no_gap) or "QDII" in (snapshot.fund_type or "")
    fund_category = snapshot.fund_type or snapshot.market_type
    arbitrage_category = "QDII" if is_qdii else ("NO_TIME_DIFF_ETF" if is_etf and snapshot.is_no_gap else ("INDEX_LOF" if "指数" in fund_category else "STOCK_BOND_LOF"))
    calendar_market = "CN"
    text = f"{fund_category} {snapshot.name or ''}"
    if is_qdii or any(keyword in text for keyword in ("纳斯达克", "标普", "美股", "美国")):
        calendar_market = "US"
    elif any(keyword in text for keyword in ("恒生", "港股", "香港")):
        calendar_market = "HK"
    return FundProfile(
        code=snapshot.code,
        market_type=snapshot.market_type,
        exchange=market.get("market", snapshot.market or ""),
        name=market.get("name", snapshot.name or snapshot.code),
        fund_category=fund_category,
        underlying_index_code=page_profile.get("underlying_index_code", ""),
        fund_company=page_profile.get("fund_company", ""),
        is_lof=not is_etf,
        is_etf=is_etf,
        is_qdii=is_qdii,
        is_cross_border=is_qdii,
        arbitrage_category=arbitrage_category,
        risk_level="HIGH" if is_qdii else "MID",
        calendar_market=calendar_market,
        default_subscribe_t_plus=1,
        default_redeem_t_plus=7 if is_qdii else (2 if "债" in fund_category else 3),
    )


def _to_market_quote(snapshot: FundSnapshot, quote_result) -> MarketQuote:
    return MarketQuote(
        code=snapshot.code,
        market=snapshot.market,
        last_price=quote_result.last_price if quote_result.last_price is not None else snapshot.market_price,
        amount=quote_result.amount,
        volume=quote_result.volume,
        open_price=quote_result.open_price,
        high_price=quote_result.high_price,
        low_price=quote_result.low_price,
        bid_levels=quote_result.bid_levels,
        ask_levels=quote_result.ask_levels,
        market_time=quote_result.as_of,
    )


def _to_nav_snapshot(result) -> NavSnapshot:
    return NavSnapshot(
        code=result.code,
        nav_type=result.nav_type,
        nav_value=result.nav_value,
        nav_date=result.nav_date,
        nav_time=result.as_of,
        change_pct=result.change_pct,
    )


def _to_status_snapshot(result) -> FundStatusSnapshot:
    return FundStatusSnapshot(
        code=result.code,
        can_subscribe=result.can_subscribe,
        can_redeem=result.can_redeem,
        limit_status=result.limit_status,
        is_suspended=result.is_suspended,
        status_text=result.status_text,
        last_verified_at=result.as_of,
    )


def _get_arbitrage_stats(session, *, code: str) -> FundArbitrageStat | None:
    return session.execute(
        select(FundArbitrageStat).where(
            FundArbitrageStat.fund_code == code,
            FundArbitrageStat.threshold_type == "premium_rate",
            FundArbitrageStat.threshold_value == 0.5,
        )
    ).scalar_one_or_none()


def refresh_snapshot_detail(session, snapshot: FundSnapshot, market_record: dict | None = None) -> None:
    profile = _infer_profile(snapshot, market_record)

    if market_record:
        snapshot.name = profile.name
        snapshot.market = profile.exchange
        snapshot.is_no_gap = profile.is_qdii

    quote_result = fund_provider.get_realtime_quote(snapshot.code, snapshot.market_type, snapshot.market or "")
    official_nav_result = fund_provider.get_official_nav(snapshot.code, snapshot.market_type)
    estimate_nav_result = fund_provider.get_estimated_nav(snapshot.code, snapshot.market_type)
    iopv_result = fund_provider.get_iopv_nav(snapshot.code, snapshot.market_type)
    fee_result = fund_provider.get_fee_profile(
        snapshot.code,
        market_type=snapshot.market_type,
        is_qdii=profile.is_qdii,
    )
    status_result = fund_provider.get_status(snapshot.code)

    record_raw_events(
        session,
        snapshot_code=snapshot.code,
        market_type=snapshot.market_type,
        quote_result=quote_result,
        official_nav_result=official_nav_result,
        estimate_nav_result=estimate_nav_result,
        iopv_result=iopv_result,
        status_result=status_result,
    )

    quote = _to_market_quote(snapshot, quote_result)
    official_nav = _to_nav_snapshot(official_nav_result)
    estimate_nav = _to_nav_snapshot(estimate_nav_result)
    iopv_nav = _to_nav_snapshot(iopv_result)
    status = _to_status_snapshot(status_result)

    standard_estimated_nav, valuation_source_code = merge_valuation_sources(
        profile=profile,
        official_nav=official_nav,
        estimate_nav=estimate_nav,
        iopv_nav=iopv_nav,
    )
    valuation_quality_status, confidence_level, quality_flags = assess_valuation_quality(
        benchmark_nav=standard_estimated_nav,
        official_nav=official_nav,
        estimate_nav=estimate_nav,
        iopv_nav=iopv_nav,
    )
    write_standard_valuation_snapshot(
        session,
        fund_code=snapshot.code,
        standard_estimated_nav=standard_estimated_nav,
        confidence_level=confidence_level,
        valuation_source_code=valuation_source_code,
        valuation_quality_status=valuation_quality_status,
        quality_flags=quality_flags,
    )

    snapshot.market_price = quote.last_price
    snapshot.market_change_pct = market_record.get("market_change_pct") if market_record else snapshot.market_change_pct
    snapshot.market_time = quote.market_time
    snapshot.nav_price = official_nav.nav_value
    snapshot.nav_date = official_nav.nav_date
    snapshot.fund_state = status.status_text
    snapshot.is_paused = status.is_suspended

    if snapshot.market_price and snapshot.nav_price and snapshot.nav_price > 0:
        snapshot.premium_rate = round((snapshot.market_price - snapshot.nav_price) / snapshot.nav_price * 100, 2)
    else:
        snapshot.premium_rate = None

    # 估算溢价率：基于标准估算净值（IOPV/估算值）
    if snapshot.market_price and standard_estimated_nav and standard_estimated_nav > 0:
        snapshot.estimate_premium_rate = round((snapshot.market_price - standard_estimated_nav) / standard_estimated_nav * 100, 2)
    else:
        snapshot.estimate_premium_rate = None

    history_rows = arbitrage_service.get_nav_history(snapshot.code, snapshot.market_type, days=20)
    negative_days = sum(1 for row in history_rows if (row.get("nav_change_pct") or 0) < 0)
    snapshot.down_days = negative_days
    snapshot.max_down_days = max(snapshot.max_down_days, negative_days)
    snapshot.scale, snapshot.turnover = arbitrage_service.get_fund_scale_turnover(snapshot.code)

    trade_date = datetime.utcnow().date()
    expected_confirm_date = trading_calendar_service.next_trade_date(
        market=profile.calendar_market,
        from_date=trade_date,
        offset=profile.default_subscribe_t_plus or 1,
    )
    expected_arrival_date = trading_calendar_service.next_trade_date(
        market=profile.calendar_market,
        from_date=trade_date,
        offset=profile.default_redeem_t_plus or 3,
    )
    expected_sell_date = trading_calendar_service.next_trade_date(
        market=profile.calendar_market,
        from_date=expected_arrival_date,
        offset=0,
    )

    opportunity = calculate_opportunity(
        profile=profile,
        quote=quote,
        status=status,
        official_nav=official_nav,
        estimate_nav=estimate_nav,
        iopv_nav=iopv_nav,
        expected_confirm_date=expected_confirm_date,
        expected_arrival_date=expected_arrival_date,
        expected_sell_date=expected_sell_date,
        data_quality_status=valuation_quality_status,
        quality_flags=quality_flags,
    )

    stat_record = _get_arbitrage_stats(session, code=snapshot.code)
    sync_daily_snapshot(
        session,
        code=snapshot.code,
        trade_date=trade_date,
        quote=quote,
        official_nav=official_nav,
        estimate_nav=estimate_nav,
        status=status,
        opportunity=opportunity,
        purchase_limit_amount=snapshot.purchase_limit_amount,
    )

    snapshot.detail_payload = build_detail_payload(
        quote_result=quote_result,
        quote=quote,
        opportunity=opportunity,
        confidence_level=confidence_level,
        valuation_source_code=valuation_source_code,
        stat_record=stat_record,
        official_nav_result=official_nav_result,
        estimate_nav_result=estimate_nav_result,
        iopv_result=iopv_result,
        fee_result=fee_result,
        profile=profile,
    )
    snapshot.detail_updated_at = datetime.utcnow()
    snapshot.updated_at = datetime.utcnow()

    sync_nav_history(session, fund_id=snapshot.id, history_rows=history_rows)
    sync_profile_record(session, code=snapshot.code, market_type=snapshot.market_type, profile=profile)
    sync_opportunity_record(session, code=snapshot.code, market_type=snapshot.market_type, profile=profile, opportunity=opportunity)
    crowding_record = sync_crowding_score(
        session,
        code=snapshot.code,
        market_type=snapshot.market_type,
        quote=quote,
        opportunity=opportunity,
        history_rows=history_rows,
    )
    opportunity.crowding_score = crowding_record.crowding_score
    opportunity.crowding_level = crowding_record.level
    sync_opportunity_score(
        session,
        code=snapshot.code,
        market_type=snapshot.market_type,
        profile=profile,
        opportunity=opportunity,
        crowding_score=crowding_record.crowding_score,
    )
    build_and_store_condition_reference(session, snapshot=snapshot, opportunity=opportunity)
    invalidate_all_for_fund(code=snapshot.code, market_type=snapshot.market_type)
