# -*- coding: utf-8 -*-
"""
基金数据服务
"""
from __future__ import annotations

from datetime import datetime
from functools import lru_cache
import re
from typing import List, Optional, Tuple

import concurrent.futures
import logging

import akshare as ak
import pandas as pd
import requests
from bs4 import BeautifulSoup

from app.config import NO_GAP_KEYWORDS

logger = logging.getLogger(__name__)


DATE_FORMAT_CANDIDATES = (
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y%m%d",
    "%m-%d",
    "%m/%d",
)


def _normalize_date_value(value: object) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "strftime"):
        try:
            return value.strftime("%Y-%m-%d")
        except Exception:
            pass

    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None

    for fmt in DATE_FORMAT_CANDIDATES:
        try:
            parsed = datetime.strptime(text, fmt)
            if fmt in {"%m-%d", "%m/%d"}:
                parsed = parsed.replace(year=datetime.now().year)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue

    parsed = pd.to_datetime(text, errors="coerce", format="mixed")
    if pd.isna(parsed):
        return None
    return parsed.strftime("%Y-%m-%d")


def _safe_float(value: object) -> Optional[float]:
    try:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return None
        text = str(value).strip()
        if not text or text.lower() == "nan":
            return None
        return float(text)
    except (TypeError, ValueError):
        return None


def _first_float(row: pd.Series, *keys: str) -> Optional[float]:
    for key in keys:
        if key in row.index:
            value = _safe_float(row[key])
            if value is not None:
                return value
    return None


def _normalize_market_code(code_with_prefix: str) -> tuple[str, str]:
    if code_with_prefix.startswith("sz"):
        return "sz", code_with_prefix[2:]
    if code_with_prefix.startswith("sh"):
        return "sh", code_with_prefix[2:]
    return "", code_with_prefix


@lru_cache(maxsize=1)
def _estimated_nav_frame() -> pd.DataFrame:
    try:
        return ak.fund_value_estimation_em(symbol="全部")
    except Exception as e:
        print(f"获取基金净值估算失败: {e}")
        return pd.DataFrame()


@lru_cache(maxsize=1)
def _etf_spot_frame() -> pd.DataFrame:
    try:
        return ak.fund_etf_spot_em()
    except Exception as e:
        print(f"获取ETF实时估值失败: {e}")
        return pd.DataFrame()


@lru_cache(maxsize=1)
def _fund_fee_frame() -> pd.DataFrame:
    try:
        return ak.fund_open_fund_rank_em(symbol="全部")
    except Exception as e:
        print(f"获取基金费率信息失败: {e}")
        return pd.DataFrame()


@lru_cache(maxsize=512)
def get_fund_page_profile(code: str) -> dict:
    result = {
        "fund_company": "",
        "underlying_index_code": "",
        "fee_text": "",
    }
    try:
        response = requests.get(f"https://fund.eastmoney.com/{code}.html", timeout=10)
        response.encoding = response.apparent_encoding
        if response.status_code != 200:
            return result

        soup = BeautifulSoup(response.text, "html.parser")
        text = soup.get_text(" ", strip=True)

        company_patterns = [
            r"基金管理人[:：]\s*([^\s|]+)",
            r"管理人[:：]\s*([^\s|]+)",
        ]
        for pattern in company_patterns:
            matched = re.search(pattern, text)
            if matched:
                result["fund_company"] = matched.group(1).strip()
                break

        index_patterns = [
            r"跟踪标的[:：]\s*([A-Za-z0-9._-]+)",
            r"标的指数[:：]\s*([A-Za-z0-9._-]+)",
            r"跟踪指数[:：]\s*([A-Za-z0-9._-]+)",
        ]
        for pattern in index_patterns:
            matched = re.search(pattern, text)
            if matched:
                result["underlying_index_code"] = matched.group(1).strip()
                break

        fee_patterns = [
            r"申购费率[:：]\s*([^\s|]+)",
            r"手续费[:：]\s*([^\s|]+)",
        ]
        for pattern in fee_patterns:
            matched = re.search(pattern, text)
            if matched:
                result["fee_text"] = matched.group(1).strip()
                break
    except Exception:
        return result
    return result


