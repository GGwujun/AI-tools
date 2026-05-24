from __future__ import annotations

from datetime import datetime, timezone
from math import log10

from sqlalchemy import select

from app.db_models import FundArbitrageStat, FundOpportunityScore, OpportunitySnapshot
from app.infrastructure.utils import clamp_100 as _clamp_100


def _score_level(final_score: float) -> str:
    if final_score >= 90:
        return "STRONG"
    if final_score >= 75:
        return "ACTIONABLE"
    if final_score >= 60:
        return "WATCH"
    return "REJECT"


def _crowding_discount(crowding_score: float) -> float:
    if crowding_score >= 80:
        return 0.6
    if crowding_score >= 60:
        return 0.8
    if crowding_score >= 30:
        return 0.9
    return 1.0


def _profit_score(opportunity, stat: FundArbitrageStat | None) -> float:
    current_premium = max(0.0, opportunity.gross_premium_rate or 0.0) * 10
    avg_return = max(0.0, (stat.avg_return_rate if stat and stat.avg_return_rate is not None else opportunity.estimated_net_profit_rate or 0.0) * 8)
    p75_proxy = max(0.0, (stat.max_return_rate if stat and stat.max_return_rate is not None else opportunity.estimated_net_profit_rate or 0.0) * 6)
    return _clamp_100(0.45 * current_premium + 0.35 * avg_return + 0.20 * p75_proxy)


def _reliability_score(opportunity, stat: FundArbitrageStat | None) -> float:
    success_rate = (stat.success_rate if stat and stat.success_rate is not None else opportunity.historical_success_rate or 0.0) * 100
    sample = log10(max(1, stat.trigger_count if stat else opportunity.trigger_count or 1)) / log10(100) * 100
    stability = 100.0
    if stat and stat.max_return_rate is not None and stat.min_return_rate is not None:
        spread = abs(stat.max_return_rate - stat.min_return_rate)
        stability = _clamp_100(100 - spread * 5)
    # Z-score contribution: anomaly gets 100, notable gets 70, normal gets 40
    z_score_normalized = 100.0 if opportunity.z_score_level == "ANOMALY" else 70.0 if opportunity.z_score_level == "NOTABLE" else 40.0
    return _clamp_100(0.35 * success_rate + 0.20 * sample + 0.15 * stability + 0.30 * z_score_normalized)


def _execution_score(opportunity, profile) -> float:
    subscribable = 100.0 if "暂停申购" not in (opportunity.risk_tags or []) else 0.0
    limit_looseness = 80.0 if opportunity.data_quality_status == "OK" else 50.0
    arrival_days = profile.default_redeem_t_plus or 3
    cycle_score = _clamp_100(100 - arrival_days * 8)
    return _clamp_100(0.45 * subscribable + 0.20 * limit_looseness + 0.35 * cycle_score)


def _liquidity_score(opportunity) -> float:
    return _clamp_100(opportunity.liquidity_score * 100)


def _risk_score(opportunity) -> float:
    quality_penalty = 20.0 if opportunity.data_quality_status == "WARN" else 50.0 if opportunity.data_quality_status == "ERROR" else 0.0
    return _clamp_100(100 - opportunity.risk_score - quality_penalty)


def sync_opportunity_score(session, *, code: str, market_type: str, profile, opportunity, crowding_score: float = 0.0) -> FundOpportunityScore:
    stat = session.execute(
        select(FundArbitrageStat).where(
            FundArbitrageStat.fund_code == code,
            FundArbitrageStat.threshold_type == "premium_rate",
            FundArbitrageStat.threshold_value == 0.5,
        )
    ).scalar_one_or_none()

    profit_score = _profit_score(opportunity, stat)
    reliability_score = _reliability_score(opportunity, stat)
    execution_score = _execution_score(opportunity, profile)
    liquidity_score = _liquidity_score(opportunity)
    risk_score = _risk_score(opportunity)
    base_score = _clamp_100(
        0.30 * profit_score
        + 0.25 * reliability_score
        + 0.20 * execution_score
        + 0.15 * liquidity_score
        + 0.10 * risk_score
    )
    final_score = _clamp_100(base_score * _crowding_discount(crowding_score))
    level = _score_level(final_score)

    score = FundOpportunityScore(
        fund_code=code,
        market_type=market_type,
        snapshot_time=datetime.now(timezone.utc),
        final_score=round(final_score, 4),
        level=level,
        profit_score=round(profit_score, 4),
        reliability_score=round(reliability_score, 4),
        execution_score=round(execution_score, 4),
        liquidity_score=round(liquidity_score, 4),
        risk_score=round(risk_score, 4),
        z_score=round(opportunity.z_score or 0.0, 4),
        z_score_level=opportunity.z_score_level or "NORMAL",
    )
    session.add(score)

    opportunity_record = session.get(OpportunitySnapshot, (code, market_type))
    if opportunity_record is not None:
        opportunity_record.final_score = round(final_score, 4)
        opportunity_record.score_level = level
    opportunity.final_score = round(final_score, 4)
    opportunity.score_level = level

    return score
