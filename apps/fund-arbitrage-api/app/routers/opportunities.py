from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Body, HTTPException, Query

from app.application import arbitrage_backfill_service
from app.application.backtest_query_service import get_backtest_result
from app.application.condition_reference_service import get_condition_reference
from app.application import historical_snapshot_service
from app.application.opportunity_highlight_service import list_highlights
from app.application.opportunity_score_query_service import get_latest_opportunity_score
from app.application.opportunity_service import opportunity_service
from app.application.raw_data_query_service import list_raw_events
from app.application.trading_calendar_service import trading_calendar_service
from app.application.valuation_query_service import get_latest_standard_valuation, list_standard_valuation_history
from app.models.condition_reference import ConditionReferenceResponse
from app.models.opportunity import BacktestResultResponse, OpportunityDetailResponse, OpportunityHighlightResponse, OpportunityListResponse
from app.models.system import (
    OpportunityScoreResponse,
    RawDataEventListResponse,
    RebuildStatsResponse,
    StandardValuationResponse,
    StandardValuationHistoryResponse,
    TradingCalendarDayItem,
    TradingCalendarDayResponse,
    TradingCalendarListResponse,
    TradingCalendarResponse,
    TradingCalendarUpsertRequest,
)


router = APIRouter(prefix="/api/opportunities", tags=["opportunities"])


@router.get("", response_model=OpportunityListResponse)
async def list_opportunities(
    market_type: str | None = Query(None),
    level: str | None = Query(None),
):
    normalized_market_type = market_type.upper() if market_type else None
    return opportunity_service.list_opportunities(market_type=normalized_market_type, level=level)


@router.get("/highlights", response_model=OpportunityHighlightResponse)
async def opportunity_highlights(
    limit: int = Query(5, ge=1, le=20),
):
    return list_highlights(limit=limit)


@router.get("/trading-calendar/next", response_model=TradingCalendarResponse)
async def next_trade_date(
    from_date: str = Query(..., description="YYYY-MM-DD"),
    offset: int = Query(1, ge=0),
    market: str = Query("CN"),
):
    try:
        parsed = datetime.strptime(from_date, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="from_date must be YYYY-MM-DD") from exc

    next_day = trading_calendar_service.next_trade_date(market=market, from_date=parsed, offset=offset)
    return TradingCalendarResponse(
        success=True,
        market=market,
        from_date=from_date,
        offset=offset,
        next_trade_date=next_day.strftime("%Y-%m-%d"),
    )


@router.get("/valuation/{code}", response_model=StandardValuationResponse)
async def get_standard_valuation(code: str):
    return get_latest_standard_valuation(code=code)


@router.get("/valuation/{code}/history", response_model=StandardValuationHistoryResponse)
async def get_standard_valuation_history(
    code: str,
    limit: int = Query(20, ge=1, le=200),
):
    return list_standard_valuation_history(code=code, limit=limit)


@router.get("/raw-events/{code}", response_model=RawDataEventListResponse)
async def get_raw_events(
    code: str,
    data_type: str | None = Query(None),
    limit: int = Query(20, ge=1, le=200),
):
    return list_raw_events(code=code, data_type=data_type, limit=limit)


@router.get("/trading-calendar/day", response_model=TradingCalendarDayResponse)
async def get_trade_day(
    trade_date: str = Query(..., description="YYYY-MM-DD"),
    market: str = Query("CN"),
):
    try:
        parsed = datetime.strptime(trade_date, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="trade_date must be YYYY-MM-DD") from exc

    item = trading_calendar_service.get_day(market=market, trade_date=parsed)
    if item is None:
        is_open = parsed.weekday() < 5
        return TradingCalendarDayResponse(
            success=True,
            item=TradingCalendarDayItem(market=market, trade_date=trade_date, is_open=is_open, note="default-weekday-rule"),
        )

    return TradingCalendarDayResponse(
        success=True,
        item=TradingCalendarDayItem(
            market=item.market,
            trade_date=item.trade_date.strftime("%Y-%m-%d"),
            is_open=item.is_open,
            note=item.note,
        ),
    )


