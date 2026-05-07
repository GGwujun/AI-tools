from __future__ import annotations

from datetime import datetime, timedelta

import akshare as ak
import pandas as pd
import requests
from bs4 import BeautifulSoup


DATE_FORMAT_CANDIDATES = (
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y%m%d",
    "%m-%d",
    "%m/%d",
)


def _safe_float(value: object) -> float | None:
    try:
        if value is None:
            return None
        return float(str(value).replace(",", "").replace("%", "").strip())
    except (TypeError, ValueError):
        return None


def _format_pct(value: float | None) -> str:
    if value is None:
        return "--"
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.2f}%"


def _parse_date_series(series: pd.Series) -> pd.Series:
    parsed = pd.Series(pd.NaT, index=series.index, dtype="datetime64[ns]")
    text_values = series.astype(str).str.strip()
    remaining_mask = text_values.ne("") & text_values.ne("nan")

    for fmt in DATE_FORMAT_CANDIDATES:
        if not remaining_mask.any():
            break
        chunk = pd.to_datetime(text_values.where(remaining_mask), format=fmt, errors="coerce")
        parsed = parsed.fillna(chunk)
        remaining_mask = parsed.isna() & text_values.ne("") & text_values.ne("nan")

    if remaining_mask.any():
        fallback = pd.to_datetime(text_values.where(remaining_mask), errors="coerce", format="mixed")
        parsed = parsed.fillna(fallback)

    current_year = datetime.now().year
    no_year_mask = parsed.notna() & text_values.str.match(r"^\d{1,2}[-/]\d{1,2}$", na=False)
    parsed.loc[no_year_mask] = parsed.loc[no_year_mask].apply(lambda dt: dt.replace(year=current_year))
    return parsed


def get_arbitrage_strategies(
    code: str,
    market_type: str,
    *,
    current_price: float | None = None,
    nav_price: float | None = None,
    premium_rate: float | None = None,
) -> list[dict]:
    if premium_rate is None and current_price and nav_price and nav_price > 0:
        premium_rate = round((current_price - nav_price) / nav_price * 100, 2)

    if premium_rate is None:
        return []

    if premium_rate >= 1.5:
        return [
            {
                "title": f"{code} 当前溢价较高",
                "strategy": "可重点关注场外申购转场内的价差窗口，同时确认当日申购限制和成交深度。",
                "success_rate": "--",
                "occurrence_count": "--",
                "total_return": _format_pct(premium_rate),
                "probability": "高",
                "start_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
            }
        ]

    if premium_rate >= 0.5:
        return [
            {
                "title": f"{code} 当前存在轻度溢价",
                "strategy": "建议继续观察盘口和净值更新，等待更明确的价差区间。",
                "success_rate": "--",
                "occurrence_count": "--",
                "total_return": _format_pct(premium_rate),
                "probability": "中",
                "start_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
            }
        ]

    if premium_rate <= -1:
        return [
            {
                "title": f"{code} 当前处于折价区间",
                "strategy": "更适合折价观察，不适合作为溢价套利标的。",
                "success_rate": "--",
                "occurrence_count": "--",
                "total_return": _format_pct(premium_rate),
                "probability": "低",
                "start_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
            }
        ]

    return [
        {
            "title": f"{code} 当前套利空间有限",
            "strategy": "当前溢价接近平价，建议继续观察。",
            "success_rate": "--",
            "occurrence_count": "--",
            "total_return": _format_pct(premium_rate),
            "probability": "低",
            "start_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
        }
    ]


