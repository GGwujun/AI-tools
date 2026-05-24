from __future__ import annotations

from sqlalchemy import select

from app.infrastructure.db.session import session_scope
from app.db_models import RawDataEvent
from app.models.system import RawDataEventItem, RawDataEventListResponse


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