@router.get("/trading-calendar/days", response_model=TradingCalendarListResponse)
async def list_trade_days(
    date_from: str = Query(..., description="YYYY-MM-DD"),
    date_to: str = Query(..., description="YYYY-MM-DD"),
    market: str = Query("CN"),
):
    try:
        parsed_from = datetime.strptime(date_from, "%Y-%m-%d").date()
        parsed_to = datetime.strptime(date_to, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date_from/date_to must be YYYY-MM-DD") from exc
    if parsed_to < parsed_from:
        raise HTTPException(status_code=400, detail="date_to must be >= date_from")

    items = trading_calendar_service.list_days(market=market, date_from=parsed_from, date_to=parsed_to)
    return TradingCalendarListResponse(
        success=True,
        items=[
            TradingCalendarDayItem(
                market=item.market,
                trade_date=item.trade_date.strftime("%Y-%m-%d"),
                is_open=item.is_open,
                note=item.note,
            )
            for item in items
        ],
    )


@router.put("/trading-calendar/day", response_model=TradingCalendarDayResponse)
async def upsert_trade_day(payload: TradingCalendarUpsertRequest = Body(...)):
    try:
        parsed = datetime.strptime(payload.trade_date, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="trade_date must be YYYY-MM-DD") from exc

    trading_calendar_service.set_day(
        market=payload.market,
        trade_date=parsed,
        is_open=payload.is_open,
        note=payload.note,
    )
    return TradingCalendarDayResponse(
        success=True,
        item=TradingCalendarDayItem(
            market=payload.market,
            trade_date=payload.trade_date,
            is_open=payload.is_open,
            note=payload.note,
        ),
    )


@router.get("/backtest/{code}", response_model=BacktestResultResponse)
async def get_backtest(
    code: str,
    threshold: float = Query(0.5),
):
    return get_backtest_result(code=code, threshold=threshold)


@router.get("/condition-reference/{code}", response_model=ConditionReferenceResponse)
async def condition_reference(code: str):
    result = get_condition_reference(fund_code=code)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Condition reference not found: {code}")
    return result


@router.get("/score/{market_type}/{code}", response_model=OpportunityScoreResponse)
async def opportunity_score(market_type: str, code: str):
    return get_latest_opportunity_score(code=code, market_type=market_type.upper())


@router.get("/{market_type}/{code}", response_model=OpportunityDetailResponse)
async def get_opportunity(market_type: str, code: str):
    item = opportunity_service.get_opportunity(code=code, market_type=market_type.upper())
    if item is None:
        raise HTTPException(status_code=404, detail=f"Opportunity not found: {market_type}/{code}")
    return item


@router.post("/rebuild-stats", response_model=RebuildStatsResponse)
async def rebuild_stats(
    code: str | None = Query(None),
    market_type: str | None = Query(None),
):
    if code:
        if not market_type:
            raise HTTPException(status_code=400, detail="market_type is required when code is provided")
        result = arbitrage_backfill_service.rebuild_for_fund(code=code, market_type=market_type.upper())
        return RebuildStatsResponse(
            success=True,
            processed=1,
            updated=1 if result["updated"] else 0,
            filled=0,
            code=code,
            market_type=market_type.upper(),
        )

    result = arbitrage_backfill_service.rebuild_all()
    return RebuildStatsResponse(success=True, processed=result["processed"], updated=result["updated"], filled=result["filled"])


@router.post("/backfill-daily", response_model=RebuildStatsResponse)
async def backfill_daily(
    code: str | None = Query(None),
    market_type: str | None = Query(None),
):
    if code:
        if not market_type:
            raise HTTPException(status_code=400, detail="market_type is required when code is provided")
        result = historical_snapshot_service.backfill_for_fund(code=code, market_type=market_type.upper())
        return RebuildStatsResponse(
            success=True,
            processed=1,
            updated=1 if result["updated"] else 0,
            filled=result["filled"],
            code=code,
            market_type=market_type.upper(),
        )

    result = historical_snapshot_service.backfill_all()
    return RebuildStatsResponse(success=True, processed=result["processed"], updated=result["updated"], filled=result["filled"])
