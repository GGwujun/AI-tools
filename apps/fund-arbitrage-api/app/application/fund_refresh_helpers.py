from __future__ import annotations

import math
from datetime import datetime, timezone

from app.db_models import FundDailySnapshot, FundNavHistory, FundProfileRecord, OpportunitySnapshot, FundStandardValuationSnapshot, RawDataEvent
from app.infrastructure.utils import sanitize_json_value


def record_raw_events(session, *, snapshot_code: str, market_type: str, quote_result, official_nav_result, estimate_nav_result, iopv_result, status_result) -> None:
    raw_events = [
        ("legacy-fund-service", "quote", f"{market_type}:{snapshot_code}", {
            "code": quote_result.code,
            "market": quote_result.market,
            "last_price": quote_result.last_price,
            "amount": quote_result.amount,
            "volume": quote_result.volume,
        }),
        ("legacy-fund-service", "official_nav", snapshot_code, {
            "code": official_nav_result.code,
            "nav_type": official_nav_result.nav_type,
            "nav_value": official_nav_result.nav_value,
        }),
        ("legacy-fund-service", "estimate_nav", snapshot_code, {
            "code": estimate_nav_result.code,
            "nav_type": estimate_nav_result.nav_type,
            "nav_value": estimate_nav_result.nav_value,
        }),
        ("legacy-fund-service", "iopv_nav", snapshot_code, {
            "code": iopv_result.code,
            "nav_type": iopv_result.nav_type,
            "nav_value": iopv_result.nav_value,
        }),
        ("legacy-fund-service", "status", snapshot_code, {
            "code": status_result.code,
            "can_subscribe": status_result.can_subscribe,
            "can_redeem": status_result.can_redeem,
            "limit_status": status_result.limit_status,
            "is_suspended": status_result.is_suspended,
        }),
    ]
    for source_code, data_type, biz_key, payload in raw_events:
        session.add(
            RawDataEvent(
                source_code=source_code,
                data_type=data_type,
                biz_key=biz_key,
                raw_payload=sanitize_json_value(payload),
                collected_at=datetime.now(timezone.utc),
            )
        )


def write_standard_valuation_snapshot(
    session,
    *,
    fund_code: str,
    standard_estimated_nav: float | None,
    confidence_level: str,
    valuation_source_code: str,
    valuation_quality_status: str,
    quality_flags: list[str],
) -> None:
    session.add(
        FundStandardValuationSnapshot(
            fund_code=fund_code,
            snapshot_time=datetime.now(timezone.utc),
            standard_estimated_nav=standard_estimated_nav,
            confidence_level=confidence_level,
            valuation_source_code=valuation_source_code,
            valuation_quality_status=valuation_quality_status,
            quality_flags=quality_flags,
        )
    )