def get_etf_fund_list_with_price() -> pd.DataFrame:
    try:
        raw_df = ak.fund_etf_category_sina(symbol="ETF基金")
        result = []
        for _, row in raw_df.iterrows():
            market, code = _normalize_market_code(str(row["代码"]))
            market_price = _safe_float(row["最新价"]) if "最新价" in row.index else None
            market_change_pct = _first_float(row, "涨跌幅", "涨跌")
            fund_name = str(row["名称"]).strip()
            is_no_gap = any(keyword in fund_name for keyword in NO_GAP_KEYWORDS)
            result.append(
                {
                    "market": market,
                    "code": code,
                    "name": fund_name,
                    "market_price": market_price,
                    "market_change_pct": market_change_pct,
                    "is_no_gap": is_no_gap,
                }
            )
        return pd.DataFrame(result)
    except Exception as e:
        print(f"获取ETF基金列表失败: {e}")
        return pd.DataFrame(columns=["market", "code", "name", "market_price", "market_change_pct", "is_no_gap"])


def get_lof_fund_list_with_price() -> pd.DataFrame:
    try:
        raw_df = ak.fund_etf_category_sina(symbol="LOF基金")
        result = []
        for _, row in raw_df.iterrows():
            market, code = _normalize_market_code(str(row["代码"]))
            market_price = _safe_float(row["最新价"]) if "最新价" in row.index else None
            market_change_pct = _first_float(row, "涨跌幅", "涨跌")
            result.append(
                {
                    "market": market,
                    "code": code,
                    "name": str(row["名称"]).strip(),
                    "market_price": market_price,
                    "market_change_pct": market_change_pct,
                }
            )
        return pd.DataFrame(result)
    except Exception as e:
        print(f"获取LOF基金列表失败: {e}")
        return pd.DataFrame(columns=["market", "code", "name", "market_price", "market_change_pct"])


# ── 批量行情接口（东方财富 push2delay）──

_EASTMONEY_PUSH_URL = "https://push2delay.eastmoney.com/api/qt/clist/get"
_EASTMONEY_PUSH_FIELDS = "f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f128,f136,f115,f152"
_EASTMONEY_COLUMN_MAP = {
    "f12": "code", "f14": "name", "f2": "market_price",
    "f4": "change_amount", "f3": "market_change_pct",
    "f5": "volume", "f6": "amount", "f7": "amplitude",
    "f17": "open_price", "f15": "high_price", "f16": "low_price",
    "f18": "prev_close", "f20": "total_market_cap",
}
_EASTMONEY_NUMERIC_COLS = [
    "market_price", "change_amount", "market_change_pct",
    "volume", "amount", "amplitude", "open_price",
    "high_price", "low_price", "prev_close", "total_market_cap",
]

_MARKET_CODE_MAP = {0: "sz", 1: "sh"}

_LOF_FS = "b:MK0404,b:MK0405,b:MK0406,b:MK0407"
_ETF_FS = "b:MK0021,b:MK0022,b:MK0023,b:MK0025"


def _fetch_eastmoney_bulk(fs: str, fallback_fn) -> pd.DataFrame:
    """从东方财富 push2delay API 批量获取基金行情，失败时回退到旧接口。"""
    try:
        base_params = {
            "pn": "1", "pz": "200", "po": "1", "np": "1",
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
            "fltt": "2", "invt": "2",
            "wbp2u": "|0|0|0|web",
            "fid": "f3",
            "fs": fs,
            "fields": _EASTMONEY_PUSH_FIELDS,
        }

        # 第一页
        r = requests.get(_EASTMONEY_PUSH_URL, params=base_params, timeout=30)
        r.raise_for_status()
        data_json = r.json()
        if not data_json.get("data") or not data_json["data"].get("diff"):
            logger.warning("东方财富批量接口返回空数据，回退到旧接口")
            return fallback_fn()

        per_page = len(data_json["data"]["diff"])
        total = data_json["data"]["total"]
        total_page = (total + per_page - 1) // per_page

        pages = [pd.DataFrame(data_json["data"]["diff"])]

        # 剩余页
        for page in range(2, total_page + 1):
            params = base_params.copy()
            params["pn"] = str(page)
            r = requests.get(_EASTMONEY_PUSH_URL, params=params, timeout=30)
            r.raise_for_status()
            page_json = r.json()
            if page_json.get("data") and page_json["data"].get("diff"):
                pages.append(pd.DataFrame(page_json["data"]["diff"]))

        df = pd.concat(pages, ignore_index=True)
        df.rename(columns=_EASTMONEY_COLUMN_MAP, inplace=True)

        # 市场 prefix
        if "f13" in df.columns:
            df["market"] = df["f13"].map(_MARKET_CODE_MAP).fillna("")

        # 数值转换
        for col in _EASTMONEY_NUMERIC_COLS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # ETF 无时差标记
        if fs == _ETF_FS and "name" in df.columns:
            df["is_no_gap"] = df["name"].apply(
                lambda n: any(keyword in str(n) for keyword in NO_GAP_KEYWORDS)
            )
        else:
            df["is_no_gap"] = False

        # 保留需要的列
        keep_cols = [
            "market", "code", "name", "market_price", "market_change_pct",
            "volume", "amount", "open_price", "high_price", "low_price",
            "prev_close", "total_market_cap",
        ]
        if fs == _ETF_FS:
            keep_cols.append("is_no_gap")
        existing = [c for c in keep_cols if c in df.columns]
        return df[existing]

    except Exception as e:
        logger.warning(f"东方财富批量接口失败(fs={fs}): {e}, 回退到旧接口")
        return fallback_fn()


