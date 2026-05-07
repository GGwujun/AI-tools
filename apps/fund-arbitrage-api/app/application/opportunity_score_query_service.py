from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import select

from app.database import SessionLocal
from app.db_models import FundCrowdingScore, FundOpportunityScore
from app.infrastructure.cache.cache_service import cache_service
from app.models.system import OpportunityScoreResponse


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


def get_latest_opportunity_score(*, code: str, market_type: str) -> OpportunityScoreResponse:
    cache_key = f"opportunity-score:{market_type}:{code}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return OpportunityScoreResponse(**cached)

    with session_scope() as session:
        score = session.execute(
            select(FundOpportunityScore)
            .where(FundOpportunityScore.fund_code == code, FundOpportunityScore.market_type == market_type)
            .order_by(FundOpportunityScore.snapshot_time.desc())
        ).scalars().first()
        crowding = session.execute(
            select(FundCrowdingScore)
            .where(FundCrowdingScore.fund_code == code, FundCrowdingScore.market_type == market_type)
            .order_by(FundCrowdingScore.snapshot_time.desc())
        ).scalars().first()

        if score is None:
            response = OpportunityScoreResponse(success=True, fund_code=code, market_type=market_type)
            cache_service.set_json(cache_key, response.model_dump(mode="json"), 30)
            return response

        response = OpportunityScoreResponse(
            success=True,
            fund_code=score.fund_code,
            market_type=score.market_type,
            snapshot_time=score.snapshot_time.strftime("%Y-%m-%d %H:%M:%S"),
            final_score=score.final_score,
            level=score.level,
            profit_score=score.profit_score,
            reliability_score=score.reliability_score,
            execution_score=score.execution_score,
            liquidity_score=score.liquidity_score,
            risk_score=score.risk_score,
            crowding_score=crowding.crowding_score if crowding is not None else 0.0,
        )
        cache_service.set_json(cache_key, response.model_dump(mode="json"), 30)
        return response
