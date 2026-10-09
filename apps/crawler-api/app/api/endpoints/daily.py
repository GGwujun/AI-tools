# 今日数据接口：金价 / 油价 / 朝霞晚霞预测 / 每日壁纸
# 数据源全部免 key：新浪财经行情、Open-Meteo 云量(GFS)、Bing 每日壁纸
# 油价优先走天行数据(需 TIANAPI_KEY)，否则用 data/oil_prices.json 静态兜底
import asyncio
import json
import os
import re
import time
from datetime import datetime, timedelta, timezone, date as date_cls
from typing import Optional

import httpx
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

router = APIRouter()

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
SINA_HEADERS = {"Referer": "https://finance.sina.com.cn", "User-Agent": UA}
TZ8 = timezone(timedelta(hours=8))

_OIL_JSON = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "oil_prices.json"))

# ---------------------------------------------------------------------------
# 简单内存缓存：key -> (过期时间戳, data)
_CACHE: dict = {}


def _cache_get(key: str, ttl: int):
    hit = _CACHE.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    return None


def _cache_set(key: str, ttl: int, data):
    if len(_CACHE) > 500:
        for k in list(_CACHE.keys())[:250]:
            _CACHE.pop(k, None)
    _CACHE[key] = (time.time() + ttl, data)


def _f(v):
    try:
        return float(v)
    except (TypeError, ValueError, IndexError):
        return None


# ---------------------------------------------------------------------------
# 金价：新浪行情
#   hf_XAU  现货黄金(伦敦金)  [3]现价 [5]昨收 [6]时间 [13]日期   单位 美元/盎司
#   nf_AU0  沪金连续          [5]现价 [9]昨结 [17]日期          单位 元/克
#   fx_susdcny 瑞穗美元人民币  [1]买价                            单位 元
async def _sina_text(codes, client: httpx.AsyncClient) -> str:
    r = await client.get("https://hq.sinajs.cn/list=" + ",".join(codes), headers=SINA_HEADERS)
    r.raise_for_status()
    return r.text


def _sina_fields(text: str, code: str):
    for line in text.splitlines():
        if f"hq_str_{code}=" in line:
            body = line.split("=", 1)[1].strip().rstrip(";").strip('"')
            return body.split(",") if body else []
    return []


def _nf_price(fields):
    """新浪内盘期货(如沪金 nf_AU0)取最新价/昨结算。
    实测字段语义：[8]最新价 [10]昨结算；开盘竞价等时段 [5]/[8] 可能为 0，
    依次退化到 [5]昨收、买卖均价，避免展示 0.00。"""
    if not fields:
        return None, None
    price = _f(fields[8]) if len(fields) > 8 else None
    if not price:
        price = _f(fields[5]) if len(fields) > 5 else None
    if not price:
        bid = _f(fields[6]) if len(fields) > 6 else None
        ask = _f(fields[7]) if len(fields) > 7 else None
        if bid and ask:
            price = round((bid + ask) / 2, 3)
    prev = _f(fields[10]) if len(fields) > 10 else None
    if not prev:
        prev = _f(fields[9]) if len(fields) > 9 else None
    return price, prev


def _quote(price, prev):
    if price is None:
        return None
    change = round(price - prev, 2) if prev else None
    pct = round((price - prev) / prev * 100, 2) if prev else None
    return {"price": price, "change": change, "change_pct": pct}


def _fmt_hm(t: str) -> str:
    """'HH:MM:SS' -> 'HH:MM'；'HHMMSS' -> 'HH:MM'"""
    if not t:
        return ""
    if ":" in t:
        return t[:5]
    return f"{t[:2]}:{t[2:4]}" if len(t) >= 4 else t


