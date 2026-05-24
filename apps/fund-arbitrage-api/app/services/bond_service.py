from __future__ import annotations

from datetime import datetime, timedelta, date
from typing import Any

import akshare as ak
import pandas as pd

from app.infrastructure.utils import safe_float as _safe_float
from app.infrastructure.cache.cache_service import cache_service
from app.models.bond import (
    BondLotteryGroup,
    BondLotteryItem,
    BondLotteryQueryHit,
    BondLotteryQueryResponse,
    BondLotteryResponse,
    BondSubscribeItem,
    BondSubscribeListResponse,
)


CACHE_TTL_SECONDS = 600


def _format_date(value: Any) -> str | None:
    if value is None:
        return None
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.date().strftime("%Y-%m-%d")
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    text = str(value).strip()
    return text or None


def _today_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


import logging

logger = logging.getLogger(__name__)


def _load_ths_bonds() -> pd.DataFrame:
    cached = cache_service.get_json("bond:ths_bonds")
    if cached is not None:
        return pd.DataFrame(cached)

    try:
        df = ak.bond_zh_cov_info_ths()
        cache_service.set_json("bond:ths_bonds", df.to_dict("records"), CACHE_TTL_SECONDS)
        return df
    except Exception as e:
        logger.warning(f"获取同花顺可转债数据失败: {e}")
        return pd.DataFrame()


def _load_cninfo_issues() -> pd.DataFrame:
    cached = cache_service.get_json("bond:cninfo_bonds")
    if cached is not None:
        return pd.DataFrame(cached)

    try:
        df = ak.bond_cov_issue_cninfo(
            start_date=(datetime.now() - timedelta(days=180)).strftime("%Y%m%d"),
            end_date=(datetime.now() + timedelta(days=30)).strftime("%Y%m%d"),
        )
        cache_service.set_json("bond:cninfo_bonds", df.to_dict("records"), CACHE_TTL_SECONDS)
        return df
    except Exception as e:
        logger.warning(f"获取巨潮可转债发行数据失败: {e}")
        return pd.DataFrame()


def _load_cov_comparison() -> pd.DataFrame:
    cached = cache_service.get_json("bond:cov_comparison")
    if cached is not None:
        return pd.DataFrame(cached)

    try:
        df = ak.bond_cov_comparison()
    except Exception:
        df = pd.DataFrame()
    if not df.empty:
        cache_service.set_json("bond:cov_comparison", df.to_dict("records"), CACHE_TTL_SECONDS)
    return df


def _load_cov_spot() -> pd.DataFrame:
    cached = cache_service.get_json("bond:cov_spot")
    if cached is not None:
        return pd.DataFrame(cached)

    try:
        df = ak.bond_zh_hs_cov_spot()
    except Exception:
        df = pd.DataFrame()
    if not df.empty:
        cache_service.set_json("bond:cov_spot", df.to_dict("records"), CACHE_TTL_SECONDS)
    return df


def _load_value_analysis(symbol: str) -> pd.DataFrame:
    cache_key = f"bond:value:{symbol}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return pd.DataFrame(cached)

    try:
        df = ak.bond_zh_cov_value_analysis(symbol=symbol)
    except Exception:
        df = pd.DataFrame()
    if not df.empty:
        cache_service.set_json(cache_key, df.to_dict("records"), CACHE_TTL_SECONDS)
    return df


def _recent_issue_rows() -> pd.DataFrame:
    df = _load_ths_bonds().copy()
    if df.empty:
        return df

    df["申购日期"] = pd.to_datetime(df["申购日期"], errors="coerce")
    df["中签公布日"] = pd.to_datetime(df["中签公布日"], errors="coerce")
    df["上市日期"] = pd.to_datetime(df["上市日期"], errors="coerce")

    min_date = pd.Timestamp(datetime.now().date() - timedelta(days=120))
    filtered = df[(df["申购日期"] >= min_date) | (df["上市日期"].isna())].copy()
    filtered = filtered.sort_values(["申购日期"], ascending=False).head(12)
    return filtered


