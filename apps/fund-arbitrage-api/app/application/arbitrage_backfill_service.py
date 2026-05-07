from __future__ import annotations

from app.application import backtest_engine_service
from app.application import historical_snapshot_service


def rebuild_for_fund(*, code: str, market_type: str) -> dict:
    backfill_result = historical_snapshot_service.backfill_for_fund(code=code, market_type=market_type)
    backtest_result = backtest_engine_service.rebuild_for_fund(code=code, market_type=market_type)
    return {
        "code": code,
        "market_type": market_type,
        "filled": backfill_result["filled"],
        "events": backtest_result["events"],
        "updated": backfill_result["updated"] or backtest_result["updated"],
    }


def rebuild_all() -> dict:
    historical_result = historical_snapshot_service.backfill_all()
    backtest_result = backtest_engine_service.rebuild_all()
    return {
        "processed": backtest_result["processed"],
        "updated": backtest_result["updated"],
        "filled": historical_result["filled"],
        "events": backtest_result["events"],
    }