@router.get("/gold", summary="今日金价")
async def daily_gold():
    cached = _cache_get("gold", 60)
    if cached:
        return cached
    result = {"code": 200, "message": "ok"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            text = await _sina_text(["hf_XAU", "nf_AU0", "fx_susdcny"], client)
        xau, auf, cny = (_sina_fields(text, c) for c in ("hf_XAU", "nf_AU0", "fx_susdcny"))
        intl = _quote(_f(xau[3]) if xau else None, _f(xau[5]) if xau else None)
        if intl:
            intl.update({"unit": "美元/盎司", "name": (xau[13] or "国际现货金") if len(xau) > 13 else "国际现货金",
                         "time": _fmt_hm(xau[6]) if len(xau) > 6 else "",
                         "date": xau[12] if len(xau) > 12 else ""})
        sh_price, sh_prev = _nf_price(auf)
        sh = _quote(sh_price, sh_prev)
        if sh:
            sh.update({"unit": "元/克", "name": "上海黄金(沪金连续)",
                       "time": _fmt_hm(auf[1]) if len(auf) > 1 else "",
                       "date": auf[17] if len(auf) > 17 else ""})
        if not intl and not sh:
            raise ValueError("sina empty")
        result["data"] = {"intl": intl, "sh": sh, "usdcny": _f(cny[1]) if cny else None,
                          "updated_at": datetime.now(TZ8).strftime("%Y-%m-%d %H:%M:%S")}
    except Exception:
        # 兜底：gold-api.com（只有国际金，免 key）
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get("https://api.gold-api.com/price/XAU")
                r.raise_for_status()
                p = r.json().get("price")
            intl = _quote(_f(p), None)
            intl.update({"unit": "美元/盎司", "name": "国际现货金", "time": "", "date": ""})
            result["data"] = {"intl": intl, "sh": None, "usdcny": None,
                              "updated_at": datetime.now(TZ8).strftime("%Y-%m-%d %H:%M:%S")}
        except Exception:
            result = {"code": 502, "message": "行情源暂时不可用，请稍后再试"}
    _cache_set("gold", 60, result)
    return result


# ---------------------------------------------------------------------------
# 油价：小熊油耗实时抓取(免 key，服务端渲染) → 天行数据(可选 key，含98#) → 静态 JSON 兜底
PROVINCES = ["北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏",
             "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西",
             "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆"]

# 页面全称 -> PROVINCES 短名
_PROV_FULL = {"内蒙古自治区": "内蒙古", "广西壮族自治区": "广西", "西藏自治区": "西藏",
              "宁夏回族自治区": "宁夏", "新疆维吾尔自治区": "新疆", "黑龙江省": "黑龙江"}

_OIL_ROW_RE = re.compile(
    r'<td class="region-name">\s*<a[^>]*>([^<]+)</a>\s*</td>\s*'
    r'<td[^>]*>([\d.]+)</td>\s*<td[^>]*>([\d.]+)</td>\s*<td[^>]*>([\d.]+)</td>')
_OIL_ADJ_RE = re.compile(r"上次调价[：:](\d{4}-\d{2}-\d{2})[^下]{0,40}下次调价[：:](\d{4}-\d{2}-\d{2})")


def _prov_short(name: str) -> str:
    name = name.strip()
    for full, short in _PROV_FULL.items():
        if name.startswith(full):
            return short
    return name.rstrip("省市")


async def _oil_from_xyh():
    """抓小熊油耗全国油价页：31 省 92#/95#/0#柴 + 调价窗口。"""
    async with httpx.AsyncClient(timeout=15, headers={"User-Agent": UA}) as client:
        r = await client.get("https://www.xiaoxiongyouhao.com/fprice/")
        r.raise_for_status()
        html = r.text
    seen, provinces = {}, []
    for name, p92, p95, p0 in _OIL_ROW_RE.findall(html):
        prov = _prov_short(name)
        if prov in PROVINCES and prov not in seen:
            seen[prov] = True
            provinces.append({"prov": prov, "p92": float(p92), "p95": float(p95), "p98": None, "p0": float(p0)})
    if len(provinces) < 31:
        return None
    provinces.sort(key=lambda x: PROVINCES.index(x["prov"]))
    m = _OIL_ADJ_RE.search(html)
    last_adj, next_adj = (m.group(1), m.group(2)) if m else ("", "")
    return provinces, last_adj, next_adj


async def _oil_from_tianapi(key: str):
    async def one(prov, client):
        r = await client.get("http://api.tianapi.com/oilprice/index", params={"key": key, "prov": prov})
        r.raise_for_status()
        body = r.json()
        if body.get("code") != 200:
            raise ValueError(body.get("msg", "tianapi error"))
        item = body["newslist"][0]
        return {"prov": prov, "p92": _f(item.get("92h")), "p95": _f(item.get("95h")),
                "p98": _f(item.get("98h")), "p0": _f(item.get("0h"))}

    async with httpx.AsyncClient(timeout=10) as client:
        items = await asyncio.gather(*(one(p, client) for p in PROVINCES), return_exceptions=True)
    ok = [i for i in items if not isinstance(i, Exception)]
    if len(ok) < 31:
        return None
    return sorted(ok, key=lambda x: PROVINCES.index(x["prov"]))


@router.get("/oil", summary="今日油价(31省)")
async def daily_oil():
    cached = _cache_get("oil", 4 * 3600)
    if cached:
        return cached
    tip = "油价仅供参考，以加油站实际价格为准"
    # 1) 小熊油耗实时抓取（免 key，调价窗口信息最全）
    try:
        xyh = await _oil_from_xyh()
        if xyh:
            provinces, last_adj, next_adj = xyh
            result = {"code": 200, "message": "ok", "tip": tip,
                      "data": {"source": "小熊油耗", "updated_at": last_adj or datetime.now(TZ8).strftime("%Y-%m-%d %H:%M"),
                               "last_adj": last_adj, "next_adj": next_adj, "provinces": provinces}}
            _cache_set("oil", 4 * 3600, result)
            return result
    except Exception:
        pass
    # 2) 天行数据（可选 key，含 98#）
    key = os.environ.get("TIANAPI_KEY", "").strip()
    if key:
        try:
            provinces = await _oil_from_tianapi(key)
            if provinces:
                result = {"code": 200, "message": "ok", "tip": tip,
                          "data": {"source": "天行数据", "updated_at": datetime.now(TZ8).strftime("%Y-%m-%d %H:%M"),
                                   "last_adj": "", "next_adj": "", "provinces": provinces}}
                _cache_set("oil", 12 * 3600, result)
                return result
        except Exception:
            pass
    # 3) 静态兜底
    try:
        with open(_OIL_JSON, encoding="utf-8") as f:
            seed = json.load(f)
        result = {"code": 200, "message": "ok", "tip": tip,
                  "data": {"source": seed.get("source", "manual"), "updated_at": seed.get("updated_at", ""),
                           "last_adj": seed.get("last_adj", ""), "next_adj": seed.get("next_adj", ""),
                           "provinces": seed.get("provinces", [])}}
    except Exception:
        result = {"code": 502, "message": "油价数据暂不可用"}
    _cache_set("oil", 3600, result)
    return result


# ---------------------------------------------------------------------------
# 朝霞/晚霞预测：Open-Meteo 小时级云量 + astral 日出日落(UTC 再转北京时间)
def _sun_times(d: date_cls, lat: float, lng: float):
    """返回 (日出, 日落) 的 UTC 分钟数；极昼/极夜返回 (None, None)。"""
    try:
        from astral import Observer
        from astral.sun import sun as astral_sun
        s = astral_sun(Observer(latitude=lat, longitude=lng), date=d, tzinfo=timezone.utc)
        r, t = s["sunrise"], s["sunset"]
        return r.hour * 60 + r.minute + r.second / 60.0, t.hour * 60 + t.minute + t.second / 60.0
    except Exception:
        return None, None


def _utc_to_local_str(utc_minutes, tz_hours=8):
    m = (utc_minutes + tz_hours * 60) % 1440
    return f"{int(m // 60):02d}:{int(m % 60):02d}"


async def _open_meteo_clouds(lat: float, lng: float):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat, "longitude": lng, "timezone": "Asia/Shanghai",
                "forecast_days": 2,
                "hourly": "cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility",
            },
        )
        r.raise_for_status()
        return r.json()["hourly"]


