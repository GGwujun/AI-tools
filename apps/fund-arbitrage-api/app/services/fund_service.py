from __future__ import annotations

from datetime import datetime
import re

import logging

import akshare as ak
import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from bs4 import BeautifulSoup

from app.config import NO_GAP_KEYWORDS
from app.infrastructure.utils import safe_float as _safe_float, normalize_date_value as _normalize_date_value, format_limit
from app.infrastructure.cache.ttl_cache import ttl_lru_cache

logger = logging.getLogger(__name__)

# 共享 HTTP Session：连接池复用 + 自动重试
_retry_strategy = Retry(
    total=3,
    backoff_factor=0.5,
    status_forcelist=[429, 500, 502, 503, 504],
    raise_on_status=False,
)
_http_session = requests.Session()
_http_session.mount("https://", HTTPAdapter(max_retries=_retry_strategy, pool_maxsize=10))
_http_session.mount("http://", HTTPAdapter(max_retries=_retry_strategy, pool_maxsize=10))


def _first_float(row: pd.Series, *keys: str) -> float | None:
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


@ttl_lru_cache(maxsize=1, ttl_seconds=120)
def _estimated_nav_frame() -> pd.DataFrame:
    try:
        return ak.fund_value_estimation_em(symbol="全部")
    except Exception as e:
        logger.warning(f"获取基金净值估算失败: {e}")
        return pd.DataFrame()


@ttl_lru_cache(maxsize=1, ttl_seconds=120)
def _etf_spot_frame() -> pd.DataFrame:
    try:
        return ak.fund_etf_spot_em()
    except Exception as e:
        logger.warning(f"获取ETF实时估值失败: {e}")
        return pd.DataFrame()


@ttl_lru_cache(maxsize=1, ttl_seconds=300)
def _fund_fee_frame() -> pd.DataFrame:
    try:
        return ak.fund_open_fund_rank_em(symbol="全部")
    except Exception as e:
        logger.warning(f"获取基金费率信息失败: {e}")
        return pd.DataFrame()


@ttl_lru_cache(maxsize=512, ttl_seconds=86400)
def get_fund_page_profile(code: str) -> dict:
    result = {
        "fund_company": "",
        "underlying_index_code": "",
        "fee_text": "",
    }
    try:
        response = _http_session.get(f"https://fund.eastmoney.com/{code}.html", timeout=10)
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
        logger.warning(f"获取ETF基金列表失败: {e}")
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
        logger.warning(f"获取LOF基金列表失败: {e}")
        return pd.DataFrame(columns=["market", "code", "name", "market_price", "market_change_pct"])


# ── 批量行情接口（东方财富多节点回退）──

_EASTMONEY_PUSH_NODES = [
    "https://push2delay.eastmoney.com/api/qt/clist/get",
    "https://push2.eastmoney.com/api/qt/clist/get",
    "https://82.push2.eastmoney.com/api/qt/clist/get",
    "https://11.push2.eastmoney.com/api/qt/clist/get",
]

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
]
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
    """从东方财富 push2 API 批量获取基金行情，多节点回退，最终回退到旧接口。"""
    import random

    base_params = {
        "pn": "1", "pz": "200", "po": "1", "np": "1",
        "ut": "bd1d9ddb04089700cf9c27f6f7426281",
        "fltt": "2", "invt": "2",
        "wbp2u": "|0|0|0|web",
        "fid": "f3",
        "fs": fs,
        "fields": _EASTMONEY_PUSH_FIELDS,
    }
    headers = {"User-Agent": random.choice(_USER_AGENTS)}

    for url in _EASTMONEY_PUSH_NODES:
        try:
            # 第一页
            r = _http_session.get(url, params=base_params, headers=headers, timeout=15)
            r.raise_for_status()
            data_json = r.json()
            if not data_json.get("data") or not data_json["data"].get("diff"):
                continue  # try next node

            per_page = len(data_json["data"]["diff"])
            total = data_json["data"]["total"]
            total_page = (total + per_page - 1) // per_page

            pages = [pd.DataFrame(data_json["data"]["diff"])]

            # 剩余页
            for page in range(2, total_page + 1):
                params = base_params.copy()
                params["pn"] = str(page)
                r = _http_session.get(url, params=params, headers=headers, timeout=15)
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
            logger.info(f"东方财富批量接口成功(url={url}), 获取{len(df)}条数据")
            return df[existing]

        except Exception as e:
            logger.warning(f"东方财富节点失败(url={url}): {e}")
            continue

    logger.warning("所有东方财富节点均失败，回退到旧接口")
    return fallback_fn()


