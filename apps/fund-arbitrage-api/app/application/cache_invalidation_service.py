from __future__ import annotations

from app.infrastructure.cache.cache_service import cache_service


def invalidate_fund_related_cache(*, code: str, market_type: str) -> None:
    keys = [
        f"opportunities:detail:{market_type}:{code}",
        f"valuation:latest:{code}",
    ]
    for key in keys:
        cache_service.delete(key)


def invalidate_save_detail_cache(*, code: str, market_type: str, device_id: str | None = None) -> None:
    if device_id:
        cache_service.delete(f"save:detail:{market_type}:{code}:{device_id}")


def invalidate_opportunity_list_cache() -> None:
    common_market_types = ["ALL", "LOF", "ETF"]
    common_levels = ["ALL", "none", "watch", "candidate", "strong"]
    for market_type in common_market_types:
        for level in common_levels:
            cache_service.delete(f"opportunities:list:{market_type}:{level}")
    for limit in (3, 5, 10):
        cache_service.delete(f"opportunities:highlights:{limit}")


def invalidate_all_for_fund(*, code: str, market_type: str, device_id: str | None = None) -> None:
    invalidate_fund_related_cache(code=code, market_type=market_type)
    invalidate_save_detail_cache(code=code, market_type=market_type, device_id=device_id)
    invalidate_opportunity_list_cache()