def _cloud_score(low, mid, high, vis_km):
    """火烧云潜质 0~100：中云是主力，高云加分，低云挡光，能见度加权。先得有云，晴空封顶不烧。"""
    s_mid = 5.0
    if mid is not None:
        if 40 <= mid <= 85:
            s_mid = 40.0
        elif 20 <= mid < 40 or 85 < mid <= 95:
            s_mid = 25.0
    s_high = 0.0
    if high is not None:
        if 25 <= high <= 85:
            s_high = 25.0
        elif 10 <= high < 25 or 85 < high <= 95:
            s_high = 12.0
    s = s_mid + s_high
    if s < 12:
        return min(s, 15.0)  # 基本无云：不烧
    if low is not None:
        if low <= 30:
            s += 20.0
        elif low <= 55:
            s += 10.0
    if vis_km is not None:
        if vis_km >= 15:
            s += 15.0
        elif vis_km >= 7:
            s += 7.0
    return min(100.0, s)


GRADES = [(75, "爆表级", "条件极佳，大概率出现漫天火烧云，务必提前到机位！"),
          (60, "大烧", "云层条件很好，火烧云概率高，推荐前往拍摄。"),
          (40, "中等", "有一定机会，建议碰碰运气，留意天边云量变化。"),
          (20, "微烧", "只有轻微染色的可能，不推荐专程前往。"),
          (0, "不烧", "云量条件不佳，基本不会出现火烧云。")]