@lru_cache(maxsize=1)
def get_lof_fund_list_bulk() -> pd.DataFrame:
    """批量获取 LOF 实时行情（东方财富 push2delay），失败回退到 Sina。"""
    return _fetch_eastmoney_bulk(_LOF_FS, get_lof_fund_list_with_price)


@lru_cache(maxsize=1)
def get_etf_fund_list_bulk() -> pd.DataFrame:
    """批量获取 ETF 实时行情（东方财富 push2delay），失败回退到 Sina。"""
    return _fetch_eastmoney_bulk(_ETF_FS, get_etf_fund_list_with_price)


# ── 申购限额批量接口 ──

def format_limit(value) -> str:
    """格式化日申购限额金额为显示字符串。"""
    if value is None:
        return "--"
    if isinstance(value, float) and pd.isna(value):
        return "--"
    if value == 0:
        return "--"
    if value >= 1e8:
        return "不限"
    if value < 10000:
        return f"{value:.0f}元/日"
    return f"{value / 10000:.0f}万/日"


@lru_cache(maxsize=1)
def get_purchase_limit_data() -> pd.DataFrame:
    """批量获取基金净值 + 申购限额 + 申购状态（ak.fund_purchase_em）。"""
    try:
        df = ak.fund_purchase_em()
        result = df[["基金代码", "最新净值/万份收益", "日累计限定金额", "申购状态"]].copy()
        result.rename(columns={
            "基金代码": "code",
            "最新净值/万份收益": "nav_from_purchase",
            "日累计限定金额": "purchase_limit_amount",
            "申购状态": "purchase_status",
        }, inplace=True)
        result["code"] = result["code"].astype(str).str.strip()
        result["nav_from_purchase"] = pd.to_numeric(result["nav_from_purchase"], errors="coerce")
        result["purchase_limit_amount"] = pd.to_numeric(result["purchase_limit_amount"], errors="coerce")
        return result
    except Exception as e:
        logger.warning(f"获取基金申购限额数据失败: {e}")
        return pd.DataFrame(columns=["code", "nav_from_purchase", "purchase_limit_amount", "purchase_status"])


def get_etf_nav_price(code: str) -> Tuple[Optional[float], Optional[str]]:
    try:
        today = datetime.now().strftime("%Y%m%d")
        start = datetime.now().replace(month=1, day=1).strftime("%Y%m%d")
        df = ak.fund_etf_fund_info_em(fund=code, start_date=start, end_date=today)
        if df is not None and not df.empty:
            latest_row = df.iloc[-1]
            nav_date_str = _normalize_date_value(latest_row.iloc[0])
            nav_val = latest_row.iloc[1]
            return float(nav_val), nav_date_str
        return None, None
    except Exception:
        return None, None


def get_lof_nav_price(code: str) -> Tuple[Optional[float], Optional[str]]:
    try:
        today = datetime.now().strftime("%Y%m%d")
        start = datetime.now().replace(month=1, day=1).strftime("%Y%m%d")
        df = ak.fund_etf_fund_info_em(fund=code, start_date=start, end_date=today)
        if df is None or df.empty:
            df = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
        if df is not None and not df.empty:
            nav_date_str = _normalize_date_value(df.iloc[-1, 0])
            nav_val = df.iloc[-1, 1]
            return float(nav_val), nav_date_str
        return None, None
    except Exception:
        return None, None