@ttl_lru_cache(maxsize=1, ttl_seconds=60)
def get_lof_fund_list_bulk() -> pd.DataFrame:
    """批量获取 LOF 实时行情（东方财富 push2delay），失败回退到 Sina。"""
    return _fetch_eastmoney_bulk(_LOF_FS, get_lof_fund_list_with_price)


@ttl_lru_cache(maxsize=1, ttl_seconds=60)
def get_etf_fund_list_bulk() -> pd.DataFrame:
    """批量获取 ETF 实时行情（东方财富 push2delay），失败回退到 Sina。"""
    return _fetch_eastmoney_bulk(_ETF_FS, get_etf_fund_list_with_price)


# ── 申购限额批量接口 ──

@ttl_lru_cache(maxsize=1, ttl_seconds=300)
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


def get_etf_nav_price(code: str) -> tuple[float | None, str | None]:
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


def get_lof_nav_price(code: str) -> tuple[float | None, str | None]:
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


def parse_fund_state(code: str) -> tuple[str, str]:
    url = f"https://fund.eastmoney.com/{code}.html"
    fund_state = ""
    fund_type = ""
    try:
        response = _http_session.get(url, timeout=10)
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


def get_estimated_nav_info(code: str) -> tuple[float | None, str | None, float | None, str]:
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


def get_etf_iopv_info(code: str) -> tuple[float | None, str | None, float | None, str]:
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


def _fetch_price_from_eastmoney(code: str) -> float | None:
    """Fetch single fund price from Eastmoney push2 API."""
    prefix = "1." if code.startswith(("5", "6")) else "0."
    secid = f"{prefix}{code}"
    url = "https://push2.eastmoney.com/api/qt/stock/get"
    params = {
        "ut": "fa5fd1943c7b386f172d6893dbfba10b",
        "fltt": "2", "invt": "2",
        "fields": "f43,f170,f46,f44",
        "secid": secid,
    }
    try:
        r = _http_session.get(url, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        if data.get("data") and data["data"].get("f43") != "-":
            return _safe_float(data["data"]["f43"])
    except Exception as e:
        logger.warning(f"东方财富单基金价格获取失败({code}): {e}")
    return None


def _fetch_price_from_sina(code: str) -> float | None:
    """Fetch fund price from Sina Finance API."""
    # Sina uses sz/sh prefix
    prefix = "sz" if code.startswith(("1", "3", "5")) else "sh"
    url = f"http://hq.sinajs.cn/list={prefix}{code}"
    try:
        r = _http_session.get(url, timeout=10,
                         headers={"Referer": "http://finance.sina.com.cn"})
        r.encoding = "gbk"
        if r.text and '=' in r.text:
            fields = r.text.split('"')[1].split(",")
            if len(fields) > 3:
                return _safe_float(fields[3])  # current price
    except Exception as e:
        logger.warning(f"新浪价格获取失败({code}): {e}")
    return None


def _fetch_price_from_tencent(code: str) -> float | None:
    """Fetch fund price from Tencent Finance API."""
    prefix = "sz" if code.startswith(("1", "3", "5")) else "sh"
    url = f"http://qt.gtimg.cn/q={prefix}{code}"
    try:
        r = _http_session.get(url, timeout=10)
        if r.text and '~' in r.text:
            fields = r.text.split('~')
            if len(fields) > 3:
                return _safe_float(fields[3])  # current price
    except Exception as e:
        logger.warning(f"腾讯价格获取失败({code}): {e}")
    return None


def get_fund_realtime_data(code: str, fund_type: str) -> dict | None:
    """获取基金实时数据，三源回退：东方财富→新浪→腾讯"""
    current_price = None
    current_change_pct = None

    # 尝试三源回退获取价格
    for fetch_fn in (_fetch_price_from_eastmoney, _fetch_price_from_sina, _fetch_price_from_tencent):
        price = fetch_fn(code)
        if price is not None and price > 0:
            current_price = price
            break

    if current_price is None:
        # 最终回退到 AkShare 全量数据（较慢）
        try:
            if fund_type == "ETF":
                df = ak.fund_etf_category_sina(symbol="ETF基金")
            else:
                df = ak.fund_etf_category_sina(symbol="LOF基金")
            row = df[df["代码"].astype(str).str.contains(code)]
            if not row.empty:
                current_price = _safe_float(row.iloc[0]["最新价"])
                current_change_pct = _first_float(row.iloc[0], "涨跌幅", "涨跌")
        except Exception as e:
            logger.warning(f"AkShare价格获取失败({code}): {e}")

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
