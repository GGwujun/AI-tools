from __future__ import annotations

from datetime import date, datetime, timezone
from math import prod

from sqlalchemy import delete, select

from app.application.cache_invalidation_service import invalidate_all_for_fund
from app.application.task_run_service import finish_task, start_task
from app.application.trading_calendar_service import trading_calendar_service
from app.infrastructure.db.session import session_scope
from app.db_models import (
    FundArbitrageEvent,
    FundArbitrageStat,
    FundDailySnapshot,
    FundProfileRecord,
    OpportunitySnapshot,
)


THRESHOLD_TYPE = "premium_rate"
DEFAULT_THRESHOLD = 0.5
DEFAULT_SLIPPAGE_RATE = 0.05  # 0.05% in percent-point units


def _fee_rate(profile: FundProfileRecord | None) -> float:
    """Fee rate in percent-point units (e.g. 0.17 means 0.17%)."""
    if profile is None:
        return 0.17  # default: 0.02% base + 0.15% LOF
    fee = 0.02 + 0.15  # base commission + LOF subscription
    if profile.is_qdii:
        fee += 0.10
    return fee


def _calendar_market(profile: FundProfileRecord | None) -> str:
    if profile is None:
        return "CN"
    return profile.calendar_market or "CN"


def _find_sell_snapshot(snapshots: list[FundDailySnapshot], sell_date: date) -> FundDailySnapshot | None:
    for item in snapshots:
        if item.trade_date >= sell_date and item.close_price is not None:
            return item
    return None