def parse_fund_state(code: str) -> Tuple[str, str]:
    url = f"https://fund.eastmoney.com/{code}.html"
    fund_state = ""
    fund_type = ""
    try:
        response = requests.get(url, timeout=10)
        response.encoding = response.apparent_encoding
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            items = soup.find_all("div", class_="staticItem")
            for item in items:
                text = item.get_text(strip=True)
                if "交易状态" in text and not fund_state:
                    clean_text = text.replace("\xa0", " ")
                    fund_state = clean_text.replace("交易状态：", "")

            for div in soup.find_all("div"):
                text = div.get_text(strip=True)
                if any(keyword in text for keyword in ("类型：混合型", "类型：股票型", "类型：债券型", "类型：指数型")):
                    if "类型：" in text and not fund_type:
                        fund_type = text.split("类型：")[-1].split("|")[0].strip()
    except Exception:
        pass
    return fund_state, fund_type


def get_estimated_nav_info(code: str) -> Tuple[Optional[float], Optional[str], Optional[float], str]:
    df = _estimated_nav_frame()
    if df is None or df.empty:
        return None, None, None, "unavailable"

    code_columns = [col for col in df.columns if "代码" in str(col)]
    target = None
    for col in code_columns or ["基金代码"]:
        if col in df.columns:
            matched = df[df[col].astype(str).str.strip() == code]
            if not matched.empty:
                target = matched.iloc[0]
                break
    if target is None:
        return None, None, None, "missing"

    nav_value = _first_float(target, "估算值", "估算净值", "最新估值")
    nav_change = _first_float(target, "估算增长率", "估算涨跌幅", "日增长率")
    nav_time = None
    for key in ("更新时间", "估值时间", "时间"):
        if key in target.index and str(target[key]).strip():
            nav_time = str(target[key]).strip()
            break
    return nav_value, nav_time, nav_change, "eastmoney_estimate"


def get_etf_iopv_info(code: str) -> Tuple[Optional[float], Optional[str], Optional[float], str]:
    df = _etf_spot_frame()
    if df is None or df.empty:
        return None, None, None, "unavailable"

    code_col = "代码" if "代码" in df.columns else None
    if code_col is None:
        return None, None, None, "schema_missing"

    matched = df[df[code_col].astype(str).str.strip() == code]
    if matched.empty:
        return None, None, None, "missing"

    row = matched.iloc[0]
    nav_value = _first_float(row, "IOPV实时估值", "IOPV", "实时估值")
    nav_change = _first_float(row, "IOPV涨跌幅", "涨跌幅", "涨跌")
    nav_time = None
    for key in ("数据日期", "更新时间", "时间"):
        if key in row.index and str(row[key]).strip():
            nav_time = str(row[key]).strip()
            break
    return nav_value, nav_time, nav_change, "eastmoney_iopv"


def get_fund_fee_info(code: str) -> dict:
    page_profile = get_fund_page_profile(code)
    df = _fund_fee_frame()
    if df is None or df.empty:
      return {"fee_text": page_profile.get("fee_text", ""), "source": "page_profile_only" if page_profile.get("fee_text") else "unavailable"}

    code_col = None
    for candidate in ("基金代码", "代码"):
        if candidate in df.columns:
            code_col = candidate
            break
    if code_col is None:
        return {"fee_text": page_profile.get("fee_text", ""), "source": "page_profile_only" if page_profile.get("fee_text") else "schema_missing"}

    matched = df[df[code_col].astype(str).str.strip() == code]
    if matched.empty:
        return {"fee_text": page_profile.get("fee_text", ""), "source": "page_profile_only" if page_profile.get("fee_text") else "missing"}

    row = matched.iloc[0]
    fee_text = ""
    for key in ("手续费", "费率", "申购费率"):
        if key in row.index and str(row[key]).strip() and str(row[key]).strip().lower() != "nan":
            fee_text = str(row[key]).strip()
            break
    return {
        "fee_text": fee_text or page_profile.get("fee_text", ""),
        "purchase_fee_rate": _first_float(row, "申购费率"),
        "redemption_fee_rate": _first_float(row, "赎回费率"),
        "management_fee_rate": _first_float(row, "管理费"),
        "custody_fee_rate": _first_float(row, "托管费"),
        "service_fee_rate": _first_float(row, "销售服务费"),
        "fund_company": page_profile.get("fund_company", ""),
        "underlying_index_code": page_profile.get("underlying_index_code", ""),
        "source": "eastmoney_fee_rank",
    }


