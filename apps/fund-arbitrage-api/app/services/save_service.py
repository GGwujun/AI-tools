from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, timedelta
from typing import Iterator

import logging
import time

from sqlalchemy import select

from app.application.fund_refresh_service import refresh_snapshot_detail
from app.application import arbitrage_backfill_service
from app.application.cache_invalidation_service import invalidate_all_for_fund, invalidate_opportunity_list_cache, invalidate_save_detail_cache
from app.application.task_run_service import finish_task, start_task
from app.config import DETAIL_STALE_SECONDS
from app.database import SessionLocal
from app.config import DETAIL_CACHE_TTL_SECONDS
from app.db_models import FundNavHistory, FundSnapshot, SyncStatus, UserFavorite, UserSettings
from app.infrastructure.cache.cache_service import cache_service
from app.models.save import (
    AdvancedSettings,
    ArbitrageStrategy,
    BasicSettings,
    BondDetailBond,
    BondDetailConclusion,
    BondDetailResponse,
    BondRiskItem,
    BondStrategyCard,
    FavoriteUpdateResponse,
    FiveLevelData,
    FiveLevelItem,
    HistoricalArbitrageStats,
    NavHistoryItem,
    FeeProfileSummary,
    QualitySummary,
    QdiiSummary,
    RiskSummary,
    RhythmReference,
    SaveAiAnalysisResponse,
    SaveAiSource,
    SaveAiTab,
    SaveCalendarEvent,
    SaveCalendarEventItem,
    SaveCalendarFilter,
    SaveCalendarMarker,
    SaveCalendarResponse,
    SaveFundDetailResponse,
    SaveFundItem,
    SaveFundListResponse,
    SaveFundListStats,
    SaveFilterOptionGroup,
    SaveFilterOptionsResponse,
    SaveHomeResponse,
    SaveOverviewItem,
    SaveProfileAction,
    SaveProfileResponse,
    SaveProfileServiceItem,
    SaveSection,
    SaveSyncStatus,
    SaveTabItem,
    SaveWatchlistItem,
    SaveWatchlistResponse,
    SettingsResponse,
    ValuationSummary,
)
from app.services import arbitrage_service, bond_service, fund_service


SYNC_JOB_NAME = "fund_sync"

logger = logging.getLogger(__name__)

TAB_META = {
    "stock_lof": SaveTabItem(
        key="stock_lof",
        name="股票型LOF",
        description="主动权益类和普通 LOF，适合观察折溢价与申购状态。",
        note="灰底表示当日可能暂停申购，请以基金公告为准。",
    ),
    "index_lof": SaveTabItem(
        key="index_lof",
        name="指数型LOF",
        description="指数型 LOF，适合观察场内价格与净值偏离。",
        note="优先关注流动性、申购限制和海外指数波动。",
    ),
    "opportunity": SaveTabItem(
        key="opportunity",
        name="套利机会",
        description="当前数据中溢价较高的基金，按溢价率自动排序。",
        note="列表按实时溢价从高到低排序。",
    ),
    "no_gap_etf": SaveTabItem(
        key="no_gap_etf",
        name="无时差ETF",
        description="以跨时区指数相关 ETF 为主，便于观察非 A 股时段波动。",
        note="非交易时段也可能受海外市场影响。",
    ),
    "favorites": SaveTabItem(
        key="favorites",
        name="我的自选",
        description="你已关注的基金会集中展示在这里。",
        note="自选状态按设备维度保存。",
    ),
}

DEFAULT_BASIC_SETTINGS = BasicSettings().model_dump()
DEFAULT_ADVANCED_SETTINGS = AdvancedSettings().model_dump()
WARM_DETAIL_KEYS = {
    ("LOF", "163406"),
    ("LOF", "163408"),
    ("LOF", "166009"),
    ("LOF", "501064"),
    ("LOF", "501188"),
    ("LOF", "160632"),
    ("ETF", "513100"),
    ("ETF", "513500"),
}


def _normalize_tab(tab: str) -> str:
    if tab == "etf":
        return "no_gap_etf"
    if tab == "bond":
        return "bond"
    return tab if tab in TAB_META else "stock_lof"


@contextmanager
def session_scope() -> Iterator:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _format_datetime(value: datetime | None) -> str | None:
    return value.strftime("%Y-%m-%d %H:%M:%S") if value else None


def _format_date(value: date | None) -> str | None:
    return value.strftime("%Y-%m-%d") if value else None


def _format_price(value: float | None) -> str:
    return "--" if value is None else f"{value:.3f}"


def _format_premium(value: float | None) -> str:
    if value is None:
        return "--"
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.2f}%"


def _format_change(value: float | None) -> str:
    if value is None:
        return "--"
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.2f}%"


def _safe_float(value: object) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _get_or_create_sync_status(session) -> SyncStatus:
    record = session.get(SyncStatus, SYNC_JOB_NAME)
    if record is None:
        record = SyncStatus(job_name=SYNC_JOB_NAME, status="idle", message="")
        session.add(record)
        session.flush()
    return record


def _sync_status_model(record: SyncStatus | None) -> SaveSyncStatus:
    if record is None:
        return SaveSyncStatus()
    return SaveSyncStatus(
        status=record.status,
        message=record.message,
        last_started_at=_format_datetime(record.last_started_at),
        last_success_at=_format_datetime(record.last_success_at),
        last_finished_at=_format_datetime(record.last_finished_at),
        last_synced_count=record.last_synced_count,
    )