def _suggestion(convert_value: float | None, premium_rate: float | None, winning_rate: float | None) -> str:
    if convert_value is not None and convert_value >= 100 and (premium_rate is None or premium_rate <= 10):
        return "全力申购"
    if winning_rate is not None and winning_rate < 0.002:
        return "积极申购"
    if premium_rate is not None and premium_rate > 25:
        return "理性申购"
    return "可申购"


def _split_themes(text: str | None) -> list[str]:
    if not text:
        return []
    normalized = (
        str(text)
        .replace("，", ",")
        .replace("；", ",")
        .replace("、", ",")
        .replace("/", ",")
    )
    parts = [part.strip() for part in normalized.split(",") if part.strip()]
    return parts[:12]


def _build_subscribe_item(row: pd.Series, cninfo_map: dict[str, dict], compare_map: dict[str, dict], spot_map: dict[str, dict]) -> BondSubscribeItem:
    code = str(row.get("债券代码", "")).strip()
    ths_rate = _safe_float(row.get("中签率"))
    winning_rate = ths_rate * 100 if ths_rate is not None else None
    cninfo_row = cninfo_map.get(code, {})
    compare_row = compare_map.get(code, {})
    spot_row = spot_map.get(code, {})
    value_df = _load_value_analysis(code)

    latest_value = value_df.iloc[-1] if not value_df.empty else None
    convert_value = _safe_float(compare_row.get("转股价值"))
    if convert_value is None and latest_value is not None:
        convert_value = _safe_float(latest_value["转股价值"])

    premium_rate = _safe_float(compare_row.get("转股溢价率"))
    if premium_rate is None and latest_value is not None:
        premium_rate = _safe_float(latest_value["转股溢价率"])

    reference_price = _safe_float(compare_row.get("转债最新价")) or _safe_float(spot_row.get("trade"))
    reference_price_change = _safe_float(compare_row.get("转债涨跌幅")) or _safe_float(spot_row.get("changepercent"))

    issue_size_value = _safe_float(row.get("实际发行量"))
    issue_size = f"{issue_size_value:.2f}亿" if issue_size_value is not None else "--"

    purchase_limit_value = _safe_float(cninfo_row.get("网上申购数量上限"))
    limit_tag = f"上限{int(purchase_limit_value)}" if purchase_limit_value else None

    circulation_scale = "--"
    if compare_row:
        circulation_scale_value = _safe_float(compare_row.get("纯债价值"))
        if circulation_scale_value is not None:
            circulation_scale = f"{circulation_scale_value:.2f}"

    listing_date = _format_date(row.get("上市日期")) or _format_date(cninfo_row.get("上市日期"))
    paused = bool(row.get("上市日期") is pd.NaT or pd.isna(row.get("上市日期")))

    return BondSubscribeItem(
        code=code,
        name=str(row.get("债券简称", "")).strip(),
        subscribe_date=_format_date(row.get("申购日期")) or _format_date(cninfo_row.get("网上申购日期")),
        pay_date=_format_date(row.get("中签公布日")) or _format_date(cninfo_row.get("网上申购中签结果公告日及退款日")),
        listing_date=listing_date or "待定",
        stock_name=str(row.get("正股简称", "--")).strip(),
        stock_code=str(row.get("正股代码", "--")).strip(),
        convert_value=convert_value,
        premium_rate=premium_rate,
        issue_size=issue_size,
        rating=str(compare_row.get("债券评级", "--")).strip() or "--",
        reference_price=reference_price,
        reference_price_change=reference_price_change,
        circulation_scale=circulation_scale,
        themes=_split_themes(cninfo_row.get("募资用途说明")),
        suggestion=_suggestion(convert_value, premium_rate, ths_rate),
        paused=paused,
        limit_tag=limit_tag,
    )


