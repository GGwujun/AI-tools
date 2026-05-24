from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from app.database import Base


class FloatNumeric(TypeDecorator):
    """Numeric 列自动返回 float，避免 Decimal vs float 运算冲突。"""
    impl = Numeric
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, Decimal):
            return float(value)
        return value


class FundSnapshot(Base):
    __tablename__ = "fund_snapshots"
    __table_args__ = (UniqueConstraint("code", "market_type", name="uq_fund_snapshots_code_market_type"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    market_type: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    market: Mapped[str] = mapped_column(String(8), nullable=False, default="")
    tab_tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    market_price: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    market_change_pct: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    volume: Mapped[float | None] = mapped_column(FloatNumeric(16,2), nullable=True)
    amount: Mapped[float | None] = mapped_column(FloatNumeric(16,2), nullable=True)
    open_price: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    high_price: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    low_price: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    prev_close: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    total_market_cap: Mapped[float | None] = mapped_column(FloatNumeric(16,2), nullable=True)
    nav_price: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    premium_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    estimate_premium_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    market_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    nav_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    fund_state: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    fund_type: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    is_no_gap: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_paused: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    purchase_limit_amount: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    purchase_limit_display: Mapped[str] = mapped_column(String(64), nullable=False, default="--")
    down_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_down_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    scale: Mapped[str] = mapped_column(String(64), nullable=False, default="--")
    turnover: Mapped[str] = mapped_column(String(64), nullable=False, default="--")
    detail_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    detail_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class FundNavHistory(Base):
    __tablename__ = "fund_nav_history"
    __table_args__ = (UniqueConstraint("fund_id", "nav_date", name="uq_fund_nav_history_fund_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fund_id: Mapped[int] = mapped_column(ForeignKey("fund_snapshots.id", ondelete="CASCADE"), nullable=False, index=True)
    nav_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    nav_price: Mapped[float] = mapped_column(FloatNumeric(12,4), nullable=False)
    nav_change_pct: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    premium_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    estimated_profit_pct: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class UserFavorite(Base):
    __tablename__ = "user_favorites"
    __table_args__ = (
        UniqueConstraint("device_id", "code", "market_type", name="uq_user_favorites_device_code_market_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    market_type: Mapped[str] = mapped_column(String(8), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class UserSettings(Base):
    __tablename__ = "user_settings"

    device_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    basic_settings: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    advanced_settings: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class AuthUser(Base):
    __tablename__ = "auth_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mobile: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    nickname: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    avatar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mobile_bound: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    level: Mapped[str] = mapped_column(String(32), nullable=False, default="已注册用户")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class AuthVerificationCode(Base):
    __tablename__ = "auth_verification_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mobile: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(8), nullable=False)
    purpose: Mapped[str] = mapped_column(String(32), nullable=False, default="login")
    consumed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("auth_users.id", ondelete="CASCADE"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class SyncStatus(Base):
    __tablename__ = "sync_status"

    job_name: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="idle")
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    last_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_synced_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class FundProfileRecord(Base):
    __tablename__ = "fund_profiles"
    __table_args__ = (UniqueConstraint("code", "market_type", name="uq_fund_profiles_code_market_type"),)

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    market_type: Mapped[str] = mapped_column(String(8), primary_key=True)
    exchange: Mapped[str] = mapped_column(String(8), nullable=False, default="")
    name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    fund_category: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    arbitrage_category: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    underlying_index_code: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    fund_company: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, default="MID")
    calendar_market: Mapped[str] = mapped_column(String(16), nullable=False, default="CN")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_lof: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_etf: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_qdii: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_cross_border: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    default_subscribe_t_plus: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_redeem_t_plus: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class OpportunitySnapshot(Base):
    __tablename__ = "opportunity_snapshots"
    __table_args__ = (UniqueConstraint("code", "market_type", name="uq_opportunity_snapshots_code_market_type"),)

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    market_type: Mapped[str] = mapped_column(String(8), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    benchmark_type: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    benchmark_value: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    gross_premium_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    estimate_premium_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    valuation_error_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    fee_cost_rate: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    slippage_cost_rate: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    estimated_net_profit_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    liquidity_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    status_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    quality_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    risk_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, default="MID")
    opportunity_level: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
    risk_tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    displayable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    trigger_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    historical_success_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    occurrence_probability: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    data_quality_status: Mapped[str] = mapped_column(String(16), nullable=False, default="OK")
    quality_flags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    final_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    score_level: Mapped[str] = mapped_column(String(16), nullable=False, default="WATCH")
    crowding_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    crowding_level: Mapped[str] = mapped_column(String(16), nullable=False, default="LOW")
    expected_confirm_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_arrival_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_sell_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    calculated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    algorithm_version: Mapped[str] = mapped_column(String(32), nullable=False, default="v2")
    z_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    z_score_level: Mapped[str] = mapped_column(String(16), nullable=False, default="NORMAL")


class FundDailySnapshot(Base):
    __tablename__ = "fund_daily_snapshots"
    __table_args__ = (UniqueConstraint("fund_code", "trade_date", name="uq_fund_daily_snapshots_code_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fund_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    open_price: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    close_price: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    high_price: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    low_price: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    amount: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    official_nav: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    estimated_nav_close: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    nav_change_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    close_change_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    close_premium_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    nav_premium_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    valuation_error_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    subscribe_status: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    subscribe_limit_amount: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    data_source_quality: Mapped[str] = mapped_column(String(16), nullable=False, default="RAW")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class FundArbitrageEvent(Base):
    __tablename__ = "fund_arbitrage_events"
    __table_args__ = (
        UniqueConstraint(
            "fund_code",
            "trigger_date",
            "threshold_type",
            "threshold_value",
            name="uq_fund_arbitrage_events_key",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fund_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    trigger_date: Mapped[date] = mapped_column(Date, nullable=False)
    threshold_type: Mapped[str] = mapped_column(String(32), nullable=False, default="premium_rate")
    threshold_value: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.5)
    trigger_premium_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    trigger_nav: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    trigger_close_price: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    subscribe_nav: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    confirm_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    arrival_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    sell_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    sell_price: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    fee_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    slippage_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    return_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    success: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="triggered")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class FundArbitrageStat(Base):
    __tablename__ = "fund_arbitrage_stats"
    __table_args__ = (
        UniqueConstraint(
            "fund_code",
            "threshold_type",
            "threshold_value",
            "stat_start_date",
            name="uq_fund_arbitrage_stats_key",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fund_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    threshold_type: Mapped[str] = mapped_column(String(32), nullable=False, default="premium_rate")
    threshold_value: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.5)
    stat_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    stat_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_trade_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    trigger_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    success_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    occurrence_probability: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    success_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    sum_return_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    compound_return_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    avg_return_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    max_return_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    min_return_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class TaskRun(Base):
    __tablename__ = "task_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="running")
    processed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class TradingCalendarDay(Base):
    __tablename__ = "trading_calendar_days"
    __table_args__ = (UniqueConstraint("market", "trade_date", name="uq_trading_calendar_days_market_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    market: Mapped[str] = mapped_column(String(16), nullable=False, default="CN")
    trade_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    is_open: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    note: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class RawDataEvent(Base):
    __tablename__ = "raw_data_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    data_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    biz_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    raw_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    collected_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class FundStandardValuationSnapshot(Base):
    __tablename__ = "fund_standard_valuation_snapshots"
    __table_args__ = (UniqueConstraint("fund_code", "snapshot_time", name="uq_standard_valuation_code_time"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fund_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    snapshot_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    standard_estimated_nav: Mapped[float | None] = mapped_column(FloatNumeric(12,4), nullable=True)
    confidence_level: Mapped[str] = mapped_column(String(16), nullable=False, default="LOW")
    valuation_source_code: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    valuation_quality_status: Mapped[str] = mapped_column(String(16), nullable=False, default="OK")
    quality_flags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)


class FundOpportunityScore(Base):
    __tablename__ = "fund_opportunity_scores"
    __table_args__ = (UniqueConstraint("fund_code", "snapshot_time", name="uq_fund_opportunity_scores_code_time"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fund_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    market_type: Mapped[str] = mapped_column(String(8), nullable=False, default="")
    snapshot_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    final_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    level: Mapped[str] = mapped_column(String(16), nullable=False, default="WATCH")
    profit_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    reliability_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    execution_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    liquidity_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    risk_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    crowding_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    z_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    z_score_level: Mapped[str] = mapped_column(String(16), nullable=False, default="NORMAL")


class FundCrowdingScore(Base):
    __tablename__ = "fund_crowding_scores"
    __table_args__ = (UniqueConstraint("fund_code", "snapshot_time", name="uq_fund_crowding_scores_code_time"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fund_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    market_type: Mapped[str] = mapped_column(String(8), nullable=False, default="")
    snapshot_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    share_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    amount_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    premium_decay_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    orderbook_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    streak_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    crowding_score: Mapped[float] = mapped_column(FloatNumeric(10,4), nullable=False, default=0.0)
    level: Mapped[str] = mapped_column(String(16), nullable=False, default="LOW")


class FundConditionReferenceSnapshot(Base):
    __tablename__ = "fund_condition_reference_snapshots"
    __table_args__ = (UniqueConstraint("fund_code", "snapshot_time", name="uq_condition_reference_code_time"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fund_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    snapshot_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    status_level: Mapped[str] = mapped_column(String(32), nullable=False, default="NEUTRAL")
    summary_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    premium_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    historical_success_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    valuation_error_rate: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    crowding_score: Mapped[float | None] = mapped_column(FloatNumeric(10,4), nullable=True)
    condition_result_json: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    risk_result_json: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    rhythm_reference_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    compliance_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