def _get_or_create_user_settings(session, device_id: str) -> UserSettings:
    record = session.get(UserSettings, device_id)
    if record is None:
        record = UserSettings(
            device_id=device_id,
            basic_settings=DEFAULT_BASIC_SETTINGS.copy(),
            advanced_settings=DEFAULT_ADVANCED_SETTINGS.copy(),
            updated_at=datetime.utcnow(),
        )
        session.add(record)
        session.flush()
    return record


def _favorite_pairs(session, device_id: str) -> set[tuple[str, str]]:
    rows = session.execute(
        select(UserFavorite.code, UserFavorite.market_type).where(UserFavorite.device_id == device_id)
    ).all()
    return {(code, market_type) for code, market_type in rows}


def _favorite_count(session, device_id: str) -> int:
    return len(_favorite_pairs(session, device_id))


def _build_market_lookup(records: list[dict]) -> dict[str, dict]:
    return {record["code"]: record for record in records}


def _collect_market_records() -> dict[str, dict[str, dict]]:
    # 清除缓存，确保获取最新数据
    fund_service.get_lof_fund_list_bulk.cache_clear()
    fund_service.get_etf_fund_list_bulk.cache_clear()
    fund_service.get_purchase_limit_data.cache_clear()
    # 清除其他缓存帧（与现有 _estimated_nav_frame 等保持一致）
    fund_service._estimated_nav_frame.cache_clear()
    fund_service._etf_spot_frame.cache_clear()
    fund_service._fund_fee_frame.cache_clear()

    lof_df = fund_service.get_lof_fund_list_bulk()
    etf_df = fund_service.get_etf_fund_list_bulk()
    purchase_df = fund_service.get_purchase_limit_data()

    # 合入申购限额数据
    purchase_lookup: dict[str, dict] = {}
    if not purchase_df.empty:
        purchase_lookup = _build_market_lookup(purchase_df.to_dict("records"))

    lof_records = _build_market_lookup(lof_df.to_dict("records"))
    for code, rec in lof_records.items():
        if code in purchase_lookup:
            p = purchase_lookup[code]
            rec["purchase_limit_amount"] = p.get("purchase_limit_amount")
            rec["purchase_limit_display"] = fund_service.format_limit(p.get("purchase_limit_amount"))
            rec["purchase_status"] = p.get("purchase_status", "")
            rec["nav_from_purchase"] = p.get("nav_from_purchase")

    etf_records = _build_market_lookup(etf_df.to_dict("records"))
    for code, rec in etf_records.items():
        if code in purchase_lookup:
            p = purchase_lookup[code]
            rec["purchase_limit_amount"] = p.get("purchase_limit_amount")
            rec["purchase_limit_display"] = fund_service.format_limit(p.get("purchase_limit_amount"))
            rec["purchase_status"] = p.get("purchase_status", "")
            rec["nav_from_purchase"] = p.get("nav_from_purchase")

    return {"LOF": lof_records, "ETF": etf_records}


def _infer_tab_tags(name: str, market_type: str, is_no_gap: bool, fund_type: str = "") -> list[str]:
    text = f"{name} {fund_type}"
    tags: list[str] = []
    if market_type == "ETF":
        if is_no_gap:
            tags.append("no_gap_etf")
    else:
        if any(keyword in text for keyword in ("指数", "ETF", "QDII")):
            tags.append("index_lof")
        else:
            tags.append("stock_lof")
    return tags


def _snapshot_to_item(snapshot: FundSnapshot, favorite_pairs: set[tuple[str, str]]) -> SaveFundItem:
    return SaveFundItem(
        code=snapshot.code,
        market_type=snapshot.market_type,
        name=snapshot.name,
        market=snapshot.market,
        market_price=snapshot.market_price,
        market_price_display=_format_price(snapshot.market_price),
        market_change_pct=snapshot.market_change_pct,
        market_change_display=_format_change(snapshot.market_change_pct),
        nav_price=snapshot.nav_price,
        nav_price_display=_format_price(snapshot.nav_price),
        premium_rate=snapshot.premium_rate,
        premium_display=_format_premium(snapshot.premium_rate),
        estimate_premium_rate=snapshot.estimate_premium_rate,
        estimate_premium_rate_display=_format_premium(snapshot.estimate_premium_rate),
        up=(snapshot.premium_rate or 0) >= 0,
        starred=(snapshot.code, snapshot.market_type) in favorite_pairs,
        paused=snapshot.is_paused,
        down_days=snapshot.down_days,
        max_down_days=snapshot.max_down_days,
        fund_state=snapshot.fund_state,
        fund_type=snapshot.fund_type,
        purchase_limit_display=snapshot.purchase_limit_display,
        purchase_status=snapshot.fund_state,
        is_no_gap=snapshot.is_no_gap,
        market_time=_format_datetime(snapshot.market_time),
        nav_date=_format_date(snapshot.nav_date),
    )


def _bond_to_fund_item(code: str, name: str, price: float | None, premium_rate: float | None, starred: bool = False) -> SaveFundItem:
    return SaveFundItem(
        code=code,
        market_type="bond",
        name=name,
        market="SZ",
        market_price=price,
        market_price_display=_format_price(price),
        market_change_pct=None,
        market_change_display="--",
        nav_price=None,
        nav_price_display="--",
        premium_rate=premium_rate,
        premium_display=_format_premium(premium_rate),
        up=(premium_rate or 0) >= 0,
        starred=starred,
        paused=False,
        down_days=0,
        max_down_days=0,
        fund_state="可继续观察",
        fund_type="可转债",
        is_no_gap=False,
        market_time=_format_datetime(datetime.utcnow()),
        nav_date=None,
    )


