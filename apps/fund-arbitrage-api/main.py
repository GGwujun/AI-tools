from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, time
from zoneinfo import ZoneInfo

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import (
    API_HOST,
    API_PORT,
    CLOSED_MARKET_SYNC_INTERVAL_SECONDS,
    CORS_ORIGINS,
    DEBUG,
    EMBEDDED_SYNC_ENABLED,
    MARKET_CLOSE_BURST_SYNC_INTERVAL_SECONDS,
    MARKET_OPEN_BURST_SYNC_INTERVAL_SECONDS,
    OPEN_MARKET_SYNC_INTERVAL_SECONDS,
    SYNC_ON_STARTUP,
)
from app.database import engine, init_database
from app.models.fund import HealthResponse
from app.application.trading_calendar_service import trading_calendar_service
from app.routers import arbitrage, auth, bond, etf, lof, notification, opportunities, save, system
from app.services import save_service


CN_TZ = ZoneInfo("Asia/Shanghai")
AM_SESSION = (time(9, 30), time(11, 30))
PM_SESSION = (time(13, 0), time(15, 0))
AM_BURST_SESSION = (time(9, 30), time(10, 30))
PM_BURST_SESSION = (time(14, 30), time(15, 0))


def _is_cn_market_open(now: datetime | None = None) -> bool:
    current = now.astimezone(CN_TZ) if now is not None else datetime.now(CN_TZ)
    trade_date = current.date()
    if not trading_calendar_service.get_day(market="CN", trade_date=trade_date):
        if current.weekday() >= 5:
            return False
    else:
        override = trading_calendar_service.get_day(market="CN", trade_date=trade_date)
        if override is not None and not override.is_open:
            return False

    if current.weekday() >= 5:
        return False

    current_time = current.time()
    in_am_session = AM_SESSION[0] <= current_time <= AM_SESSION[1]
    in_pm_session = PM_SESSION[0] <= current_time <= PM_SESSION[1]
    return in_am_session or in_pm_session


def _current_sync_interval_seconds() -> int:
    current = datetime.now(CN_TZ)
    if not _is_cn_market_open(current):
        return CLOSED_MARKET_SYNC_INTERVAL_SECONDS

    current_time = current.time()
    if AM_BURST_SESSION[0] <= current_time <= AM_BURST_SESSION[1]:
        return MARKET_OPEN_BURST_SYNC_INTERVAL_SECONDS
    if PM_BURST_SESSION[0] <= current_time <= PM_BURST_SESSION[1]:
        return MARKET_CLOSE_BURST_SYNC_INTERVAL_SECONDS
    return OPEN_MARKET_SYNC_INTERVAL_SECONDS


import threading

_stop_sync_event = threading.Event()


async def _background_sync_loop(stop_event: asyncio.Event) -> None:
    if SYNC_ON_STARTUP:
        await asyncio.to_thread(save_service.refresh_all_data, _stop_sync_event)

    while not stop_event.is_set():
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=_current_sync_interval_seconds())
            break
        except asyncio.TimeoutError:
            await asyncio.to_thread(save_service.refresh_all_data, _stop_sync_event)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    stop_event = asyncio.Event()
    sync_task = asyncio.create_task(_background_sync_loop(stop_event)) if EMBEDDED_SYNC_ENABLED else None
    try:
        yield
    finally:
        _stop_sync_event.set()
        stop_event.set()
        if sync_task is not None:
            sync_task.cancel()
            try:
                await sync_task
            except asyncio.CancelledError:
                pass
        engine.dispose()


app = FastAPI(
    title="Fund Assistant API",
    description="Provides monitored fund data, persistence, and H5-facing save assistant endpoints.",
    version="2.0.0",
    lifespan=lifespan,
)


@app.exception_handler(Exception)
async def _global_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    import logging
    logging.getLogger(__name__).error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(lof.router)
app.include_router(etf.router)
app.include_router(arbitrage.router)
app.include_router(auth.router)
app.include_router(save.router)
app.include_router(bond.router)
app.include_router(opportunities.router)
app.include_router(notification.router)
app.include_router(system.router)


@app.get("/", tags=["root"])
async def root():
    return {
        "name": "Fund Assistant API",
        "version": "2.0.0",
        "docs": "/docs",
        "save_assistant": {
            "fund_list": "/api/save/funds?tab=stock_lof&device_id=demo",
            "fund_detail": "/api/save/funds/LOF/163406?device_id=demo",
            "settings": "/api/save/settings?device_id=demo",
            "manual_sync": "/api/save/sync",
        },
    }


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    return HealthResponse(status="healthy", timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))


if __name__ == "__main__":
    import signal
    import uvicorn

    # Ctrl+C 立即退出，不等待后台线程
    signal.signal(signal.SIGINT, lambda *_: __import__("os")._exit(0))

    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=DEBUG)
