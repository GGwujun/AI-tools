from __future__ import annotations

from datetime import datetime, timezone

from app.domain.models import NavSnapshot


def assess_valuation_quality(
    *,
    benchmark_nav: float | None,
    official_nav: NavSnapshot | None,
    estimate_nav: NavSnapshot | None,
    iopv_nav: NavSnapshot | None,
) -> tuple[str, str, list[str]]:
    flags: list[str] = []

    if benchmark_nav is None:
        return "ERROR", "LOW", ["缺少估值基准"]

    if official_nav and estimate_nav and official_nav.nav_value and estimate_nav.nav_value:
        diff = abs(official_nav.nav_value - estimate_nav.nav_value) / official_nav.nav_value
        if diff > 0.01:
            flags.append("多源偏差过大")

    if estimate_nav and estimate_nav.nav_time:
        delay_seconds = (datetime.now(timezone.utc) - estimate_nav.nav_time).total_seconds()
        if delay_seconds > 120:
            flags.append("估值延迟过大")

    if official_nav and official_nav.nav_value and benchmark_nav:
        premium_abs = abs((benchmark_nav - official_nav.nav_value) / official_nav.nav_value)
        if premium_abs > 0.05:
            flags.append("溢价异常")

    if iopv_nav and iopv_nav.nav_value is not None:
        confidence = "HIGH"
    elif estimate_nav and estimate_nav.nav_value is not None:
        confidence = "MID"
    else:
        confidence = "LOW"

    status = "OK"
    if any(flag in {"多源偏差过大", "溢价异常"} for flag in flags):
        status = "WARN"
    if "缺少估值基准" in flags:
        status = "ERROR"

    return status, confidence, flags