def _bond_watchlist_item(code: str, name: str, price: float | None, premium_rate: float | None, starred: bool = False) -> SaveWatchlistItem:
    return SaveWatchlistItem(
        code=code,
        name=name,
        type="bond",
        market_type="bond",
        change=_format_premium(premium_rate),
        subtitle="可继续跟踪",
        time=_format_datetime(datetime.utcnow()) or "--",
        badge="重点观察",
        chart=[14, 17, 19, 18, 21, 23, 25, 27],
        chart_color="#20a066",
        starred=starred,
    )


def _bond_list_items(limit: int = 8, favorite_codes: set[str] | None = None) -> list[SaveFundItem]:
    favorite_codes = favorite_codes or set()
    response = bond_service.get_bond_subscribe_list()
    items: list[SaveFundItem] = []
    for entry in response.items[:limit]:
        items.append(
            _bond_to_fund_item(
                code=entry.code,
                name=entry.name,
                price=entry.reference_price,
                premium_rate=entry.premium_rate,
                starred=entry.code in favorite_codes,
            )
        )
    return items


def _special_notes_for_funds(funds: list[FundSnapshot]) -> list[str]:
    return [f"{fund.name}({fund.code}) {fund.fund_state}" for fund in funds if fund.is_paused and fund.fund_state]


def _sort_snapshots(funds: list[FundSnapshot]) -> list[FundSnapshot]:
    return sorted(
        funds,
        key=lambda item: (
            item.premium_rate is None,
            -(item.premium_rate or -9999),
            item.code,
        ),
    )


def _update_summary_fields(snapshot: FundSnapshot, market_record: dict, market_type: str) -> None:
    snapshot.name = market_record.get("name") or snapshot.name or snapshot.code
    snapshot.market = market_record.get("market", "")
    snapshot.market_price = _safe_float(market_record.get("market_price"))
    snapshot.market_change_pct = _safe_float(market_record.get("market_change_pct"))
    snapshot.market_time = datetime.utcnow()
    snapshot.is_no_gap = bool(market_record.get("is_no_gap"))
    # 批量行情扩展字段
    snapshot.volume = _safe_float(market_record.get("volume"))
    snapshot.amount = _safe_float(market_record.get("amount"))
    snapshot.open_price = _safe_float(market_record.get("open_price"))
    snapshot.high_price = _safe_float(market_record.get("high_price"))
    snapshot.low_price = _safe_float(market_record.get("low_price"))
    snapshot.prev_close = _safe_float(market_record.get("prev_close"))
    snapshot.total_market_cap = _safe_float(market_record.get("total_market_cap"))
    # 申购限额
    snapshot.purchase_limit_amount = _safe_float(market_record.get("purchase_limit_amount"))
    snapshot.purchase_limit_display = market_record.get("purchase_limit_display") or "--"
    # 批量净值预填（仅在 nav_price 为空时）
    if market_record.get("nav_from_purchase") and not snapshot.nav_price:
        snapshot.nav_price = _safe_float(market_record.get("nav_from_purchase"))
    if snapshot.market_price and snapshot.nav_price and snapshot.nav_price > 0:
        snapshot.premium_rate = round((snapshot.market_price - snapshot.nav_price) / snapshot.nav_price * 100, 2)
    if not snapshot.fund_type:
        snapshot.fund_type = market_type
    snapshot.tab_tags = _infer_tab_tags(snapshot.name, market_type, snapshot.is_no_gap, snapshot.fund_type)
    snapshot.updated_at = datetime.utcnow()


def _upsert_summary_snapshot(session, market_type: str, code: str, market_record: dict) -> FundSnapshot:
    snapshot = session.execute(
        select(FundSnapshot).where(
            FundSnapshot.code == code,
            FundSnapshot.market_type == market_type,
        )
    ).scalar_one_or_none()
    if snapshot is None:
        snapshot = FundSnapshot(code=code, market_type=market_type, name=market_record.get("name") or code)
        session.add(snapshot)
        session.flush()
    _update_summary_fields(snapshot, market_record, market_type)
    return snapshot


def _apply_detail_fields(session, snapshot: FundSnapshot, market_record: dict | None = None) -> None:
    if market_record:
        _update_summary_fields(snapshot, market_record, snapshot.market_type)
    refresh_snapshot_detail(session, snapshot, market_record)


def _select_warm_targets(session) -> list[FundSnapshot]:
    snapshots = session.execute(select(FundSnapshot).order_by(FundSnapshot.market_type, FundSnapshot.code)).scalars().all()
    favorites = session.execute(select(UserFavorite.code, UserFavorite.market_type).distinct()).all()
    favorite_keys = {(code, market_type) for code, market_type in favorites}

    stock_candidates = [item for item in snapshots if "stock_lof" in (item.tab_tags or [])][:20]
    index_candidates = [item for item in snapshots if "index_lof" in (item.tab_tags or [])][:20]
    nogap_candidates = [item for item in snapshots if "no_gap_etf" in (item.tab_tags or [])][:20]

    selected: list[FundSnapshot] = []
    seen: set[tuple[str, str]] = set()
    for item in snapshots:
        key = (item.market_type, item.code)
        if key in WARM_DETAIL_KEYS or key in favorite_keys:
            if key not in seen:
                selected.append(item)
                seen.add(key)

    for bucket in (stock_candidates, index_candidates, nogap_candidates):
        for item in bucket:
            key = (item.market_type, item.code)
            if key not in seen:
                selected.append(item)
                seen.add(key)

    return selected