def rebuild_for_fund(*, code: str, market_type: str, threshold: float = DEFAULT_THRESHOLD) -> dict:
    with session_scope() as session:
        profile = session.get(FundProfileRecord, (code, market_type))
        daily_rows = list(
            session.execute(
                select(FundDailySnapshot)
                .where(FundDailySnapshot.fund_code == code)
                .order_by(FundDailySnapshot.trade_date.asc())
            ).scalars().all()
        )
        if not daily_rows:
            return {"code": code, "market_type": market_type, "events": 0, "updated": False}

        session.execute(
            delete(FundArbitrageEvent).where(
                FundArbitrageEvent.fund_code == code,
                FundArbitrageEvent.threshold_type == THRESHOLD_TYPE,
                FundArbitrageEvent.threshold_value == threshold,
            )
        )

        fee_rate = _fee_rate(profile)
        slippage_rate = DEFAULT_SLIPPAGE_RATE
        calendar_market = _calendar_market(profile)
        confirm_days = profile.default_subscribe_t_plus if profile and profile.default_subscribe_t_plus is not None else 1
        arrival_days = profile.default_redeem_t_plus if profile and profile.default_redeem_t_plus is not None else 3

        created_events: list[FundArbitrageEvent] = []

        for row in daily_rows:
            if row.close_premium_rate is None or row.close_premium_rate <= threshold:
                continue
            if row.subscribe_status and row.subscribe_status != "SUBSCRIBABLE":
                continue
            if row.official_nav is None or row.official_nav <= 0:
                continue

            confirm_date = trading_calendar_service.next_trade_date(
                market=calendar_market,
                from_date=row.trade_date,
                offset=confirm_days,
            )
            arrival_date = trading_calendar_service.next_trade_date(
                market=calendar_market,
                from_date=row.trade_date,
                offset=arrival_days,
            )
            sell_date = trading_calendar_service.next_trade_date(
                market=calendar_market,
                from_date=arrival_date,
                offset=0,
            )

            sell_snapshot = _find_sell_snapshot(daily_rows, sell_date)
            sell_price = sell_snapshot.close_price if sell_snapshot else None
            return_rate = None
            success = None
            status = "triggered"

            if sell_price is not None:
                gross_return_pct = (sell_price - row.official_nav) / row.official_nav * 100  # convert to percent-points
                return_rate = round(gross_return_pct - fee_rate - slippage_rate, 4)
                success = return_rate > 0
                status = "settled"

            created_events.append(
                FundArbitrageEvent(
                    fund_code=code,
                    trigger_date=row.trade_date,
                    threshold_type=THRESHOLD_TYPE,
                    threshold_value=threshold,
                    trigger_premium_rate=row.close_premium_rate,
                    trigger_nav=row.official_nav,
                    trigger_close_price=row.close_price,
                    subscribe_nav=row.official_nav,
                    confirm_date=confirm_date,
                    arrival_date=arrival_date,
                    sell_date=sell_snapshot.trade_date if sell_snapshot else sell_date,
                    sell_price=sell_price,
                    fee_rate=fee_rate,
                    slippage_rate=slippage_rate,
                    return_rate=return_rate,
                    success=success,
                    status=status,
                    updated_at=datetime.now(timezone.utc),
                )
            )

        for event in created_events:
            session.add(event)

        total_trade_days = len(daily_rows)
        trigger_count = len(created_events)
        settled = [item for item in created_events if item.return_rate is not None]
        success_count = sum(1 for item in settled if item.success)
        returns = [item.return_rate or 0.0 for item in settled]
        loss_count = sum(1 for item in settled if (item.return_rate or 0.0) <= 0)

        stat = session.execute(
            select(FundArbitrageStat).where(
                FundArbitrageStat.fund_code == code,
                FundArbitrageStat.threshold_type == THRESHOLD_TYPE,
                FundArbitrageStat.threshold_value == threshold,
            )
        ).scalar_one_or_none()
        if stat is None:
            stat = FundArbitrageStat(
                fund_code=code,
                threshold_type=THRESHOLD_TYPE,
                threshold_value=threshold,
                stat_start_date=daily_rows[0].trade_date,
                stat_end_date=daily_rows[-1].trade_date,
            )
            session.add(stat)

        stat.total_trade_days = total_trade_days
        stat.trigger_count = trigger_count
        stat.success_count = success_count
        stat.occurrence_probability = round(trigger_count / total_trade_days, 6) if total_trade_days else None
        stat.success_rate = round(success_count / len(settled), 6) if settled else None
        stat.sum_return_rate = round(sum(returns), 6) if returns else None
        stat.compound_return_rate = round((prod([(1 + item / 100) for item in returns]) - 1) * 100, 6) if returns else None
        stat.avg_return_rate = round(sum(returns) / len(returns), 6) if returns else None
        stat.max_return_rate = max(returns) if returns else None
        stat.min_return_rate = min(returns) if returns else None
        stat.stat_start_date = daily_rows[0].trade_date
        stat.stat_end_date = daily_rows[-1].trade_date
        stat.updated_at = datetime.now(timezone.utc)

        opportunity = session.get(OpportunitySnapshot, (code, market_type))
        if opportunity is not None:
            opportunity.trigger_count = trigger_count
            opportunity.historical_success_rate = stat.success_rate
            opportunity.occurrence_probability = stat.occurrence_probability

        result = {
            "code": code,
            "market_type": market_type,
            "events": trigger_count,
            "updated": True,
            "loss_count": loss_count,
        }
    invalidate_all_for_fund(code=code, market_type=market_type)
    return result


def rebuild_all(*, threshold: float = DEFAULT_THRESHOLD) -> dict:
    task_id = start_task(task_name="backtest_rebuild", message=f"rebuilding backtest threshold={threshold}")
    with session_scope() as session:
        targets = list(session.execute(select(FundProfileRecord.code, FundProfileRecord.market_type)).all())

    processed = 0
    updated = 0
    events = 0
    for code, market_type in targets:
        processed += 1
        result = rebuild_for_fund(code=code, market_type=market_type, threshold=threshold)
        if result["updated"]:
            updated += 1
            events += result["events"]
    finish_task(task_id=task_id, status="success", processed_count=processed, failed_count=processed - updated, message="backtest rebuild finished")
    return {"processed": processed, "updated": updated, "events": events}
