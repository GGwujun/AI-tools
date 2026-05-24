from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select

from app.infrastructure.db.session import session_scope
from app.db_models import TradingCalendarDay


class TradingCalendarService:
    def is_trade_day(self, session, *, market: str, trade_date: date) -> bool:
        override = session.execute(
            select(TradingCalendarDay).where(
                TradingCalendarDay.market == market,
                TradingCalendarDay.trade_date == trade_date,
            )
        ).scalar_one_or_none()
        if override is not None:
            return override.is_open
        return trade_date.weekday() < 5

    def next_trade_date(self, *, market: str = "CN", from_date: date, offset: int = 1) -> date:
        if offset < 0:
            raise ValueError("offset must be >= 0")

        with session_scope() as session:
            current = from_date
            if offset == 0:
                while not self.is_trade_day(session, market=market, trade_date=current):
                    current += timedelta(days=1)
                return current

            found = 0
            while found < offset:
                current += timedelta(days=1)
                if self.is_trade_day(session, market=market, trade_date=current):
                    found += 1
            return current

    def set_day(self, *, market: str, trade_date: date, is_open: bool, note: str = "") -> None:
        with session_scope() as session:
            record = session.execute(
                select(TradingCalendarDay).where(
                    TradingCalendarDay.market == market,
                    TradingCalendarDay.trade_date == trade_date,
                )
            ).scalar_one_or_none()
            if record is None:
                record = TradingCalendarDay(market=market, trade_date=trade_date)
                session.add(record)
            record.is_open = is_open
            record.note = note

    def get_day(self, *, market: str, trade_date: date) -> TradingCalendarDay | None:
        with session_scope() as session:
            return session.execute(
                select(TradingCalendarDay).where(
                    TradingCalendarDay.market == market,
                    TradingCalendarDay.trade_date == trade_date,
                )
            ).scalar_one_or_none()

    def list_days(self, *, market: str, date_from: date, date_to: date) -> list[TradingCalendarDay]:
        with session_scope() as session:
            return list(
                session.execute(
                    select(TradingCalendarDay).where(
                        TradingCalendarDay.market == market,
                        TradingCalendarDay.trade_date >= date_from,
                        TradingCalendarDay.trade_date <= date_to,
                    ).order_by(TradingCalendarDay.trade_date.asc())
                ).scalars().all()
            )


trading_calendar_service = TradingCalendarService()
