from __future__ import annotations

from sqlalchemy import select

from app.db_models import OpportunitySnapshot


class OpportunityRepository:
    def list_displayable(self, session, *, market_type: str | None = None, level: str | None = None) -> list[OpportunitySnapshot]:
        stmt = select(OpportunitySnapshot).where(OpportunitySnapshot.displayable.is_(True))
        if market_type:
            stmt = stmt.where(OpportunitySnapshot.market_type == market_type)
        if level:
            stmt = stmt.where(OpportunitySnapshot.opportunity_level == level)
        stmt = stmt.order_by(
            OpportunitySnapshot.estimated_net_profit_rate.desc().nullslast(),
            OpportunitySnapshot.quality_score.desc(),
            OpportunitySnapshot.code,
        )
        return list(session.execute(stmt).scalars().all())

    def get_by_code(self, session, *, code: str, market_type: str) -> OpportunitySnapshot | None:
        stmt = select(OpportunitySnapshot).where(
            OpportunitySnapshot.code == code,
            OpportunitySnapshot.market_type == market_type,
        )
        return session.execute(stmt).scalar_one_or_none()
