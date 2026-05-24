from __future__ import annotations

from sqlalchemy import select

from app.config import OPPORTUNITY_CACHE_TTL_SECONDS
from app.application.presentation_service import display_label
from app.infrastructure.db.session import session_scope
from app.db_models import FundSnapshot
from app.infrastructure.cache.cache_service import cache_service
from app.infrastructure.repositories.opportunity_repository import OpportunityRepository
from app.models.opportunity import OpportunityDetailResponse, OpportunityItem, OpportunityListResponse
from app.application.fund_refresh_service import refresh_snapshot_detail


class OpportunityService:
    def __init__(self) -> None:
        self.repository = OpportunityRepository()

    def refresh_for_snapshot(self, session, snapshot: FundSnapshot, market_record: dict | None = None) -> None:
        refresh_snapshot_detail(session, snapshot, market_record)

    def list_opportunities(self, *, market_type: str | None = None, level: str | None = None) -> OpportunityListResponse:
        cache_key = f"opportunities:list:{market_type or 'ALL'}:{level or 'ALL'}"
        cached = cache_service.get_json(cache_key)
        if cached is not None:
            return OpportunityListResponse(**cached)

        with session_scope() as session:
            items = self.repository.list_displayable(session, market_type=market_type, level=level)
            update_time = max((item.calculated_at for item in items), default=None)
            response = OpportunityListResponse(
                success=True,
                items=[self._to_item(item) for item in items],
                update_time=update_time.strftime("%Y-%m-%d %H:%M:%S") if update_time else None,
            )
            cache_service.set_json(cache_key, response.model_dump(mode="json"), OPPORTUNITY_CACHE_TTL_SECONDS)
            return response

    def get_opportunity(self, *, code: str, market_type: str) -> OpportunityDetailResponse | None:
        cache_key = f"opportunities:detail:{market_type}:{code}"
        cached = cache_service.get_json(cache_key)
        if cached is not None:
            return OpportunityDetailResponse(**cached)

        with session_scope() as session:
            item = self.repository.get_by_code(session, code=code, market_type=market_type)
            if item is None:
                snapshot = session.execute(
                    select(FundSnapshot).where(
                        FundSnapshot.code == code,
                        FundSnapshot.market_type == market_type,
                    )
                ).scalar_one_or_none()
                if snapshot is None:
                    return None
                refresh_snapshot_detail(session, snapshot)
                session.flush()
                item = self.repository.get_by_code(session, code=code, market_type=market_type)
                if item is None:
                    return None
            response = OpportunityDetailResponse(success=True, item=self._to_item(item))
            cache_service.set_json(cache_key, response.model_dump(mode="json"), OPPORTUNITY_CACHE_TTL_SECONDS)
            return response

    @staticmethod
    def _to_item(item) -> OpportunityItem:
        label, advisory = display_label(
            score_level=item.score_level,
            data_quality_status=item.data_quality_status,
            crowding_level=item.crowding_level,
            risk_level=item.risk_level,
        )
        return OpportunityItem(
            code=item.code,
            market_type=item.market_type,
            name=item.name,
            benchmark_type=item.benchmark_type,
            benchmark_value=item.benchmark_value,
            gross_premium_rate=item.gross_premium_rate,
            estimate_premium_rate=item.estimate_premium_rate,
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
            opportunity_level=item.opportunity_level,
            final_score=item.final_score,
            score_level=item.score_level,
            crowding_score=item.crowding_score,
            crowding_level=item.crowding_level,
            display_label=label,
            advisory_text=advisory,
            risk_tags=item.risk_tags or [],
            expected_confirm_date=item.expected_confirm_date.strftime("%Y-%m-%d") if item.expected_confirm_date else None,
            expected_arrival_date=item.expected_arrival_date.strftime("%Y-%m-%d") if item.expected_arrival_date else None,
            expected_sell_date=item.expected_sell_date.strftime("%Y-%m-%d") if item.expected_sell_date else None,
            calculated_at=item.calculated_at.strftime("%Y-%m-%d %H:%M:%S") if item.calculated_at else None,
            algorithm_version=item.algorithm_version,
        )


opportunity_service = OpportunityService()
