# -*- coding: utf-8 -*-
"""
LOF基金路由
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import List

from app.models.fund import LOFFundListResponse, FundInfo
from app.services import fund_service

router = APIRouter(prefix="/api/lof", tags=["LOF基金"])


@router.get("/list", response_model=LOFFundListResponse)
async def get_lof_list():
    """
    获取LOF基金列表及实时数据

    Returns:
        LOFFundListResponse: LOF基金列表响应
    """
    try:
        data = fund_service.get_all_lof_data()

        fund_list = [
            FundInfo(
                code=item['code'],
                name=item['name'],
                market=item['market'],
                market_price=item['market_price'],
                market_time=item['market_time'],
                nav_price=item['nav_price'],
                nav_date=item['nav_date'],
                fund_state=item['fund_state'],
                fund_type=item['fund_type'],
                is_no_gap=item['is_no_gap'],
                premium_rate=item['premium_rate']
            )
            for item in data
        ]

        return LOFFundListResponse(
            success=True,
            data=fund_list,
            update_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            total=len(fund_list)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取LOF基金列表失败: {str(e)}")


@router.get("/detail/{code}", response_model=FundInfo)
async def get_lof_detail(code: str):
    """
    获取单个LOF基金详情

    Args:
        code: 基金代码

    Returns:
        FundInfo: 基金详细信息
    """
    try:
        data = fund_service.get_all_lof_data()
        fund_data = next((item for item in data if item['code'] == code), None)

        if not fund_data:
            raise HTTPException(status_code=404, detail=f"未找到基金: {code}")

        return FundInfo(
            code=fund_data['code'],
            name=fund_data['name'],
            market=fund_data['market'],
            market_price=fund_data['market_price'],
            market_time=fund_data['market_time'],
            nav_price=fund_data['nav_price'],
            nav_date=fund_data['nav_date'],
            fund_state=fund_data['fund_state'],
            fund_type=fund_data['fund_type'],
            is_no_gap=fund_data['is_no_gap'],
            premium_rate=fund_data['premium_rate']
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取基金详情失败: {str(e)}")
