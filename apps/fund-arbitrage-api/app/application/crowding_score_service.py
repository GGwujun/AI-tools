from __future__ import annotations

from datetime import datetime

from sqlalchemy import select

from app.db_models import FundCrowdingScore, FundDailySnapshot, OpportunitySnapshot


def _clamp_100(value: float) -> float:
    return max(0.0, min(100.0, value))


def _crowding_level(score: float) -> str:
    if score >= 80:
        return "HIGH"
    if score >= 60:
        return "MEDIUM_HIGH"
    if score >= 30:
        return "MEDIUM"
    return "LOW"


def _sum_volume(levels: list[dict]) -> float:
    total = 0.0
    for item in levels:
        try:
            total += float(item.get("volume") or 0)
        except (TypeError, ValueError):
            continue
    return total


def sync_crowding_score(
    session,
    *,
    code: str,
    market_type: str,
    quote,
    opportunity,
    history_rows: list[dict],
) -> FundCrowdingScore:
    daily_rows = list(
        session.execute(
            select(FundDailySnapshot)
            .where(FundDailySnapshot.fund_code == code)
            .order_by(FundDailySnapshot.trade_date.desc())
            .limit(6)
        ).scalars().all()
    )

    share_score = 0.0

    avg_amount = 0.0
    historical_amounts = [row.amount for row in daily_rows[1:] if row.amount is not None]
    if historical_amounts:
        avg_amount = sum(historical_amounts) / len(historical_amounts)
    amount_ratio = (quote.amount or 0.0) / avg_amount if avg_amount > 0 else 1.0
    amount_score = _clamp_100((amount_ratio - 1.0) * 50)

    yesterday_premium = daily_rows[1].close_premium_rate if len(daily_rows) > 1 else None
    current_premium = opportunity.gross_premium_rate
    premium_decay = (yesterday_premium or 0.0) - (current_premium or 0.0)
    premium_decay_score = _clamp_100(max(0.0, premium_decay) * 40)

    bid_volume = _sum_volume(quote.bid_levels)
    ask_volume = _sum_volume(quote.ask_levels)
    total_volume = bid_volume + ask_volume
    imbalance = ((ask_volume - bid_volume) / total_volume) if total_volume > 0 else 0.0
    orderbook_score = _clamp_100(max(0.0, imbalance) * 100)

    streak = 0
    for row in daily_rows:
        if row.close_premium_rate is not None and row.close_premium_rate > 0.5:
            streak += 1
        else:
            break
    streak_score = _clamp_100(streak * 20)

    crowding_score = _clamp_100(
        0.30 * share_score
        + 0.25 * amount_score
        + 0.20 * premium_decay_score
        + 0.15 * orderbook_score
        + 0.10 * streak_score
    )
    level = _crowding_level(crowding_score)

    record = FundCrowdingScore(
        fund_code=code,
        market_type=market_type,
        snapshot_time=datetime.utcnow(),
        share_score=round(share_score, 4),
        amount_score=round(amount_score, 4),
        premium_decay_score=round(premium_decay_score, 4),
        orderbook_score=round(orderbook_score, 4),
        streak_score=round(streak_score, 4),
        crowding_score=round(crowding_score, 4),
        level=level,
    )
    session.add(record)

    opportunity_record = session.get(OpportunitySnapshot, (code, market_type))
    if opportunity_record is not None:
        opportunity_record.crowding_score = round(crowding_score, 4)
        opportunity_record.crowding_level = level
        if crowding_score > 80:
            opportunity_record.displayable = False
            if "套利资金拥挤" not in (opportunity_record.risk_tags or []):
                opportunity_record.risk_tags = [*(opportunity_record.risk_tags or []), "套利资金拥挤"]

    return record
