from __future__ import annotations

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
    return bond_service.get_bond_subscribe_list()


@router.get("/lottery", response_model=BondLotteryResponse)
async def get_bond_lottery(
    code: str | None = Query(default=None),
):
    return bond_service.get_bond_lottery_data(code=code)


@router.post("/lottery/{code}/query", response_model=BondLotteryQueryResponse)
async def query_bond_lottery(
    code: str,
    payload: BondLotteryQueryRequest,
):
    return bond_service.query_bond_lottery(code=code, allocation_numbers=payload.allocation_numbers)