def get_all_etf_data() -> List[dict]:
    fund_df = get_etf_fund_list_with_price()
    if fund_df.empty:
        return []

    result = []
    market_time = datetime.now().strftime("%H:%M:%S")
    for _, row in fund_df.iterrows():
        code = row["code"]
        market_price = row["market_price"]
        market_change_pct = row.get("market_change_pct")
        is_no_gap = bool(row["is_no_gap"])
        nav_price, nav_date = get_etf_nav_price(code)
        fund_state, fund_type = parse_fund_state(code)
        if not fund_type:
            fund_type = "ETF(无时差)" if is_no_gap else "ETF"
        premium_rate = None
        if market_price and nav_price and nav_price > 0:
            premium_rate = round((market_price - nav_price) / nav_price * 100, 2)
        result.append(
            {
                "code": code,
                "name": row["name"],
                "market": row["market"],
                "market_price": market_price,
                "market_change_pct": market_change_pct,
                "market_time": market_time,
                "nav_price": nav_price,
                "nav_date": nav_date,
                "fund_state": fund_state,
                "fund_type": fund_type,
                "is_no_gap": is_no_gap,
                "premium_rate": premium_rate,
            }
        )
    return result


def get_all_lof_data() -> List[dict]:
    fund_df = get_lof_fund_list_with_price()
    if fund_df.empty:
        return []

    result = []
    market_time = datetime.now().strftime("%H:%M:%S")
    for _, row in fund_df.iterrows():
        code = row["code"]
        market_price = row["market_price"]
        market_change_pct = row.get("market_change_pct")
        nav_price, nav_date = get_lof_nav_price(code)
        fund_state, fund_type = parse_fund_state(code)
        premium_rate = None
        if market_price and nav_price and nav_price > 0:
            premium_rate = round((market_price - nav_price) / nav_price * 100, 2)
        result.append(
            {
                "code": code,
                "name": row["name"],
                "market": row["market"],
                "market_price": market_price,
                "market_change_pct": market_change_pct,
                "market_time": market_time,
                "nav_price": nav_price,
                "nav_date": nav_date,
                "fund_state": fund_state,
                "fund_type": fund_type,
                "is_no_gap": False,
                "premium_rate": premium_rate,
            }
        )
    return result


def get_fund_realtime_data(code: str, fund_type: str) -> Optional[dict]:
    try:
        current_price = None
        current_change_pct = None
        if fund_type == "ETF":
            etf_df = ak.fund_etf_category_sina(symbol="ETF基金")
            fund_row = etf_df[etf_df["代码"].astype(str).str.contains(code)]
            if not fund_row.empty:
                current_price = _safe_float(fund_row.iloc[0]["最新价"])
                current_change_pct = _first_float(fund_row.iloc[0], "涨跌幅", "涨跌")
        else:
            lof_df = ak.fund_etf_category_sina(symbol="LOF基金")
            fund_row = lof_df[lof_df["代码"].astype(str).str.contains(code)]
            if not fund_row.empty:
                current_price = _safe_float(fund_row.iloc[0]["最新价"])
                current_change_pct = _first_float(fund_row.iloc[0], "涨跌幅", "涨跌")

        if fund_type == "ETF":
            nav_price, nav_date = get_etf_nav_price(code)
        else:
            nav_price, nav_date = get_lof_nav_price(code)

        premium_rate = None
        if current_price and nav_price and nav_price > 0:
            premium_rate = round((current_price - nav_price) / nav_price * 100, 2)

        return {
            "code": code,
            "market_price": current_price,
            "market_change_pct": current_change_pct,
            "nav_price": nav_price,
            "nav_date": nav_date,
            "premium_rate": premium_rate,
        }
    except Exception as e:
        print(f"获取实时数据失败: {e}")
        return None