@router.get("/sunset", summary="朝霞/晚霞火烧云预测")
async def daily_sunset(lat: float = Query(..., ge=-90, le=90),
                       lng: float = Query(..., ge=-180, le=180),
                       mode: str = Query("sunrise", pattern="^(sunrise|sunset)$"),
                       day: str = Query("tomorrow", pattern="^(today|tomorrow)$")):
    ckey = f"clouds:{round(lat, 2)}:{round(lng, 2)}"
    clouds = _cache_get(ckey, 1800)
    if clouds is None:
        try:
            clouds = await _open_meteo_clouds(round(lat, 4), round(lng, 4))
            _cache_set(ckey, 1800, clouds)
        except Exception:
            return {"code": 502, "message": "气象数据源暂时不可用，请稍后再试"}

    now8 = datetime.now(TZ8)
    target = now8.date() + timedelta(days=(1 if day == "tomorrow" else 0))
    rise_utc, set_utc = _sun_times(target, lat, lng)
    if rise_utc is None:
        return {"code": 400, "message": "该纬度当前为极昼/极夜，无法预测"}
    rise_local = (rise_utc + 480) % 1440
    set_local = (set_utc + 480) % 1440
    if mode == "sunrise":
        center, label = rise_local, "日出"
        win = (center - 40, center + 10)
    else:
        center, label = set_local, "日落"
        win = (center - 10, center + 40)

    times, hours = clouds.get("time", []), []
    low_l = clouds.get("cloud_cover_low", [])
    mid_l = clouds.get("cloud_cover_mid", [])
    high_l = clouds.get("cloud_cover_high", [])
    vis_l = clouds.get("visibility", [])
    for i, t in enumerate(times):
        if not t.startswith(target.strftime("%Y-%m-%d")):
            continue
        hh, mm = int(t[11:13]), int(t[14:16])
        m = hh * 60 + mm
        # 取窗口附近(±60分钟)的小时点
        if not (win[0] - 60 <= m <= win[1] + 60):
            continue
        low = low_l[i] if i < len(low_l) else None
        mid = mid_l[i] if i < len(mid_l) else None
        high = high_l[i] if i < len(high_l) else None
        vis = vis_l[i] / 1000.0 if i < len(vis_l) and vis_l[i] is not None else None
        hours.append({"time": f"{hh:02d}:00", "low": low, "mid": mid, "high": high,
                      "vis_km": round(vis, 1) if vis is not None else None,
                      "s": round(_cloud_score(low, mid, high, vis))})
    if not hours:
        return {"code": 502, "message": "气象数据超出预报范围"}
    best = max(hours, key=lambda h: h["s"])
    score = best["s"]
    grade = next(g for g in GRADES if score >= g[0])

    countdown = None
    tgt_dt = datetime(target.year, target.month, target.day, int(center // 60), int(center % 60), tzinfo=TZ8)
    if tgt_dt > now8:
        countdown = int((tgt_dt - now8).total_seconds())

    data = {
        "mode": mode, "date": target.strftime("%Y-%m-%d"),
        "sunrise": _utc_to_local_str(rise_utc), "sunset": _utc_to_local_str(set_utc),
        "window": {"start": f"{int(win[0] // 60) % 24:02d}:{int(win[0] % 60):02d}",
                   "end": f"{int(win[1] // 60) % 24:02d}:{int(win[1] % 60):02d}"},
        "event_label": label,
        "score": score, "grade": grade[1], "tip": grade[2],
        "hours": hours, "countdown": countdown,
        "lat": round(lat, 4), "lng": round(lng, 4),
    }
    return {"code": 200, "message": "ok", "data": data}


# ---------------------------------------------------------------------------
# 每日壁纸：Bing 每日一图(免 key)，/file 提供保存代理(小程序域名白名单)
@router.get("/wallpaper", summary="Bing 每日壁纸")
async def daily_wallpaper(days: int = Query(8, ge=1, le=8)):
    cached = _cache_get("wallpaper", 6 * 3600)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://www.bing.com/HPImageArchive.aspx",
                params={"format": "js", "idx": 0, "n": days, "mkt": "zh-CN"},
                headers={"User-Agent": UA},
            )
            r.raise_for_status()
            images = r.json().get("images", [])
        items = []
        for img in images:
            hd = "https://www.bing.com" + img.get("url", "")
            uhd = "https://www.bing.com" + img.get("urlbase", "") + "_UHD.jpg"
            end = img.get("enddate", "")
            items.append({
                "title": img.get("title", ""),
                "copyright": img.get("copyright", ""),
                "date": f"{end[:4]}-{end[4:6]}-{end[6:]}" if len(end) == 8 else end,
                "hd": hd, "uhd": uhd,
            })
        result = {"code": 200, "message": "ok",
                  "data": {"images": items, "updated_at": datetime.now(TZ8).strftime("%Y-%m-%d %H:%M")}}
        _cache_set("wallpaper", 6 * 3600, result)
        return result
    except Exception:
        return {"code": 502, "message": "壁纸源暂时不可用，请稍后再试"}


@router.get("/wallpaper/file", summary="壁纸图片代理(供保存相册)")
async def wallpaper_file(url: str = Query(...)):
    if not url.startswith("https://www.bing.com/th?"):
        return {"code": 400, "message": "仅支持 Bing 壁纸地址"}

    async def gen():
        async with httpx.AsyncClient(timeout=30) as client:
            async with client.stream("GET", url, headers={"User-Agent": UA}) as r:
                if r.status_code != 200:
                    yield b""
                    return
                async for chunk in r.aiter_bytes(64 * 1024):
                    yield chunk

    return StreamingResponse(gen(), media_type="image/jpeg")


# ---------------------------------------------------------------------------
# 今日汇率（新浪行情，免 key）
# (代码, 币种, 单位)；日元/韩元习惯按 100 报价
FX_CODES = [
    ("fx_susdcny", "美元 USD", 1),
    ("fx_seurcny", "欧元 EUR", 1),
    ("fx_shkdcny", "港币 HKD", 1),
    ("fx_sjpycny", "日元 JPY", 100),
    ("fx_sgbpcny", "英镑 GBP", 1),
    ("fx_saudcny", "澳元 AUD", 1),
    ("fx_scadcny", "加元 CAD", 1),
    ("fx_schfcny", "瑞郎 CHF", 1),
    ("fx_skrwcny", "韩元 KRW", 100),
]


@router.get("/rate", summary="今日汇率(常用货币兑人民币)")
async def daily_rate():
    cached = _cache_get("rate", 1800)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            text = await _sina_text([c[0] for c in FX_CODES], client)
        rates = []
        for code, name, per in FX_CODES:
            fields = _sina_fields(text, code)
            rate = _f(fields[1]) if fields else None
            if rate:
                rates.append({"code": code.replace("fx_s", "").replace("cny", "").upper(),
                              "name": name, "per": per, "rate": rate})
        if not rates:
            raise ValueError("sina empty")
        result = {"code": 200, "message": "ok", "tip": "中国银行折算价，仅供参考",
                  "data": {"rates": rates,
                           "updated_at": datetime.now(TZ8).strftime("%Y-%m-%d %H:%M")}}
        _cache_set("rate", 1800, result)
        return result
    except Exception:
        return {"code": 502, "message": "汇率数据暂时不可用，请稍后再试"}


# ---------------------------------------------------------------------------
# 历史上的今天
async def _history_from_60s(mmdd: str):
    """60s API（vikiboss/60s），免 key、国内可达。"""
    mm, dd = mmdd.split("-")
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get("https://60s.viki.moe/v2/today_in_history",
                             params={"month": int(mm), "day": int(dd)},
                             headers={"User-Agent": UA})
        r.raise_for_status()
        body = r.json()
    if body.get("code") != 200:
        raise ValueError(body.get("message", "60s error"))
    events = []
    for item in (body.get("data") or {}).get("items") or []:
        year = str(item.get("year", "")).strip()
        title = str(item.get("title", "")).strip()
        desc = str(item.get("description", "")).strip()
        if year and title:
            events.append({"year": year, "title": title, "description": desc})
    if not events:
        raise ValueError("60s empty")
    return events


async def _history_from_tianapi(key: str, mmdd: str):
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get("https://apis.tianapi.com/lishi/index",
                             params={"key": key, "date": mmdd})
        r.raise_for_status()
        body = r.json()
        if body.get("code") != 200:
            raise ValueError(body.get("msg", "tianapi error"))
    events = []
    for item in body.get("newslist") or []:
        year = str(item.get("year", "")).strip()
        title = str(item.get("title", "")).strip()
        if year and title:
            events.append({"year": year, "title": title})
    if not events:
        raise ValueError("tianapi empty")
    return events


async def _history_from_wiki(mmdd: str):
    mm, dd = mmdd.split("-")
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"https://zh.wikipedia.org/api/rest_v1/feed/onthisday/events/{mm}/{dd}",
                             headers={"User-Agent": UA})
        r.raise_for_status()
        payload = r.json()
    events = []
    for item in payload.get("events") or []:
        year = item.get("year")
        text = str(item.get("text", "")).strip()
        if year and text:
            events.append({"year": str(year), "title": text})
    if not events:
        raise ValueError("wiki empty")
    return events