def refresh_all_data() -> SaveSyncStatus:
    task_id = start_task(task_name="refresh_all_data", message="syncing fund data")
    with session_scope() as session:
        sync_status = _get_or_create_sync_status(session)
        sync_status.status = "running"
        sync_status.message = "正在同步基金数据"
        sync_status.last_started_at = datetime.utcnow()

    synced_count = 0
    try:
        market_records = _collect_market_records()
        with session_scope() as session:
            for market_type, records in market_records.items():
                for code, record in records.items():
                    _upsert_summary_snapshot(session, market_type, code, record)
                    synced_count += 1

            warm_targets = _select_warm_targets(session)
            detail_budget = 300  # 5 分钟总时间预算
            detail_start = time.monotonic()
            for i, snapshot in enumerate(warm_targets):
                elapsed = time.monotonic() - detail_start
                if elapsed > detail_budget:
                    logger.warning(f"Detail refresh 时间预算耗尽 ({elapsed:.1f}s), 跳过剩余 {len(warm_targets) - i} 只基金")
                    break
                record = market_records.get(snapshot.market_type, {}).get(snapshot.code)
                _apply_detail_fields(session, snapshot, record)

            sync_status = _get_or_create_sync_status(session)
            sync_status.status = "success"
            sync_status.message = "基金数据同步完成"
            sync_status.last_success_at = datetime.utcnow()
            sync_status.last_finished_at = datetime.utcnow()
            sync_status.last_synced_count = synced_count
            result = _sync_status_model(sync_status)
        invalidate_opportunity_list_cache()
        arbitrage_backfill_service.rebuild_all()
        finish_task(task_id=task_id, status="success", processed_count=synced_count, failed_count=0, message="fund data sync finished")
        return result
    except Exception as exc:
        finish_task(task_id=task_id, status="failed", processed_count=synced_count, failed_count=1, message=str(exc))
        with session_scope() as session:
            sync_status = _get_or_create_sync_status(session)
            sync_status.status = "failed"
            sync_status.message = f"同步失败: {exc}"
            sync_status.last_finished_at = datetime.utcnow()
            sync_status.last_synced_count = synced_count
            return _sync_status_model(sync_status)


def get_sync_status() -> SaveSyncStatus:
    with session_scope() as session:
        return _sync_status_model(session.get(SyncStatus, SYNC_JOB_NAME))


def _detail_is_stale(snapshot: FundSnapshot) -> bool:
    if snapshot.detail_updated_at is None:
        return True
    return snapshot.detail_updated_at < datetime.utcnow() - timedelta(seconds=DETAIL_STALE_SECONDS)


def refresh_single_fund(code: str, market_type: str) -> None:
    with session_scope() as session:
        snapshot = session.execute(
            select(FundSnapshot).where(
                FundSnapshot.code == code,
                FundSnapshot.market_type == market_type,
            )
        ).scalar_one_or_none()

        market_record = None
        if snapshot is None:
            market_records = _collect_market_records()
            market_record = market_records.get(market_type, {}).get(code)
            if market_record is None:
                return
            snapshot = _upsert_summary_snapshot(session, market_type, code, market_record)

        _apply_detail_fields(session, snapshot, market_record)
    arbitrage_backfill_service.rebuild_for_fund(code=code, market_type=market_type)


def get_fund_list(tab: str, device_id: str, page: int = 1, page_size: int = 20) -> SaveFundListResponse:
    tab = _normalize_tab(tab)

    with session_scope() as session:
        snapshots = session.execute(select(FundSnapshot)).scalars().all()
        favorite_pairs = _favorite_pairs(session, device_id)
        favorite_codes = {code for code, _market_type in favorite_pairs}

        if tab == "bond":
            funds_items = _bond_list_items(limit=50, favorite_codes=favorite_codes)
            total = len(funds_items)
            start = max(0, (page - 1) * page_size)
            paged_bonds = funds_items[start : start + page_size]
            sync_status = _sync_status_model(session.get(SyncStatus, SYNC_JOB_NAME))
            return SaveFundListResponse(
                success=True,
                current_tab=tab,
                tabs=list(TAB_META.values()),
                funds=paged_bonds,
                special_notes=["可转债机会仅供参考，请结合公告、流动性与条款变化综合观察。"],
                update_time=_format_datetime(datetime.utcnow()),
                page=page,
                page_size=page_size,
                total=total,
                has_more=start + len(paged_bonds) < total,
                stats=SaveFundListStats(current_count=total, favorite_count=len(favorite_pairs)),
                sync_status=sync_status,
            )

        if tab == "favorites":
            funds = [item for item in snapshots if (item.code, item.market_type) in favorite_pairs]
        elif tab in {"opportunity", "stock_lof", "index_lof", "no_gap_etf"}:
            if tab == "opportunity":
                funds = [item for item in snapshots if item.premium_rate is not None and item.premium_rate > 0]
            elif tab == "index_lof":
                funds = [item for item in snapshots if tab in (item.tab_tags or []) and item.market_type == "LOF"]
            elif tab == "no_gap_etf":
                funds = [item for item in snapshots if tab in (item.tab_tags or []) and item.market_type == "ETF"]
            else:
                funds = [item for item in snapshots if tab in (item.tab_tags or [])]
        else:
            funds = [item for item in snapshots if item.premium_rate is not None and item.premium_rate > 0]

        funds = _sort_snapshots(funds)
        sync_status = _sync_status_model(session.get(SyncStatus, SYNC_JOB_NAME))
        last_update = max((item.updated_at for item in funds), default=None)
        total = len(funds)
        start = max(0, (page - 1) * page_size)
        paged_funds = funds[start : start + page_size]

        return SaveFundListResponse(
            success=True,
            current_tab=tab,
            tabs=list(TAB_META.values()),
            funds=[_snapshot_to_item(item, favorite_pairs) for item in paged_funds],
            special_notes=_special_notes_for_funds(funds),
            update_time=_format_datetime(last_update) or sync_status.last_success_at,
            page=page,
            page_size=page_size,
            total=total,
            has_more=start + len(paged_funds) < total,
            stats=SaveFundListStats(current_count=len(funds), favorite_count=len(favorite_pairs)),
            sync_status=sync_status,
        )


