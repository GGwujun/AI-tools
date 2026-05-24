from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, Query

from app.models.save import (
    AdvancedSettings,
    BasicSettings,
    BondDetailResponse,
    FavoriteUpdateRequest,
    FavoriteUpdateResponse,
    SaveAiAnalysisResponse,
    SaveCalendarResponse,
    SaveFundDetailResponse,
    SaveFundListResponse,
    SaveFilterOptionsResponse,
    SaveHomeResponse,
    SaveProfileResponse,
    SettingsResponse,
    SaveWatchlistResponse,
    SyncResponse,
)
from app.services import save_service


router = APIRouter(prefix="/api/save", tags=["save-assistant"])


@router.get("/funds", response_model=SaveFundListResponse)
async def get_save_funds(
    tab: str = Query("stock_lof"),
    device_id: str = Query("anonymous"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
):
    return await asyncio.to_thread(save_service.get_fund_list, tab, device_id, page, page_size)


@router.get("/funds/{market_type}/{code}", response_model=SaveFundDetailResponse)
async def get_save_fund_detail(
    market_type: str,
    code: str,
    device_id: str = Query("anonymous"),
):
    detail = await asyncio.to_thread(save_service.get_fund_detail, code, market_type.upper(), device_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Fund not found: {market_type}/{code}")
    return detail


@router.get("/settings", response_model=SettingsResponse)
async def get_save_settings(device_id: str = Query(...)):
    return await asyncio.to_thread(save_service.get_settings, device_id)


@router.put("/settings/basic", response_model=SettingsResponse)
async def update_basic_settings(
    payload: BasicSettings,
    device_id: str = Query(...),
):
    return await asyncio.to_thread(save_service.update_basic_settings, device_id=device_id, payload=payload)


@router.put("/settings/advanced", response_model=SettingsResponse)
async def update_advanced_settings(
    payload: AdvancedSettings,
    device_id: str = Query(...),
):
    return await asyncio.to_thread(save_service.update_advanced_settings, device_id=device_id, payload=payload)


@router.put("/favorites/{market_type}/{code}", response_model=FavoriteUpdateResponse)
async def update_favorite(
    market_type: str,
    code: str,
    payload: FavoriteUpdateRequest,
):
    try:
        return await asyncio.to_thread(
            save_service.update_favorite,
            device_id=payload.device_id,
            code=code,
            market_type=market_type.upper(),
            starred=payload.starred,
        )
    except ValueError as exc:
        if str(exc) == "fund_not_found":
            raise HTTPException(status_code=404, detail=f"Fund not found: {market_type}/{code}") from exc
        raise


@router.get("/status", response_model=SyncResponse)
async def get_sync_status():
    return SyncResponse(success=True, message="ok", sync_status=await asyncio.to_thread(save_service.get_sync_status))


@router.post("/sync", response_model=SyncResponse)
async def trigger_sync():
    from main import _stop_sync_event
    sync_status = await asyncio.to_thread(save_service.refresh_all_data, _stop_sync_event)
    return SyncResponse(success=True, message="sync finished", sync_status=sync_status)


@router.get("/home", response_model=SaveHomeResponse)
async def get_save_home(
    tab: str = Query("stock_lof"),
    device_id: str = Query("anonymous"),
):
    return await asyncio.to_thread(save_service.get_home, tab, device_id)


@router.get("/watchlist", response_model=SaveWatchlistResponse)
async def get_save_watchlist(device_id: str = Query("anonymous")):
    return await asyncio.to_thread(save_service.get_watchlist, device_id)


@router.get("/calendar", response_model=SaveCalendarResponse)
async def get_save_calendar(
    filter: str = Query("all"),
    device_id: str = Query("anonymous"),
):
    return await asyncio.to_thread(save_service.get_calendar, filter, device_id)


@router.get("/profile", response_model=SaveProfileResponse)
async def get_save_profile(device_id: str = Query("anonymous")):
    return await asyncio.to_thread(save_service.get_profile, device_id=device_id)


@router.get("/analysis", response_model=SaveAiAnalysisResponse)
async def get_save_analysis(
    tab: str = Query("opportunity"),
    device_id: str = Query("anonymous"),
):
    return await asyncio.to_thread(save_service.get_analysis, tab, device_id)


@router.get("/filter-options", response_model=SaveFilterOptionsResponse)
async def get_filter_options(device_id: str = Query("anonymous")):
    return await asyncio.to_thread(save_service.get_filter_options, device_id=device_id)


@router.get("/bonds/detail/{code}", response_model=BondDetailResponse)
async def get_bond_detail(code: str):
    return await asyncio.to_thread(save_service.get_bond_detail, code)