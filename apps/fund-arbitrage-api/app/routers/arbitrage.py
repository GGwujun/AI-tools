# -*- coding: utf-8 -*-
"""
套利分析路由
"""
import asyncio
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from sqlalchemy import select

from app.models.fund import (
    FundDetailResponse, FundInfo, FiveLevelData, FiveLevelItem,
    NavHistoryItem, ArbitrageStrategy, FundStats
)
from app.services import fund_service, arbitrage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/arbitrage", tags=["套利分析"])


@router.get("/detail/{code}", response_model=FundDetailResponse)
async def get_fund_detail(
    code: str,
    type: str = Query("LOF", description="基金类型: LOF 或 ETF")
):
    """
    获取基金完整详情

    Args:
        code: 基金代码
        type: 基金类型 (LOF/ETF)

    Returns:
        FundDetailResponse: 基金完整详情
    """
    try:
        return await asyncio.to_thread(_get_fund_detail_sync, code, type)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"原始异常: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="内部服务错误")


def _get_fund_detail_sync(code: str, type: str) -> FundDetailResponse:
    """同步获取基金完整详情（在子线程中执行）。"""
    # 获取基础信息
    realtime_data = fund_service.get_fund_realtime_data(code, type)

    if not realtime_data:
        raise HTTPException(status_code=404, detail=f"未找到基金: {code}")

    # 获取基本信息
    fund_state, fund_type = fund_service.parse_fund_state(code)
    if not fund_type:
        fund_type = type

    fund_info = FundInfo(
        code=code,
        name=realtime_data.get('name', ''),
        market='',
        market_price=realtime_data.get('market_price'),
        market_time=datetime.now().strftime('%H:%M:%S'),
        nav_price=realtime_data.get('nav_price'),
        nav_date=realtime_data.get('nav_date'),
        fund_state=fund_state,
        fund_type=fund_type,
        is_no_gap=False,
        premium_rate=realtime_data.get('premium_rate')
    )

    # 获取五档数据
    five_level_raw = arbitrage_service.get_five_level_data(code)
    five_level = FiveLevelData(
        update_time=five_level_raw['update_time'],
        bid=[FiveLevelItem(**item) for item in five_level_raw['bid']],
        ask=[FiveLevelItem(**item) for item in five_level_raw['ask']]
    )

    # 获取净值历史
    nav_history_raw = arbitrage_service.get_nav_history(code, type)
    nav_history = [
        NavHistoryItem(
            date=item['date'],
            nav=item['nav'],
            nav_change=item['nav_change'],
            a_share_close=item['a_share_close'],
            premium=item['premium'],
            error_rate=item['error_rate'],
            profit=item['profit']
        )
        for item in nav_history_raw
    ]

    # 获取套利策略
    strategies_raw = arbitrage_service.get_arbitrage_strategies(code, type)
    strategies = [ArbitrageStrategy(**item) for item in strategies_raw]

    # 获取规模和成交量
    scale, turnover = arbitrage_service.get_fund_scale_turnover(code)

    # 统计信息 — 从 FundArbitrageStat DB 读取
    from app.infrastructure.db.session import session_scope
    from app.db_models import FundArbitrageStat
    with session_scope() as db_session:
        stat1 = db_session.execute(
            select(FundArbitrageStat).where(
                FundArbitrageStat.fund_code == code,
                FundArbitrageStat.threshold_type == "premium_rate",
                FundArbitrageStat.threshold_value == 0.5,
            )
        ).scalar_one_or_none()
        stat2 = db_session.execute(
            select(FundArbitrageStat).where(
                FundArbitrageStat.fund_code == code,
                FundArbitrageStat.threshold_type == "premium_rate",
                FundArbitrageStat.threshold_value == 1.0,
            )
        ).scalar_one_or_none()

    stats = FundStats(
        threshold1={
            'minPremium': '>0.5%',
            'position': '1/2仓',
            'startDate': '',
            'count': stat1.trigger_count if stat1 else 0,
            'successRate': f"{stat1.success_rate * 100:.2f}%" if stat1 and stat1.success_rate else '--',
            'totalProfit': f"{stat1.avg_return_rate * 100:.2f}%" if stat1 and stat1.avg_return_rate else '--',
            'prob': f"{stat1.occurrence_probability * 100:.2f}%" if stat1 and stat1.occurrence_probability else '--',
        },
        threshold2={
            'minPremium': '>1%',
            'position': '1/2仓',
            'startDate': '',
            'count': stat2.trigger_count if stat2 else 0,
            'successRate': f"{stat2.success_rate * 100:.2f}%" if stat2 and stat2.success_rate else '--',
            'totalProfit': f"{stat2.avg_return_rate * 100:.2f}%" if stat2 and stat2.avg_return_rate else '--',
            'prob': f"{stat2.occurrence_probability * 100:.2f}%" if stat2 and stat2.occurrence_probability else '--',
        }
    )

    return FundDetailResponse(
        success=True,
        fund=fund_info,
        five_level=five_level,
        nav_history=nav_history,
        arbitrage_strategies=strategies,
        stats=stats,
        scale=scale,
        turnover=turnover,
        update_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    )


@router.get("/strategies/{code}")
async def get_strategies(
    code: str,
    type: str = Query("LOF", description="基金类型: LOF 或 ETF")
):
    """
    获取基金套利策略

    Args:
        code: 基金代码
        type: 基金类型

    Returns:
        dict: 套利策略列表
    """
    try:
        strategies = await asyncio.to_thread(arbitrage_service.get_arbitrage_strategies, code, type)
        return {
            'success': True,
            'data': strategies,
            'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
    except Exception as e:
        logger.error(f"原始异常: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="内部服务错误")


@router.get("/five-level/{code}")
async def get_five_level(
    code: str
):
    """
    获取五档数据

    Args:
        code: 基金代码

    Returns:
        FiveLevelData: 五档数据
    """
    try:
        data = await asyncio.to_thread(arbitrage_service.get_five_level_data, code)
        return FiveLevelData(
            update_time=data['update_time'],
            bid=[FiveLevelItem(**item) for item in data['bid']],
            ask=[FiveLevelItem(**item) for item in data['ask']]
        )
    except Exception as e:
        logger.error(f"原始异常: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="内部服务错误")
