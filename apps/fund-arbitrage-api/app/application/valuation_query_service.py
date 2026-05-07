from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import select

from app.config import VALUATION_CACHE_TTL_SECONDS
from app.database import SessionLocal
from app.db_models import FundStandardValuationSnapshot
from app.infrastructure.cache.cache_service import cache_service
from app.models.system import StandardValuationHistoryItem, StandardValuationHistoryResponse, StandardValuationResponse


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


def get_latest_standard_valuation(*, code: str) -> StandardValuationResponse:
    cache_key = f"valuation:latest:{code}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return StandardValuationResponse(**cached)

    with session_scope() as session:
        item = session.execute(
            select(FundStandardValuationSnapshot)
            .where(FundStandardValuationSnapshot.fund_code == code)
            .order_by(FundStandardValuationSnapshot.snapshot_time.desc())
        ).scalars().first()

        if item is None:
            response = StandardValuationResponse(success=True, fund_code=code)
            cache_service.set_json(cache_key, response.model_dump(mode="json"), VALUATION_CACHE_TTL_SECONDS)
            return response

        response = StandardValuationResponse(
            success=True,
            fund_code=item.fund_code,
            snapshot_time=item.snapshot_time.strftime("%Y-%m-%d %H:%M:%S"),
            standard_estimated_nav=item.standard_estimated_nav,
            confidence_level=item.confidence_level,
            valuation_source_code=item.valuation_source_code,
            valuation_quality_status=item.valuation_quality_status,
            quality_flags=item.quality_flags or [],
        )
        cache_service.set_json(cache_key, response.model_dump(mode="json"), VALUATION_CACHE_TTL_SECONDS)
        return response


def list_standard_valuation_history(*, code: str, limit: int = 20) -> StandardValuationHistoryResponse:
    with session_scope() as session:
        rows = list(
            session.execute(
                select(FundStandardValuationSnapshot)
                .where(FundStandardValuationSnapshot.fund_code == code)
                .order_by(FundStandardValuationSnapshot.snapshot_time.desc())
                .limit(limit)
            ).scalars().all()
        )

        return StandardValuationHistoryResponse(
            success=True,
            items=[
                StandardValuationHistoryItem(
                    fund_code=row.fund_code,
                    snapshot_time=row.snapshot_time.strftime("%Y-%m-%d %H:%M:%S"),
                    standard_estimated_nav=row.standard_estimated_nav,
                    confidence_level=row.confidence_level,
                    valuation_source_code=row.valuation_source_code,
                    valuation_quality_status=row.valuation_quality_status,
                    quality_flags=row.quality_flags or [],
                )
                for row in rows
            ],
        )
