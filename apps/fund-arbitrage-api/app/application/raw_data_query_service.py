from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import select

from app.database import SessionLocal
from app.db_models import RawDataEvent
from app.models.system import RawDataEventItem, RawDataEventListResponse


@contextmanager
def session_scope() -> Iterator:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def list_raw_events(*, code: str, data_type: str | None = None, limit: int = 20) -> RawDataEventListResponse:
    with session_scope() as session:
        stmt = (
            select(RawDataEvent)
            .where(RawDataEvent.biz_key.like(f"%{code}%"))
            .order_by(RawDataEvent.collected_at.desc())
        )
        if data_type:
            stmt = stmt.where(RawDataEvent.data_type == data_type)
        stmt = stmt.limit(limit)
        rows = list(session.execute(stmt).scalars().all())

        return RawDataEventListResponse(
            success=True,
            items=[
                RawDataEventItem(
                    source_code=row.source_code,
                    data_type=row.data_type,
                    biz_key=row.biz_key,
                    raw_payload=row.raw_payload or {},
                    collected_at=row.collected_at.strftime("%Y-%m-%d %H:%M:%S"),
                )
                for row in rows
            ],
        )
