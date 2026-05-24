from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select

from app.application.cache_invalidation_service import invalidate_all_for_fund
from app.application.task_run_service import finish_task, start_task
from app.infrastructure.db.session import session_scope
from app.db_models import FundDailySnapshot, FundNavHistory, FundSnapshot


def _derive_close_price(nav_price: float, historical_premium_rate: float | None, current_premium_rate: float | None, nav_change_pct: float | None) -> float:
    if historical_premium_rate is not None:
        return round(nav_price * (1 + historical_premium_rate / 100), 4)

    if current_premium_rate is not None:
        bounded = max(min(current_premium_rate, 2.0), -2.0)
        return round(nav_price * (1 + bounded / 100), 4)

    drift_pct = (nav_change_pct or 0.0) * 0.1
    bounded_drift = max(min(drift_pct, 1.0), -1.0)
    return round(nav_price * (1 + bounded_drift / 100), 4)


def backfill_for_fund(*, code: str, market_type: str) -> dict:
    with session_scope() as session:
        snapshot = session.execute(
            select(FundSnapshot).where(
                FundSnapshot.code == code,
                FundSnapshot.market_type == market_type,
            )
        ).scalar_one_or_none()
        if snapshot is None:
            return {"code": code, "market_type": market_type, "filled": 0, "updated": False}

        history_rows = list(
            session.execute(
                select(FundNavHistory)
                .where(FundNavHistory.fund_id == snapshot.id)
                .order_by(FundNavHistory.nav_date.asc())
            ).scalars().all()
        )
        if not history_rows:
            return {"code": code, "market_type": market_type, "filled": 0, "updated": False}

        filled = 0
        for row in history_rows:
            daily_snapshot = session.execute(
                select(FundDailySnapshot).where(
                    FundDailySnapshot.fund_code == code,
                    FundDailySnapshot.trade_date == row.nav_date,
                )
            ).scalar_one_or_none()
            if daily_snapshot is None:
                daily_snapshot = FundDailySnapshot(fund_code=code, trade_date=row.nav_date)
                session.add(daily_snapshot)
                filled += 1

            close_price = _derive_close_price(
                nav_price=row.nav_price,
                historical_premium_rate=row.premium_rate,
                current_premium_rate=snapshot.premium_rate,
                nav_change_pct=row.nav_change_pct,
            )
            valuation_error_rate = None
            if row.nav_price:
                valuation_error_rate = round((close_price - row.nav_price) / row.nav_price, 6)

            daily_snapshot.open_price = daily_snapshot.open_price or close_price
            daily_snapshot.close_price = close_price
            daily_snapshot.high_price = max(close_price, daily_snapshot.high_price or close_price)
            daily_snapshot.low_price = min(close_price, daily_snapshot.low_price or close_price)
            daily_snapshot.amount = daily_snapshot.amount or 0.0
            daily_snapshot.official_nav = row.nav_price
            daily_snapshot.estimated_nav_close = row.nav_price
            daily_snapshot.nav_change_rate = row.nav_change_pct
            daily_snapshot.close_change_rate = row.nav_change_pct
            daily_snapshot.close_premium_rate = round((close_price - row.nav_price) / row.nav_price * 100, 4) if row.nav_price else None
            daily_snapshot.nav_premium_rate = daily_snapshot.close_premium_rate
            daily_snapshot.valuation_error_rate = valuation_error_rate
            daily_snapshot.subscribe_status = daily_snapshot.subscribe_status or ("SUBSCRIBABLE" if not snapshot.is_paused else "DISABLED")
            daily_snapshot.updated_at = datetime.now(timezone.utc)

        result = {"code": code, "market_type": market_type, "filled": filled, "updated": True}
    invalidate_all_for_fund(code=code, market_type=market_type)
    return result


def backfill_all() -> dict:
    task_id = start_task(task_name="historical_snapshot_backfill", message="backfilling daily snapshots")
    with session_scope() as session:
        targets = list(session.execute(select(FundSnapshot.code, FundSnapshot.market_type)).all())

    processed = 0
    updated = 0
    filled = 0
    for code, market_type in targets:
        processed += 1
        result = backfill_for_fund(code=code, market_type=market_type)
        if result["updated"]:
            updated += 1
            filled += result["filled"]
    finish_task(task_id=task_id, status="success", processed_count=processed, failed_count=processed - updated, message="daily snapshot backfill finished")
    return {"processed": processed, "updated": updated, "filled": filled}
