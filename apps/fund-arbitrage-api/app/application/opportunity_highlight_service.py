from __future__ import annotations

from sqlalchemy import select

from app.config import OPPORTUNITY_CACHE_TTL_SECONDS
from app.infrastructure.db.session import session_scope
from app.db_models import OpportunitySnapshot
from app.infrastructure.cache.cache_service import cache_service
from app.models.opportunity import OpportunityHighlightResponse, OpportunityItem


def list_highlights(*, limit: int = 5) -> OpportunityHighlightResponse:
    cache_key = f"opportunities:highlights:{limit}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return OpportunityHighlightResponse(**cached)

    with session_scope() as session:
        rows = list(
            session.execute(
                select(OpportunitySnapshot)
                .where(OpportunitySnapshot.displayable.is_(True))
                .order_by(
                    OpportunitySnapshot.final_score.desc(),
                    OpportunitySnapshot.estimated_net_profit_rate.desc().nullslast(),
                    OpportunitySnapshot.quality_score.desc(),
                )
                .limit(limit)
            ).scalars().all()
        )
        update_time = max((item.calculated_at for item in rows), default=None)
        response = OpportunityHighlightResponse(
            success=True,
            items=[
                OpportunityItem(
                    code=item.code,
                    market_type=item.market_type,
                    name=item.name,
                    benchmark_type=item.benchmark_type,
                    benchmark_value=item.benchmark_value,
                    gross_premium_rate=item.gross_premium_rate,
                    valuation_error_rate=item.valuation_error_rate,
                    estimated_net_profit_rate=item.estimated_net_profit_rate,
                    historical_success_rate=item.historical_success_rate,
                    trigger_count=item.trigger_count,
                    occurrence_probability=item.occurrence_probability,
                    quality_score=item.quality_score,
                    liquidity_score=item.liquidity_score,
                    status_score=item.status_score,
                    risk_score=item.risk_score,
                    risk_level=item.risk_level,
                    data_quality_status=item.data_quality_status,
                    quality_flags=item.quality_flags or [],
                    final_score=item.final_score,
                    score_level=item.score_level,
                    crowding_score=item.crowding_score,
                    crowding_level=item.crowding_level,
                    opportunity_level=item.opportunity_level,
                    risk_tags=item.risk_tags or [],
                    expected_confirm_date=item.expected_confirm_date.strftime("%Y-%m-%d") if item.expected_confirm_date else None,
                    expected_arrival_date=item.expected_arrival_date.strftime("%Y-%m-%d") if item.expected_arrival_date else None,
                    expected_sell_date=item.expected_sell_date.strftime("%Y-%m-%d") if item.expected_sell_date else None,
                    calculated_at=item.calculated_at.strftime("%Y-%m-%d %H:%M:%S") if item.calculated_at else None,
                    algorithm_version=item.algorithm_version,
                )
                for item in rows
            ],
            update_time=update_time.strftime("%Y-%m-%d %H:%M:%S") if update_time else None,
        )
        cache_service.set_json(cache_key, response.model_dump(mode="json"), OPPORTUNITY_CACHE_TTL_SECONDS)
        return response