def build_detail_payload(
    *,
    quote_result,
    quote,
    opportunity,
    confidence_level: str,
    valuation_source_code: str,
    stat_record,
    official_nav_result,
    estimate_nav_result,
    iopv_result,
    fee_result,
    profile,
) -> dict:
    trigger_count = stat_record.trigger_count if stat_record is not None else opportunity.trigger_count
    success_rate = stat_record.success_rate if stat_record is not None else opportunity.historical_success_rate
    occurrence_probability = stat_record.occurrence_probability if stat_record is not None else opportunity.occurrence_probability
    avg_return_rate = stat_record.avg_return_rate if stat_record is not None else opportunity.estimated_net_profit_rate
    stat_start_date = stat_record.stat_start_date.strftime("%Y-%m-%d") if stat_record is not None and stat_record.stat_start_date else None
    return {
        "five_level": {
            "update_time": quote_result.as_of.strftime("%Y-%m-%d %H:%M:%S") if quote_result.as_of else None,
            "bid": quote.bid_levels,
            "ask": quote.ask_levels,
        },
        "rhythm": {
            "expected_confirm_date": opportunity.expected_confirm_date.strftime("%Y-%m-%d") if opportunity.expected_confirm_date else None,
            "expected_arrival_date": opportunity.expected_arrival_date.strftime("%Y-%m-%d") if opportunity.expected_arrival_date else None,
            "expected_sell_date": opportunity.expected_sell_date.strftime("%Y-%m-%d") if opportunity.expected_sell_date else None,
        },
        "risk": {
            "risk_score": opportunity.risk_score,
            "risk_level": opportunity.risk_level,
            "risk_tags": opportunity.risk_tags,
        },
        "quality": {
            "data_quality_status": opportunity.data_quality_status,
            "quality_flags": opportunity.quality_flags,
            "confidence_level": confidence_level,
            "valuation_source_code": valuation_source_code,
        },
        "valuation": {
            "official_nav_source": official_nav_result.source,
            "estimate_nav_source": estimate_nav_result.source,
            "iopv_source": iopv_result.source,
            "estimate_nav_value": estimate_nav_result.nav_value,
            "iopv_nav_value": iopv_result.nav_value,
            "estimate_premium_rate": opportunity.estimate_premium_rate,
        },
        "fee_profile": {
            "source": fee_result.source,
            "fee_text": fee_result.fee_text,
            "purchase_fee_rate": fee_result.purchase_fee_rate,
            "redemption_fee_rate": fee_result.redemption_fee_rate,
            "management_fee_rate": fee_result.management_fee_rate,
            "custody_fee_rate": fee_result.custody_fee_rate,
            "service_fee_rate": fee_result.service_fee_rate,
        },
        "qdii": {
            "is_qdii": profile.is_qdii,
            "is_cross_border": profile.is_cross_border,
            "calendar_market": profile.calendar_market,
            "arbitrage_category": profile.arbitrage_category,
            "underlying_index_code": profile.underlying_index_code,
        },
        "historical_stats": {
            "start_date": stat_start_date,
            "trigger_count": trigger_count,
            "success_rate": success_rate,
            "occurrence_probability": occurrence_probability,
            "avg_return_rate": avg_return_rate,
        },
        "strategies": [],
    }


def sync_nav_history(session, *, fund_id: int, history_rows: list[dict]) -> None:
    """Upsert NAV history records — incremental instead of delete+re-insert."""
    from sqlalchemy import select as sa_select
    for row in history_rows:
        date_text = row.get("date")
        try:
            nav_date_value = datetime.strptime(date_text, "%Y-%m-%d").date()
        except (TypeError, ValueError):
            continue

        existing = session.execute(
            sa_select(FundNavHistory).where(
                FundNavHistory.fund_id == fund_id,
                FundNavHistory.nav_date == nav_date_value,
            )
        ).scalar_one_or_none()

        if existing is not None:
            existing.nav_price = row["nav"]
            existing.nav_change_pct = row.get("nav_change_pct")
            existing.premium_rate = row.get("premium_rate")
            existing.estimated_profit_pct = row.get("estimated_profit_pct")
        else:
            session.add(
                FundNavHistory(
                    fund_id=fund_id,
                    nav_date=nav_date_value,
                    nav_price=row["nav"],
                    nav_change_pct=row.get("nav_change_pct"),
                    premium_rate=row.get("premium_rate"),
                    estimated_profit_pct=row.get("estimated_profit_pct"),
                )
            )


def sync_profile_record(
    session,
    *,
    code: str,
    market_type: str,
    profile,
) -> FundProfileRecord:
    profile_record = session.get(FundProfileRecord, (code, market_type))
    if profile_record is None:
        profile_record = FundProfileRecord(code=code, market_type=market_type)
        session.add(profile_record)

    profile_record.exchange = profile.exchange
    profile_record.name = profile.name
    profile_record.fund_category = profile.fund_category
    profile_record.arbitrage_category = profile.arbitrage_category
    profile_record.underlying_index_code = profile.underlying_index_code
    profile_record.fund_company = profile.fund_company
    profile_record.risk_level = profile.risk_level
    profile_record.calendar_market = profile.calendar_market
    profile_record.is_lof = profile.is_lof
    profile_record.is_etf = profile.is_etf
    profile_record.is_qdii = profile.is_qdii
    profile_record.is_cross_border = profile.is_cross_border
    profile_record.default_subscribe_t_plus = profile.default_subscribe_t_plus
    profile_record.default_redeem_t_plus = profile.default_redeem_t_plus
    profile_record.updated_at = datetime.now(timezone.utc)
    return profile_record


