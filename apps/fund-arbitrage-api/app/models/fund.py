# -*- coding: utf-8 -*-
"""
基金数据模型
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class FundBase(BaseModel):
    """基金基础信息"""
    code: str
    name: str
    market: str = ""  # sz/sh


class FundMarketData(FundBase):
    """基金场内数据"""
    market_price: Optional[float] = None  # 场内价格
    market_time: Optional[str] = None  # 场内价格时间
    nav_price: Optional[float] = None  # 场外净值
    nav_date: Optional[str] = None  # 净值日期
    premium_rate: Optional[float] = None  # 溢价率


class FundInfo(FundMarketData):
    """基金完整信息"""
    fund_state: str = ""  # 交易状态
    fund_type: str = ""  # 基金类型
    is_no_gap: bool = False  # 是否无时差ETF


class LOFFundListResponse(BaseModel):
    """LOF基金列表响应"""
    success: bool
    data: List[FundInfo]
    update_time: str
    total: int


class ETFFundListResponse(BaseModel):
    """ETF基金列表响应"""
    success: bool
    data: List[FundInfo]
    update_time: str
    total: int


class FiveLevelItem(BaseModel):
    """五档数据项"""
    price: float
    volume: str  # 成交量
    premium: str  # 溢价率


class FiveLevelData(BaseModel):
    """五档数据"""
    update_time: str
    bid: List[FiveLevelItem]  # 买五档
    ask: List[FiveLevelItem]  # 卖五档


class NavHistoryItem(BaseModel):
    """净值历史项"""
    date: str
    nav: float
    nav_change: str
    a_share_close: str
    premium: str
    error_rate: str
    profit: str


class ArbitrageStrategy(BaseModel):
    """套利策略"""
    title: str
    strategy: str
    success_rate: str
    occurrence_count: str
    total_return: str
    probability: str
    start_time: str


class FundStats(BaseModel):
    """基金统计"""
    threshold1: dict
    threshold2: dict


class FundDetailResponse(BaseModel):
    """基金详情响应"""
    success: bool
    fund: FundInfo
    five_level: FiveLevelData
    nav_history: List[NavHistoryItem]
    arbitrage_strategies: List[ArbitrageStrategy]
    stats: FundStats
    scale: str
    turnover: str
    update_time: str


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    timestamp: str