def _year_sort_key(year: str):
    y = year.replace("公元前", "-").replace("前", "-").strip()
    try:
        return int(y)
    except ValueError:
        return 99999


@router.get("/history", summary="历史上的今天")
async def daily_history(date: str = Query("", max_length=5)):
    """date 为 MM-DD，默认今天（北京时间）。"""
    mmdd = date.strip()
    if mmdd:
        if not re.fullmatch(r"(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])", mmdd):
            return {"code": 400, "message": "日期格式应为 MM-DD"}
        mm, dd = mmdd.split("-")
        mmdd = f"{int(mm):02d}-{int(dd):02d}"
    else:
        mmdd = datetime.now(TZ8).strftime("%m-%d")

    cached = _cache_get(f"history:{mmdd}", 12 * 3600)
    if cached:
        return cached

    events = None
    source = ""
    is_today = mmdd == datetime.now(TZ8).strftime("%m-%d")
    # 1) 今天的数据走 60s API（免 key、国内可达；注意它忽略 date 参数，只能查今天）
    # 2) 任意日期：天行数据（可选 key） 3) 中文维基（需境外网络，服务器可达）
    if is_today:
        try:
            events = await _history_from_60s(mmdd)
            source = "60s百科"
        except Exception:
            events = None
    if events is None:
        key = os.environ.get("TIANAPI_KEY", "").strip()
        if key:
            try:
                events = await _history_from_tianapi(key, mmdd)
                source = "天行数据"
            except Exception:
                events = None
    if events is None:
        try:
            events = await _history_from_wiki(mmdd)
            source = "维基百科"
        except Exception:
            events = None
    if events is None:
        result = {"code": 502, "message": "历史上的今天数据暂不可用"}
        _cache_set(f"history:{mmdd}", 600, result)
        return result

    events.sort(key=lambda e: _year_sort_key(e["year"]))
    result = {"code": 200, "message": "ok", "tip": "内容整理自公开资料，仅供参考",
              "data": {"date": mmdd, "source": source, "count": len(events), "events": events}}
    _cache_set(f"history:{mmdd}", 12 * 3600, result)
    return result