def get_fund_detail(code: str, market_type: str, device_id: str) -> SaveFundDetailResponse | None:
    cache_key = f"save:detail:{market_type}:{code}:{device_id}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return SaveFundDetailResponse(**cached)

    with session_scope() as session:
        snapshot = session.execute(
            select(FundSnapshot).where(
                FundSnapshot.code == code,
                FundSnapshot.market_type == market_type,
            )
        ).scalar_one_or_none()

    if snapshot is None:
        refresh_single_fund(code, market_type)
        with session_scope() as session:
            snapshot = session.execute(
                select(FundSnapshot).where(
                    FundSnapshot.code == code,
                    FundSnapshot.market_type == market_type,
                )
            ).scalar_one_or_none()
        if snapshot is None:
            return None

    if _detail_is_stale(snapshot):
        refresh_single_fund(code, market_type)

    with session_scope() as session:
        snapshot = session.execute(
            select(FundSnapshot).where(
                FundSnapshot.code == code,
                FundSnapshot.market_type == market_type,
            )
        ).scalar_one()
        favorite_pairs = _favorite_pairs(session, device_id)
        history_rows = session.execute(
            select(FundNavHistory)
            .where(FundNavHistory.fund_id == snapshot.id)
            .order_by(FundNavHistory.nav_date.desc())
        ).scalars().all()
        sync_status = _sync_status_model(session.get(SyncStatus, SYNC_JOB_NAME))
        detail_payload = snapshot.detail_payload or {}
        five_level_payload = detail_payload.get("five_level", {})
        historical_stats_payload = detail_payload.get("historical_stats", {})
        rhythm_payload = detail_payload.get("rhythm", {})
        risk_payload = detail_payload.get("risk", {})
        strategy_payload = detail_payload.get("strategies")
        if strategy_payload is None:
            strategy_payload = arbitrage_service.get_arbitrage_strategies(
                snapshot.code,
                snapshot.market_type,
                current_price=snapshot.market_price,
                nav_price=snapshot.nav_price,
                premium_rate=snapshot.premium_rate,
            )

        response = SaveFundDetailResponse(
            success=True,
            update_time=_format_datetime(snapshot.detail_updated_at) or _format_datetime(snapshot.updated_at),
            sync_status=sync_status,
            fund=_snapshot_to_item(snapshot, favorite_pairs),
            five_level=FiveLevelData(
                update_time=five_level_payload.get("update_time"),
                bid=[FiveLevelItem(**item) for item in five_level_payload.get("bid", [])],
                ask=[FiveLevelItem(**item) for item in five_level_payload.get("ask", [])],
            ),
            nav_history=[
                NavHistoryItem(
                    date=item.nav_date.strftime("%Y-%m-%d"),
                    nav=item.nav_price,
                    nav_change=_format_change(item.nav_change_pct),
                    premium=_format_change(item.premium_rate),
                    estimated_profit=_format_change(item.estimated_profit_pct),
                )
                for item in history_rows
            ],
            arbitrage_strategies=[ArbitrageStrategy(**item) for item in strategy_payload],
            historical_stats=HistoricalArbitrageStats(
                start_date=historical_stats_payload.get("start_date"),
                trigger_count=historical_stats_payload.get("trigger_count", 0),
                success_rate=_format_premium((historical_stats_payload.get("success_rate") or 0.0) * 100) if historical_stats_payload.get("success_rate") is not None else "--",
                occurrence_probability=_format_premium((historical_stats_payload.get("occurrence_probability") or 0.0) * 100) if historical_stats_payload.get("occurrence_probability") is not None else "--",
                avg_return_rate=_format_premium(historical_stats_payload.get("avg_return_rate")),
            ),
            rhythm=RhythmReference(
                expected_confirm_date=rhythm_payload.get("expected_confirm_date"),
                expected_arrival_date=rhythm_payload.get("expected_arrival_date"),
                expected_sell_date=rhythm_payload.get("expected_sell_date"),
            ),
            risk=RiskSummary(
                risk_score=risk_payload.get("risk_score", 0.0),
                risk_level=risk_payload.get("risk_level", "MID"),
                risk_tags=risk_payload.get("risk_tags", []),
            ),
            quality=QualitySummary(
                data_quality_status=detail_payload.get("quality", {}).get("data_quality_status", "OK"),
                quality_flags=detail_payload.get("quality", {}).get("quality_flags", []),
                confidence_level=detail_payload.get("quality", {}).get("confidence_level", "LOW"),
                valuation_source_code=detail_payload.get("quality", {}).get("valuation_source_code", ""),
            ),
            fee_profile=FeeProfileSummary(
                source=detail_payload.get("fee_profile", {}).get("source", ""),
                fee_text=detail_payload.get("fee_profile", {}).get("fee_text", ""),
                purchase_fee_rate=detail_payload.get("fee_profile", {}).get("purchase_fee_rate"),
                redemption_fee_rate=detail_payload.get("fee_profile", {}).get("redemption_fee_rate"),
                management_fee_rate=detail_payload.get("fee_profile", {}).get("management_fee_rate"),
                custody_fee_rate=detail_payload.get("fee_profile", {}).get("custody_fee_rate"),
                service_fee_rate=detail_payload.get("fee_profile", {}).get("service_fee_rate"),
            ),
            valuation=ValuationSummary(
                official_nav_source=detail_payload.get("valuation", {}).get("official_nav_source", ""),
                estimate_nav_source=detail_payload.get("valuation", {}).get("estimate_nav_source", ""),
                iopv_source=detail_payload.get("valuation", {}).get("iopv_source", ""),
                estimate_nav_value=detail_payload.get("valuation", {}).get("estimate_nav_value"),
                iopv_nav_value=detail_payload.get("valuation", {}).get("iopv_nav_value"),
                estimate_premium_rate=detail_payload.get("valuation", {}).get("estimate_premium_rate"),
            ),
            qdii=QdiiSummary(
                is_qdii=detail_payload.get("qdii", {}).get("is_qdii", False),
                is_cross_border=detail_payload.get("qdii", {}).get("is_cross_border", False),
                calendar_market=detail_payload.get("qdii", {}).get("calendar_market", "CN"),
                arbitrage_category=detail_payload.get("qdii", {}).get("arbitrage_category", ""),
                underlying_index_code=detail_payload.get("qdii", {}).get("underlying_index_code", ""),
            ),
            scale=snapshot.scale,
            turnover=snapshot.turnover,
        )
        cache_service.set_json(cache_key, response.model_dump(mode="json"), DETAIL_CACHE_TTL_SECONDS)
        return response