def get_five_level_data(code: str, market: str | None = None) -> dict:
    symbols: list[str] = []
    if market:
        symbols.append(f"{market}{code}")
    symbols.extend([f"sz{code}", f"sh{code}", code])

    for symbol in symbols:
        try:
            df = ak.fund_etf_spot_em(symbol=symbol)
        except Exception:
            continue
        parsed = parse_five_level_from_dataframe(df)
        if parsed["bid"] or parsed["ask"]:
            return parsed

    return {"update_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "bid": [], "ask": []}


def parse_five_level_from_dataframe(df: pd.DataFrame) -> dict:
    if df is None or df.empty:
        return {"update_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "bid": [], "ask": []}

    row = df.iloc[0]
    columns = {str(column): column for column in df.columns}

    def pick(candidates: list[str]) -> object:
        for candidate in candidates:
            if candidate in columns:
                return row[columns[candidate]]
        return None

    bid: list[dict] = []
    ask: list[dict] = []

    for level in range(5, 0, -1):
        price = _safe_float(pick([f"买{level}", f"买{level}价", f"买{level}价格"]))
        volume = _safe_float(pick([f"买{level}量", f"买{level}手"]))
        if price is None and volume is None:
            continue
        bid.append({"price": price, "volume": f"{int(volume):d}" if volume is not None else "--", "premium": "--"})

    for level in range(1, 6):
        price = _safe_float(pick([f"卖{level}", f"卖{level}价", f"卖{level}价格"]))
        volume = _safe_float(pick([f"卖{level}量", f"卖{level}手"]))
        if price is None and volume is None:
            continue
        ask.append({"price": price, "volume": f"{int(volume):d}" if volume is not None else "--", "premium": "--"})

    return {
        "update_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "bid": bid,
        "ask": ask,
    }


def get_nav_history(code: str, market_type: str, days: int = 20) -> list[dict]:
    end_date = datetime.now()
    start_date = end_date - timedelta(days=max(days * 3, 60))

    try:
        df = ak.fund_etf_fund_info_em(
            fund=code,
            start_date=start_date.strftime("%Y%m%d"),
            end_date=end_date.strftime("%Y%m%d"),
        )
        if (df is None or df.empty) and market_type != "ETF":
            df = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
    except Exception:
        return []

    if df is None or df.empty:
        return []

    date_col = df.columns[0]
    nav_col = df.columns[1]
    growth_col = df.columns[3] if len(df.columns) > 3 else None

    working = df[[date_col, nav_col]].copy()
    working[date_col] = _parse_date_series(working[date_col])
    working[nav_col] = pd.to_numeric(working[nav_col], errors="coerce")
    if growth_col is not None:
        working["growth"] = pd.to_numeric(df[growth_col], errors="coerce")
    working = working.dropna().sort_values(date_col)

    if working.empty:
        return []

    recent = working.tail(days)
    result: list[dict] = []
    previous_nav: float | None = None

    for _, row in recent.iterrows():
        nav_value = float(row[nav_col])
        nav_change_pct = _safe_float(row.get("growth")) if "growth" in row else None
        if nav_change_pct is None and previous_nav and previous_nav != 0:
            nav_change_pct = round((nav_value - previous_nav) / previous_nav * 100, 2)

        result.append(
            {
                "date": row[date_col].strftime("%Y-%m-%d"),
                "nav": round(nav_value, 4),
                "nav_change_pct": nav_change_pct,
                "premium_rate": None,
                "estimated_profit_pct": nav_change_pct,
            }
        )
        previous_nav = nav_value

    return list(reversed(result))


def get_fund_scale_turnover(code: str) -> tuple[str, str]:
    url = f"https://fund.eastmoney.com/{code}.html"
    try:
        response = requests.get(url, timeout=5)
        response.encoding = response.apparent_encoding
        if response.status_code != 200:
            return "--", "--"

        soup = BeautifulSoup(response.text, "html.parser")
        text = soup.get_text(" ", strip=True)

        scale = "--"
        turnover = "--"
        for token in text.split():
            if "规模" in token and scale == "--":
                scale = token.replace("基金规模：", "").replace("规模：", "")
            if "成交额" in token and turnover == "--":
                turnover = token.replace("成交额：", "")

        return scale or "--", turnover or "--"
    except Exception:
        return "--", "--"
