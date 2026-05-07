from __future__ import annotations

from app.domain.models import FundProfile, NavSnapshot


def merge_valuation_sources(
    *,
    profile: FundProfile,
    official_nav: NavSnapshot | None,
    estimate_nav: NavSnapshot | None,
    iopv_nav: NavSnapshot | None,
) -> tuple[float | None, str]:
    if profile.is_etf and iopv_nav and iopv_nav.nav_value is not None:
        return iopv_nav.nav_value, "iopv"
    if estimate_nav and estimate_nav.nav_value is not None:
        return estimate_nav.nav_value, "estimate"
    if official_nav and official_nav.nav_value is not None:
        return official_nav.nav_value, "official"
    return None, "unknown"
