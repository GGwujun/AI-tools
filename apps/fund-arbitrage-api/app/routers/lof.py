"""LOF基金路由 — 从 FundSnapshot DB 读取数据（由 sync cycle 维护）。"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.infrastructure.db.session import session_scope
from app.db_models import FundSnapshot
from app.models.fund import FundInfo, LOFFundListResponse


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/lof", tags=["LOF基金"])


@router.get("/list", response_model=LOFFundListResponse)
async def get_lof_list():
    """获取LOF基金列表及实时数据（从DB读取，由sync cycle维护）。"""
    try:
        return await asyncio.to_thread(_get_lof_list_sync)
    except Exception as e:
        logger.error(f"原始异常: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="内部服务错误")


def _get_lof_list_sync() -> LOFFundListResponse:
    """同步获取LOF基金列表（在子线程中执行）。"""
    with session_scope() as session:
        rows = session.execute(
            select(FundSnapshot).where(FundSnapshot.market_type == "LOF")
        ).scalars().all()

    fund_list = [
        FundInfo(
            code=r.code,
            name=r.name or "",
            market=r.tab_tags[0] if r.tab_tags else "",
            market_price=r.market_price,
            market_time=r.detail_payload.get("market_time") if r.detail_payload else None,
            nav_price=r.nav_price,
            nav_date=r.detail_payload.get("nav_date") if r.detail_payload else None,
            premium_rate=r.premium_rate,
            fund_state=r.fund_state or "",
            fund_type=r.detail_payload.get("fund_type", "") if r.detail_payload else "",
            is_no_gap=r.detail_payload.get("is_no_gap", False) if r.detail_payload else False,
        )
        for r in rows
        if r.code and r.name
    ]

    return LOFFundListResponse(
        success=True,
        data=fund_list,
        update_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        total=len(fund_list),
    )


@router.get("/detail/{code}", response_model=FundInfo)
async def get_lof_detail(code: str):
    """获取单个LOF基金详情。"""
    try:
        return await asyncio.to_thread(_get_lof_detail_sync, code)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"原始异常: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="内部服务错误")


def _get_lof_detail_sync(code: str) -> FundInfo:
    """同步获取单个LOF基金详情（在子线程中执行）。"""
    with session_scope() as session:
        row = session.execute(
            select(FundSnapshot).where(
                FundSnapshot.market_type == "LOF",
                FundSnapshot.code == code,
            )
        ).scalar_one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail=f"未找到基金: {code}")

    return FundInfo(
        code=row.code,
        name=row.name or "",
        market=row.tab_tags[0] if row.tab_tags else "",
        market_price=row.market_price,
        market_time=row.detail_payload.get("market_time") if row.detail_payload else None,
        nav_price=row.nav_price,
        nav_date=row.detail_payload.get("nav_date") if row.detail_payload else None,
        premium_rate=row.premium_rate,
        fund_state=row.fund_state or "",
        fund_type=row.detail_payload.get("fund_type", "") if row.detail_payload else "",
        is_no_gap=row.detail_payload.get("is_no_gap", False) if row.detail_payload else False,
    )