def get_settings(device_id: str) -> SettingsResponse:
    with session_scope() as session:
        record = _get_or_create_user_settings(session, device_id)
        return SettingsResponse(
            success=True,
            update_time=_format_datetime(record.updated_at) or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            basic_settings=BasicSettings(**(record.basic_settings or DEFAULT_BASIC_SETTINGS)),
            advanced_settings=AdvancedSettings(**(record.advanced_settings or DEFAULT_ADVANCED_SETTINGS)),
        )


def update_basic_settings(device_id: str, payload: BasicSettings) -> SettingsResponse:
    with session_scope() as session:
        record = _get_or_create_user_settings(session, device_id)
        record.basic_settings = payload.model_dump()
        record.updated_at = datetime.utcnow()
    return get_settings(device_id)


def update_advanced_settings(device_id: str, payload: AdvancedSettings) -> SettingsResponse:
    with session_scope() as session:
        record = _get_or_create_user_settings(session, device_id)
        record.advanced_settings = payload.model_dump()
        record.updated_at = datetime.utcnow()
    return get_settings(device_id)


def update_favorite(device_id: str, code: str, market_type: str, starred: bool) -> FavoriteUpdateResponse:
    with session_scope() as session:
        normalized_market_type = market_type.upper()
        if normalized_market_type != "BOND":
            snapshot = session.execute(
                select(FundSnapshot).where(
                    FundSnapshot.code == code,
                    FundSnapshot.market_type == normalized_market_type,
                )
            ).scalar_one_or_none()
            if snapshot is None:
                raise ValueError("fund_not_found")

        favorite = session.execute(
            select(UserFavorite).where(
                UserFavorite.device_id == device_id,
                UserFavorite.code == code,
                UserFavorite.market_type == normalized_market_type,
            )
        ).scalar_one_or_none()

        if starred and favorite is None:
            session.add(UserFavorite(device_id=device_id, code=code, market_type=normalized_market_type))
        if not starred and favorite is not None:
            session.delete(favorite)
    invalidate_all_for_fund(code=code, market_type=normalized_market_type, device_id=device_id)

    with session_scope() as session:
        return FavoriteUpdateResponse(success=True, starred=starred, favorite_count=_favorite_count(session, device_id))


def get_home(tab: str, device_id: str) -> SaveHomeResponse:
    current_tab = _normalize_tab(tab or "stock_lof")
    with session_scope() as session:
        all_snapshots = session.execute(select(FundSnapshot)).scalars().all()
        favorite_pairs = _favorite_pairs(session, device_id)
        favorite_codes = {code for code, _market_type in favorite_pairs}
        sync_status = _sync_status_model(session.get(SyncStatus, SYNC_JOB_NAME))

        stock_lof = _sort_snapshots([item for item in all_snapshots if "stock_lof" in (item.tab_tags or []) and item.market_type == "LOF"])[:3]
        index_lof = _sort_snapshots([item for item in all_snapshots if "index_lof" in (item.tab_tags or []) and item.market_type == "LOF"])[:1]
        etf_items = _sort_snapshots([item for item in all_snapshots if "no_gap_etf" in (item.tab_tags or []) and item.market_type == "ETF"])[:1]

        bond_items = _bond_list_items(limit=2, favorite_codes=favorite_codes)
        featured_funds = (_sort_snapshots([item for item in all_snapshots if item.premium_rate is not None and item.premium_rate > 0])[:3]) or stock_lof[:2]
        featured = [*_snapshot_to_item_list(featured_funds, favorite_pairs), *bond_items][:4]
        sections = [
            SaveSection(key="stock_lof", title="股票型LOF 今日机会", items=[_snapshot_to_item(item, favorite_pairs) for item in stock_lof]),
            SaveSection(key="index_lof", title="指数型LOF 今日机会", items=[_snapshot_to_item(item, favorite_pairs) for item in index_lof]),
            SaveSection(key="etf", title="无时差ETF 今日机会", items=[_snapshot_to_item(item, favorite_pairs) for item in etf_items]),
            SaveSection(key="bond", title="可转债 今日机会", items=bond_items),
        ]

        return SaveHomeResponse(
            success=True,
            update_time=sync_status.last_success_at or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            risk_notice="以下内容基于公开数据与规则模型整理，仅供参考。",
            current_tab=current_tab,
            tabs=list(TAB_META.values()),
            overview=[
                SaveOverviewItem(label="可关注机会", value=str(len([item for item in all_snapshots if (item.premium_rate or 0) > 0])), note="实时更新"),
                SaveOverviewItem(label="高溢价信号", value=str(len([item for item in all_snapshots if (item.premium_rate or 0) > 1.5])), note="观察阈值"),
                SaveOverviewItem(label="无时差ETF", value=str(len([item for item in all_snapshots if item.is_no_gap])), note="跨市场观察"),
                SaveOverviewItem(label="风险变化", value=str(len([item for item in all_snapshots if item.is_paused])), note="状态提示"),
            ],
            ai_summary="当前机会分布较均衡，建议结合历史回测、估值误差和风险提示综合观察。",
            featured=featured,
            sections=sections,
        )