def get_bond_subscribe_list() -> BondSubscribeListResponse:
    rows = _recent_issue_rows()
    cninfo_df = _load_cninfo_issues()
    compare_df = _load_cov_comparison()
    spot_df = _load_cov_spot()

    cninfo_map = {
        str(row["债券代码"]).strip(): row.to_dict()
        for _, row in cninfo_df.iterrows()
    } if not cninfo_df.empty else {}
    compare_map = {
        str(row["转债代码"]).strip(): row.to_dict()
        for _, row in compare_df.iterrows()
    } if not compare_df.empty else {}
    spot_map = {
        str(row["code"]).strip(): row.to_dict()
        for _, row in spot_df.iterrows()
    } if not spot_df.empty else {}

    items = [_build_subscribe_item(row, cninfo_map, compare_map, spot_map) for _, row in rows.iterrows()]
    return BondSubscribeListResponse(success=True, update_time=_today_str(), items=items)


_DIGIT_LABELS = {
    5: '末"五"位数',
    6: '末"六"位数',
    7: '末"七"位数',
    8: '末"八"位数',
    9: '末"九"位数',
    10: '末"十"位数',
}


def _parse_winning_groups(raw: str | None) -> list[BondLotteryGroup]:
    if not raw:
        return []

    lines = (
        str(raw)
        .replace("\r", "")
        .replace("；\n", "\n")
        .replace("；", "\n")
        .split("\n")
    )

    groups: list[BondLotteryGroup] = []
    for line in lines:
        normalized = line.strip().strip("；")
        if not normalized:
            continue
        suffixes = [item.strip() for item in normalized.replace("、", ",").split(",") if item.strip()]
        if not suffixes:
            continue
        digit_count = len(suffixes[0])
        label = _DIGIT_LABELS.get(digit_count, f"末{digit_count}位数")
        groups.append(BondLotteryGroup(label=label, suffixes=suffixes))
    return groups


def get_bond_lottery_data(code: str | None = None) -> BondLotteryResponse:
    rows = _recent_issue_rows()
    if rows.empty:
        return BondLotteryResponse(
            success=True,
            update_time=_today_str(),
            selected=BondLotteryItem(code="", name="", groups=[]),
            bonds=[],
        )

    bonds: list[BondLotteryItem] = []
    for _, row in rows.iterrows():
        ths_rate = _safe_float(row.get("中签率"))
        bonds.append(
            BondLotteryItem(
                code=str(row.get("债券代码", "")).strip(),
                name=str(row.get("债券简称", "")).strip(),
                winning_rate=ths_rate * 100 if ths_rate is not None else None,
                announce_date=_format_date(row.get("中签公布日")),
                listing_date=_format_date(row.get("上市日期")) or "待定",
                groups=_parse_winning_groups(row.get("中签号")),
            )
        )

    selected = next((item for item in bonds if item.code == code), bonds[0])
    return BondLotteryResponse(
        success=True,
        update_time=_today_str(),
        selected=selected,
        bonds=bonds,
    )


def query_bond_lottery(code: str, allocation_numbers: str) -> BondLotteryQueryResponse:
    lottery = get_bond_lottery_data(code)
    selected = lottery.selected

    parts = [
        ''.join(ch for ch in item if ch.isdigit())
        for item in allocation_numbers.replace("，", ",").replace("；", ",").replace("\n", ",").split(",")
    ]
    numbers = [item for item in parts if item]

    results: list[BondLotteryQueryHit] = []
    for number in numbers:
        hit_labels: list[str] = []
        hit_suffixes: list[str] = []
        for group in selected.groups:
            for suffix in group.suffixes:
                if number.endswith(suffix):
                    hit_labels.append(group.label)
                    hit_suffixes.append(suffix)
        results.append(
            BondLotteryQueryHit(
                allocation_number=number,
                matched=bool(hit_labels),
                hit_labels=hit_labels,
                hit_suffixes=hit_suffixes,
            )
        )

    return BondLotteryQueryResponse(
        success=True,
        code=selected.code,
        name=selected.name,
        update_time=_today_str(),
        results=results,
    )
