from __future__ import annotations

from sqlalchemy import select

from app.infrastructure.db.session import session_scope
from app.db_models import FundArbitrageEvent, FundArbitrageStat
from app.models.opportunity import BacktestEventItem, BacktestResultResponse, BacktestStatItem


def get_backtest_result(*, code: str, threshold: float = 0.5) -> BacktestResultResponse:
    with session_scope() as session:
        stat = session.execute(
            select(FundArbitrageStat).where(
                FundArbitrageStat.fund_code == code,
                FundArbitrageStat.threshold_type == "premium_rate",
                FundArbitrageStat.threshold_value == threshold,
            )
        ).scalar_one_or_none()

        events = list(
            session.execute(
                select(FundArbitrageEvent).where(
                    FundArbitrageEvent.fund_code == code,
                    FundArbitrageEvent.threshold_type == "premium_rate",
                    FundArbitrageEvent.threshold_value == threshold,
                ).order_by(FundArbitrageEvent.trigger_date.desc())
            ).scalars().all()
        )

        stat_item = None
        if stat is not None:
            warning = ""
            if events and any(item.status != "settled" for item in events):
                warning = "部分历史事件仍为近似回填或未完全结算，仅供参考。"
            stat_item = BacktestStatItem(
                fund_code=stat.fund_code,
                threshold_type=stat.threshold_type,
                threshold_value=stat.threshold_value,
                total_trade_days=stat.total_trade_days,
                trigger_count=stat.trigger_count,
                success_count=stat.success_count,
                success_rate=stat.success_rate,
                occurrence_probability=stat.occurrence_probability,
                sum_return_rate=stat.sum_return_rate,
                compound_return_rate=stat.compound_return_rate,
                avg_return_rate=stat.avg_return_rate,
                max_return_rate=stat.max_return_rate,
                min_return_rate=stat.min_return_rate,
                data_quality_warning=warning,
                updated_at=stat.updated_at.strftime("%Y-%m-%d %H:%M:%S") if stat.updated_at else None,
            )

        event_items = [
            BacktestEventItem(
                trigger_date=item.trigger_date.strftime("%Y-%m-%d"),
                threshold_value=item.threshold_value,
                trigger_premium_rate=item.trigger_premium_rate,
                subscribe_nav=item.subscribe_nav,
                sell_date=item.sell_date.strftime("%Y-%m-%d") if item.sell_date else None,
                sell_price=item.sell_price,
                fee_rate=item.fee_rate,
                slippage_rate=item.slippage_rate,
                return_rate=item.return_rate,
                success=item.success,
                status=item.status,
            )
            for item in events
        ]

        return BacktestResultResponse(success=True, stat=stat_item, events=event_items)
