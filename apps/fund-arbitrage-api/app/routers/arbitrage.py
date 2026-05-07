# -*- coding: utf-8 -*-
"""
套利分析路由
"""
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from typing import Optional

from app.models.fund import (
    FundDetailResponse, FundInfo, FiveLevelData, FiveLevelItem,
    NavHistoryItem, ArbitrageStrategy, FundStats
)
from app.services import fund_service, arbitrage_service

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

        # 统计信息
        stats = FundStats(
            threshold1={
                'minPremium': '>0.5%',
                'position': '1/2仓',
                'startDate': '23年7月19日',
                'count': 152,
                'successRate': '90.13%',
                'totalProfit': '76.75%',
                'prob': '23.03%'
            },
            threshold2={
                'minPremium': '>1%',
                'position': '1/2仓',
                'startDate': '',
                'count': 126,
                'successRate': '93.65%',
                'totalProfit': '74.81%',
                'prob': '19.09%'
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

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取基金详情失败: {str(e)}")


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
        strategies = arbitrage_service.get_arbitrage_strategies(code, type)
        return {
            'success': True,
            'data': strategies,
            'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取套利策略失败: {str(e)}")


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
        data = arbitrage_service.get_five_level_data(code)
        return FiveLevelData(
            update_time=data['update_time'],
            bid=[FiveLevelItem(**item) for item in data['bid']],
            ask=[FiveLevelItem(**item) for item in data['ask']]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取五档数据失败: {str(e)}")
