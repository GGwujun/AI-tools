from __future__ import annotations

import asyncio

from fastapi import APIRouter, Query

from app.models.bond import (
    BondLotteryQueryRequest,
    BondLotteryQueryResponse,
    BondLotteryResponse,
    BondSubscribeListResponse,
)
from app.services import bond_service


router = APIRouter(prefix="/api/save/bonds", tags=["save-bonds"])


@router.get("/subscribe", response_model=BondSubscribeListResponse)
async def get_bond_subscribe_list():
    return await asyncio.to_thread(bond_service.get_bond_subscribe_list)


@router.get("/lottery", response_model=BondLotteryResponse)
async def get_bond_lottery(
    code: str | None = Query(default=None),
):
    return await asyncio.to_thread(bond_service.get_bond_lottery_data, code)


@router.post("/lottery/{code}/query", response_model=BondLotteryQueryResponse)
async def query_bond_lottery(
    code: str,
    payload: BondLotteryQueryRequest,
):
    return await asyncio.to_thread(bond_service.query_bond_lottery, code, payload.allocation_numbers)