def _snapshot_to_item_list(items: list[FundSnapshot], favorite_pairs: set[tuple[str, str]]) -> list[SaveFundItem]:
    return [_snapshot_to_item(item, favorite_pairs) for item in items]


def get_watchlist(device_id: str) -> SaveWatchlistResponse:
    with session_scope() as session:
        snapshots = session.execute(select(FundSnapshot)).scalars().all()
        favorite_pairs = _favorite_pairs(session, device_id)
        watched = [item for item in snapshots if (item.code, item.market_type) in favorite_pairs]
        watched = _sort_snapshots(watched)
        items: list[SaveWatchlistItem] = [
            SaveWatchlistItem(
                code=item.code,
                name=item.name,
                type="fund",
                market_type=item.market_type,
                change=_format_premium(item.premium_rate),
                subtitle="重点观察中" if not item.is_paused else "状态需留意",
                time=_format_datetime(item.updated_at) or "--",
                badge="可继续跟踪" if not item.is_paused else "状态变化",
                chart=[12, 14, 16, 18, 20, 22, 19, 24],
                chart_color="#3bb88f" if (item.premium_rate or 0) >= 0 else "#ff6655",
                starred=True,
            )
            for item in watched[:20]
        ]
        bond_codes = {code for code, market_type in favorite_pairs if market_type.upper() == "BOND" or market_type.lower() == "bond"}
        if bond_codes:
            subscribe_list = bond_service.get_bond_subscribe_list()
            for entry in subscribe_list.items:
                if entry.code in bond_codes:
                    items.append(
                        _bond_watchlist_item(
                            code=entry.code,
                            name=entry.name,
                            price=entry.reference_price,
                            premium_rate=entry.premium_rate,
                            starred=True,
                        )
                    )
        return SaveWatchlistResponse(
            success=True,
            update_time=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            summary={
                "funds": len(watched),
                "bonds": len([item for item in items if item.type == "bond"]),
                "changed": len([item for item in watched if (item.premium_rate or 0) > 1]),
                "pending": len([item for item in watched if item.is_paused]) + len([item for item in items if item.type == "bond"]),
            },
            items=items,
        )


def get_calendar(filter_key: str, device_id: str) -> SaveCalendarResponse:
    today = datetime.utcnow().date()
    return SaveCalendarResponse(
        success=True,
        update_time=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        month=today.strftime("%Y年%m月"),
        filters=[
            SaveCalendarFilter(key="all", label="全部"),
            SaveCalendarFilter(key="arrival", label="基金到账"),
            SaveCalendarFilter(key="sell", label="基金卖点"),
            SaveCalendarFilter(key="new-bond", label="新债"),
            SaveCalendarFilter(key="redeem", label="强赎"),
        ],
        selected_filter=filter_key or "all",
        weeks=[
            ["", "", "", "", "1", "2", "3"],
            ["4", "5", "6", "7", "8", "9", "10"],
            ["11", "12", "13", "14", "15", "16", "17"],
            ["18", "19", "20", "21", "22", "23", "24"],
            ["25", "26", "27", "28", "29", "30", "31"],
        ],
        markers=[
            SaveCalendarMarker(day=today.strftime("%d").lstrip("0"), type="green", label="到账"),
            SaveCalendarMarker(day=str(min(today.day + 2, 28)), type="orange", label="申购"),
        ],
        events=[
            SaveCalendarEvent(
                date=today.strftime("%m月%d日"),
                weekday="今日",
                title="今日重点",
                items=[
                    SaveCalendarEventItem(title="到账节奏跟踪", note="关注预计到账与可卖时间", time="盘后复核", accent="green"),
                    SaveCalendarEventItem(title="高溢价观察", note="关注溢价收敛与拥挤度变化", time="盘中", accent="orange"),
                ],
            )
        ],
    )


def get_profile(device_id: str) -> SaveProfileResponse:
    return SaveProfileResponse(
        success=True,
        profile={"name": f"设备 {device_id}", "level": "普通用户", "member_label": "会员权益"},
        quick_actions=[
            SaveProfileAction(key="favorites", label="我的收藏"),
            SaveProfileAction(key="reminders", label="我的提醒"),
            SaveProfileAction(key="records", label="申购记录"),
            SaveProfileAction(key="messages", label="消息机会"),
        ],
        services=[
            SaveProfileServiceItem(title="风险偏好设置", note="稳健型"),
            SaveProfileServiceItem(title="策略偏好设置", note="节奏参考"),
            SaveProfileServiceItem(title="消息通知设置", note="已开启"),
            SaveProfileServiceItem(title="帮助与反馈", note="常见问题"),
        ],
    )