def sync_daily_snapshot(
    session,
    *,
    code: str,
    trade_date,
    quote,
    official_nav,
    estimate_nav,
    status,
    opportunity,
    purchase_limit_amount=None,
) -> FundDailySnapshot:
    daily_snapshot = session.query(FundDailySnapshot).filter(
        FundDailySnapshot.fund_code == code,
        FundDailySnapshot.trade_date == trade_date,
    ).one_or_none()
    if daily_snapshot is None:
        daily_snapshot = FundDailySnapshot(fund_code=code, trade_date=trade_date)
        session.add(daily_snapshot)

    daily_snapshot.open_price = quote.open_price
    daily_snapshot.close_price = quote.last_price
    daily_snapshot.high_price = quote.high_price
    daily_snapshot.low_price = quote.low_price
    daily_snapshot.amount = quote.amount
    daily_snapshot.official_nav = official_nav.nav_value
    daily_snapshot.estimated_nav_close = estimate_nav.nav_value
    daily_snapshot.nav_change_rate = official_nav.change_pct
    daily_snapshot.close_premium_rate = opportunity.gross_premium_rate
    daily_snapshot.nav_premium_rate = opportunity.gross_premium_rate
    daily_snapshot.valuation_error_rate = opportunity.valuation_error_rate
    daily_snapshot.subscribe_status = "SUBSCRIBABLE" if status.can_subscribe else "DISABLED"
    daily_snapshot.subscribe_limit_amount = purchase_limit_amount
    daily_snapshot.updated_at = datetime.now(timezone.utc)
    return daily_snapshot


def sync_opportunity_record(
    session,
    *,
    code: str,
    market_type: str,
    profile,
    opportunity,
) -> OpportunitySnapshot:
    opportunity_record = session.get(OpportunitySnapshot, (code, market_type))
    if opportunity_record is None:
        opportunity_record = OpportunitySnapshot(code=code, market_type=market_type)
        session.add(opportunity_record)

    opportunity_record.name = profile.name
    opportunity_record.benchmark_type = opportunity.benchmark_type
    opportunity_record.benchmark_value = opportunity.benchmark_value
    opportunity_record.gross_premium_rate = opportunity.gross_premium_rate
    opportunity_record.estimate_premium_rate = opportunity.estimate_premium_rate
    opportunity_record.valuation_error_rate = opportunity.valuation_error_rate
    opportunity_record.fee_cost_rate = opportunity.fee_cost_rate
    opportunity_record.slippage_cost_rate = opportunity.slippage_cost_rate
    opportunity_record.estimated_net_profit_rate = opportunity.estimated_net_profit_rate
    opportunity_record.liquidity_score = opportunity.liquidity_score
    opportunity_record.status_score = opportunity.status_score
    opportunity_record.quality_score = opportunity.quality_score
    opportunity_record.risk_score = opportunity.risk_score
    opportunity_record.risk_level = opportunity.risk_level
    opportunity_record.opportunity_level = opportunity.opportunity_level
    opportunity_record.risk_tags = opportunity.risk_tags
    opportunity_record.displayable = opportunity.displayable
    opportunity_record.trigger_count = opportunity.trigger_count
    opportunity_record.historical_success_rate = opportunity.historical_success_rate
    opportunity_record.occurrence_probability = opportunity.occurrence_probability
    opportunity_record.data_quality_status = opportunity.data_quality_status
    opportunity_record.quality_flags = opportunity.quality_flags
    opportunity_record.expected_confirm_date = opportunity.expected_confirm_date
    opportunity_record.expected_arrival_date = opportunity.expected_arrival_date
    opportunity_record.expected_sell_date = opportunity.expected_sell_date
    opportunity_record.calculated_at = opportunity.calculated_at or datetime.now(timezone.utc)
    opportunity_record.algorithm_version = opportunity.algorithm_version
    return opportunity_record