def get_analysis(tab: str, device_id: str) -> SaveAiAnalysisResponse:
    current_tab = tab or "opportunity"
    mapping = {
        "opportunity": (
            "条件参考解读",
            "当前机会分布较均衡，建议结合历史回测、估值误差和拥挤度变化继续观察。",
            ["条件参考", "估值误差", "拥挤度", "节奏跟踪"],
        ),
        "watchlist": (
            "自选观察解读",
            "自选标的应优先查看状态变化、风险提示和历史统计更新情况。",
            ["自选", "状态变化", "优先级", "风险提示"],
        ),
        "risk": (
            "风险雷达",
            "当前主要风险来自估值偏差、流动性不足和拥挤度抬升，仅供参考。",
            ["估值误差", "流动性", "拥挤度", "数据质量"],
        ),
        "weekly": (
            "本周总结",
            "本周更适合观察条件变化与节奏跟踪，而不是放大单一高溢价信号。",
            ["周度复盘", "节奏跟踪", "条件变化", "风险复核"],
        ),
    }
    title, content, keywords = mapping.get(current_tab, mapping["opportunity"])
    return SaveAiAnalysisResponse(
        success=True,
        tabs=[
            SaveAiTab(key="opportunity", label="机会解读"),
            SaveAiTab(key="watchlist", label="自选解读"),
            SaveAiTab(key="risk", label="风险雷达"),
            SaveAiTab(key="weekly", label="本周总结"),
        ],
        current_tab=current_tab,
        title=title,
        content=content,
        source=SaveAiSource(author="系统规则引擎", time=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"), likes=0, dislikes=0),
        keywords=keywords,
    )


def get_filter_options(device_id: str) -> SaveFilterOptionsResponse:
    return SaveFilterOptionsResponse(
        success=True,
        groups=[
            SaveFilterOptionGroup(title="机会类型", options=["全部", "LOF", "ETF", "QDII", "可转债"], selected=["全部"]),
            SaveFilterOptionGroup(title="一级分类", options=["全部", "股票型LOF", "指数型LOF", "无时差ETF"], selected=["股票型LOF"]),
            SaveFilterOptionGroup(title="状态", options=["全部", "可申购", "限额开放", "暂停申购", "可T+0"], selected=["可申购"]),
            SaveFilterOptionGroup(title="风险评级", options=["全部", "低风险", "中风险", "高风险"], selected=["中风险"]),
            SaveFilterOptionGroup(title="到账周期", options=["全部", "T+1", "T+2", "T+3", "更长"], selected=["全部"]),
        ],
        sort_options=["溢价率（从高到低）", "历史成功率", "到账时间", "热度"],
        selected_sort="溢价率（从高到低）",
    )


def get_bond_detail(code: str) -> BondDetailResponse:
    subscribe_list = bond_service.get_bond_subscribe_list()
    item = next((entry for entry in subscribe_list.items if entry.code == code), subscribe_list.items[0] if subscribe_list.items else None)
    if item is None:
        return BondDetailResponse(
            success=True,
            update_time=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            bond=BondDetailBond(
                code=code,
                name="--",
                stock_name="--",
                tags=[],
                price="--",
                convert_value="--",
                premium_rate="--",
                dual_low="--",
                pure_bond_value="--",
                maturity_yield="--",
                scale="--",
                remain_years="--",
                redeem_status="--",
                last_trade_date="--",
                last_convert_date="--",
            ),
            conclusion=BondDetailConclusion(title="暂无数据", summary="当前暂无可转债详情数据。", risk="仅供参考。"),
            strategy_cards=[],
            risk_items=[],
        )

    premium_text = _format_premium(item.premium_rate)
    convert_value_text = f"{item.convert_value:.2f}" if item.convert_value is not None else "--"
    price_text = f"{item.reference_price:.2f}" if item.reference_price is not None else "--"
    return BondDetailResponse(
        success=True,
        update_time=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        bond=BondDetailBond(
            code=item.code,
            name=item.name,
            stock_name=item.stock_name,
            tags=[tag for tag in [item.limit_tag or "可关注", "仅供参考", item.rating] if tag and tag != "--"],
            price=price_text,
            convert_value=convert_value_text,
            premium_rate=premium_text,
            dual_low=f"{(item.reference_price or 100) + max(item.premium_rate or 0, 0):.1f}",
            pure_bond_value=f"{max((item.reference_price or 100) - 5, 80):.2f}",
            maturity_yield="1.85%",
            scale=item.issue_size,
            remain_years="2.35年",
            redeem_status="低风险观察",
            last_trade_date=item.listing_date or "--",
            last_convert_date=item.pay_date or "--",
        ),
        conclusion=BondDetailConclusion(
            title="当前处于可关注区间，仅供参考",
            summary="主要逻辑来自转股价值、溢价率和可转债基础面信息的综合观察。",
            risk="主要风险来自正股波动、成交拥挤和强赎节奏变化。",
        ),
        strategy_cards=[
            BondStrategyCard(
                title="双低观察",
                summary="更适合跟踪估值与节奏变化，仅供参考。",
                position="适合分批观察",
                exit="后续关注溢价率与成交活跃度变化",
                risk="正股回撤会影响弹性表现",
            ),
            BondStrategyCard(
                title="节奏跟踪",
                summary="若临近强赎或估值变化明显，应优先处理时间风险。",
                position="更适合谨慎观察",
                exit="重点关注最后交易日与最后转股日",
                risk="忽略节奏可能导致被动风险",
            ),
        ],
        risk_items=[
            BondRiskItem(label="转股溢价率", value=premium_text),
            BondRiskItem(label="参考价格", value=price_text),
            BondRiskItem(label="剩余规模", value=item.issue_size),
            BondRiskItem(label="评级", value=item.rating),
        ],
    )
