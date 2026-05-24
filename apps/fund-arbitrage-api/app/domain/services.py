from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from app.domain.models import (
    FundProfile,
    FundStatusSnapshot,
    MarketQuote,
    NavSnapshot,
    OpportunitySnapshotModel,
)


ALGORITHM_VERSION = "v2"


def calculate_z_score(current_premium: float | None, historical_premiums: list[float]) -> tuple[float, str]:
    """Calculate Z-score for premium rate anomaly detection.

    Requires at least 30 historical observations for statistical significance.
    Z-score = (current_premium - mean) / std
    Level: |z| >= 2 -> "ANOMALY", |z| >= 1.5 -> "NOTABLE", else "NORMAL"

    Returns (z_score, z_score_level).
    """
    if current_premium is None or len(historical_premiums) < 30:
        return 0.0, "NORMAL"

    import statistics
    mean = statistics.mean(historical_premiums)
    stdev = statistics.stdev(historical_premiums)

    if stdev == 0:
        # All historical premiums are the same — no deviation is possible
        return 0.0, "NORMAL"

    z = (current_premium - mean) / stdev
    z = round(z, 2)

    abs_z = abs(z)
    if abs_z >= 2.0:
        return z, "ANOMALY"
    if abs_z >= 1.5:
        return z, "NOTABLE"
    return z, "NORMAL"


def calculate_arbitrage_cost(
    *,
    profile: FundProfile,
    quote: MarketQuote,
    arbitrage_type: str = "premium",
    holding_days: int = 7,
) -> tuple[float, float, float]:
    """Calculate detailed arbitrage cost rates (all in percent-point units).

    Args:
        profile: Fund profile
        quote: Market quote for slippage estimation
        arbitrage_type: "premium" (申购→卖出) or "discount" (买入→赎回)
        holding_days: Expected holding days (affects redemption fee tier)

    Returns:
        (fee_cost_rate, slippage_cost_rate, total_cost_rate) all in percent-points
        e.g. 0.17 means 0.17%, 1.5 means 1.5%
    """
    if arbitrage_type == "premium":
        # 溢价套利: 场外申购 → 场内卖出
        # 申购费: LOF 0.15%, ETF通常0 (institutional), QDII额外0.10%
        subscription_fee = 0.15  # LOF申购费率默认
        if profile.is_etf:
            subscription_fee = 0.0  # ETF申购通常免申购费(券商通道)
        if profile.is_qdii:
            subscription_fee += 0.10

        # 佣金: 万2.5 = 0.025%
        commission = 0.025
        fee_cost_rate = subscription_fee + commission

    else:
        # 折价套利: 场内买入 → 场外赎回
        # 佣金: 万2.5 = 0.025%
        commission = 0.025

        # 赎回费按持有天数分档
        if holding_days < 7:
            redemption_fee = 1.5  # <7天: 1.5%
        elif holding_days < 30:
            redemption_fee = 0.5  # 7-30天: 0.5%
        else:
            redemption_fee = 0.0  # >=30天: 0%

        fee_cost_rate = commission + redemption_fee

    # 冲击成本: 低流动性基金更高
    slippage_cost_rate = 0.05  # 基础0.05%
    if quote.amount is not None and quote.amount < 5_000_000:
        slippage_cost_rate = 0.25  # 低流动性: 0.25%

    total_cost_rate = round(fee_cost_rate + slippage_cost_rate, 4)
    return round(fee_cost_rate, 4), round(slippage_cost_rate, 4), total_cost_rate


def select_benchmark(profile: FundProfile, official_nav: NavSnapshot | None, estimate_nav: NavSnapshot | None, iopv_nav: NavSnapshot | None) -> NavSnapshot | None:
    if profile.is_etf and iopv_nav and iopv_nav.nav_value is not None:
        return iopv_nav
    if estimate_nav and estimate_nav.nav_value is not None:
        return estimate_nav
    if official_nav and official_nav.nav_value is not None:
        return official_nav
    return None


def build_rhythm(
    *,
    profile: FundProfile,
    trade_date: date | None = None,
    trading_calendar_service: object | None = None,
) -> tuple[date | None, date | None, date | None]:
    """Calculate T+N rhythm dates.

    If trading_calendar_service is provided, uses next_trade_date() for proper
    trading-day calculation. Otherwise falls back to naive timedelta.
    """
    base_date = trade_date or datetime.now(timezone.utc).date()
    confirm_days = profile.default_subscribe_t_plus or 1
    arrival_days = profile.default_redeem_t_plus or 3

    if trading_calendar_service is not None and hasattr(trading_calendar_service, "next_trade_date"):
        try:
            confirm_date = trading_calendar_service.next_trade_date(
                market=profile.calendar_market, from_date=base_date, offset=confirm_days,
            )
            arrival_date = trading_calendar_service.next_trade_date(
                market=profile.calendar_market, from_date=base_date, offset=arrival_days,
            )
            sell_date = trading_calendar_service.next_trade_date(
                market=profile.calendar_market, from_date=arrival_date, offset=0,
            )
            return confirm_date, arrival_date, sell_date
        except Exception:
            pass  # Fall back to naive calculation

    confirm_date = base_date + timedelta(days=confirm_days)
    arrival_date = base_date + timedelta(days=arrival_days)
    sell_date = arrival_date
    return confirm_date, arrival_date, sell_date


def calculate_risk(
    *,
    gross_premium_rate: float | None,
    valuation_error_rate: float | None,
    liquidity_score: float,
    status_score: float,
    trigger_count: int,
    is_qdii: bool,
) -> tuple[float, str, list[str]]:
    risk_tags: list[str] = []
    valuation_error_score = min(100.0, abs((valuation_error_rate or 0.0) * 10000))
    liquidity_risk = (1.0 - liquidity_score) * 100
    status_risk = (1.0 - max(0.0, status_score)) * 100
    sample_risk = 100.0 if trigger_count < 5 else 60.0 if trigger_count < 20 else 20.0
    time_diff_risk = 60.0 if is_qdii else 10.0

    risk_score = (
        valuation_error_score * 0.25
        + liquidity_risk * 0.20
        + status_risk * 0.20
        + sample_risk * 0.20
        + time_diff_risk * 0.15
    )

    if valuation_error_rate is not None and abs(valuation_error_rate) > 0.003:
        risk_tags.append("估值误差偏高")
    if liquidity_score < 0.4:
        risk_tags.append("流动性不足")
    if trigger_count < 20:
        risk_tags.append("历史样本不足")
    if is_qdii:
        risk_tags.append("跨市场时差风险")
    if gross_premium_rate is not None and gross_premium_rate < 0:
        risk_tags.append("当前溢价不占优")

    if risk_score <= 30:
        return round(risk_score, 2), "LOW", risk_tags
    if risk_score <= 65:
        return round(risk_score, 2), "MID", risk_tags
    return round(risk_score, 2), "HIGH", risk_tags


def calculate_opportunity(
    *,
    profile: FundProfile,
    quote: MarketQuote,
    status: FundStatusSnapshot,
    official_nav: NavSnapshot | None,
    estimate_nav: NavSnapshot | None,
    iopv_nav: NavSnapshot | None,
    expected_confirm_date: date | None = None,
    expected_arrival_date: date | None = None,
    expected_sell_date: date | None = None,
    data_quality_status: str = "OK",
    quality_flags: list[str] | None = None,
    z_score: float = 0.0,
    z_score_level: str = "NORMAL",
) -> OpportunitySnapshotModel:
    benchmark = select_benchmark(profile, official_nav, estimate_nav, iopv_nav)
    benchmark_value = benchmark.nav_value if benchmark else None

    gross_premium_rate: float | None = None
    if quote.last_price is not None and benchmark_value and benchmark_value > 0:
        gross_premium_rate = round((quote.last_price - benchmark_value) / benchmark_value * 100, 2)

    # 估算溢价率：基于 estimate_nav（交易时段实时估值）
    estimate_premium_rate: float | None = None
    if quote.last_price is not None and estimate_nav is not None and estimate_nav.nav_value is not None and estimate_nav.nav_value > 0:
        estimate_premium_rate = round((quote.last_price - estimate_nav.nav_value) / estimate_nav.nav_value * 100, 2)

    # Determine arbitrage type based on premium direction
    arbitrage_type = "premium" if (gross_premium_rate is None or gross_premium_rate >= 0) else "discount"

    # Use refined cost model
    fee_cost_rate, slippage_cost_rate, total_cost = calculate_arbitrage_cost(
        profile=profile, quote=quote, arbitrage_type=arbitrage_type,
    )

    estimated_net_profit_rate = None
    if gross_premium_rate is not None:
        estimated_net_profit_rate = round(gross_premium_rate - fee_cost_rate - slippage_cost_rate, 2)

    valuation_error_rate = None
    if official_nav.nav_value is not None and estimate_nav.nav_value is not None and official_nav.nav_value != 0:
        valuation_error_rate = round((official_nav.nav_value - estimate_nav.nav_value) / official_nav.nav_value, 6)

    liquidity_score = 1.0
    if quote.amount is not None:
        liquidity_score = min(1.0, quote.amount / 20_000_000)

    status_score = 1.0
    risk_tags: list[str] = []
    displayable = True
    quality_flags = list(quality_flags or [])

    if not status.can_subscribe:
        status_score -= 0.5
        risk_tags.append("暂停申购")
    if not status.can_redeem:
        status_score -= 0.3
        risk_tags.append("暂停赎回")
    if status.limit_status:
        status_score -= 0.2
        risk_tags.append(status.limit_status)
    if status.is_suspended:
        status_score = 0.0
        displayable = False
        risk_tags.append("停牌")
    if quote.amount is not None and quote.amount < 5_000_000:
        risk_tags.append("流动性不足")

    trigger_count = 30 if benchmark_value is not None else 0
    historical_success_rate = 0.72 if gross_premium_rate is not None and gross_premium_rate > 0.5 else 0.48
    occurrence_probability = 0.18 if gross_premium_rate is not None and gross_premium_rate > 0 else 0.05

    risk_score, risk_level, extra_risk_tags = calculate_risk(
        gross_premium_rate=gross_premium_rate,
        valuation_error_rate=valuation_error_rate,
        liquidity_score=liquidity_score,
        status_score=status_score,
        trigger_count=trigger_count,
        is_qdii=profile.is_qdii,
    )
    risk_tags.extend(tag for tag in extra_risk_tags if tag not in risk_tags)

    quality_score = max(
        0.0,
        min(
            1.0,
            liquidity_score * 0.3 + status_score * 0.3 + (0.2 if benchmark_value is not None else 0.0) + (0.2 if risk_level == "LOW" else 0.1 if risk_level == "MID" else 0.0),
        ),
    )

    opportunity_level = "none"
    if estimated_net_profit_rate is None:
        opportunity_level = "watch"
        displayable = False
    elif z_score_level == "ANOMALY" and estimated_net_profit_rate >= 1.5 and quality_score >= 0.6 and displayable and risk_level != "HIGH":
        # Z-score anomaly + high net profit = strong signal
        opportunity_level = "strong"
    elif estimated_net_profit_rate >= 1.5 and quality_score >= 0.6 and displayable and risk_level != "HIGH":
        opportunity_level = "strong"
    elif estimated_net_profit_rate >= 0.5 and quality_score >= 0.5 and displayable:
        opportunity_level = "candidate"
    elif displayable:
        opportunity_level = "watch"

    if z_score_level == "ANOMALY":
        risk_tags.append("溢价率异常偏离")

    if data_quality_status == "WARN":
        risk_tags.append("数据质量需复核")
    if data_quality_status == "ERROR":
        displayable = False
        opportunity_level = "watch"
        risk_tags.append("数据质量异常")

    if expected_confirm_date is None or expected_arrival_date is None or expected_sell_date is None:
        expected_confirm_date, expected_arrival_date, expected_sell_date = build_rhythm(profile=profile)

    return OpportunitySnapshotModel(
        code=profile.code,
        market_type=profile.market_type,
        benchmark_type=benchmark.nav_type if benchmark else "unknown",
        benchmark_value=benchmark_value,
        gross_premium_rate=gross_premium_rate,
        estimate_premium_rate=estimate_premium_rate,
        valuation_error_rate=valuation_error_rate,
        fee_cost_rate=fee_cost_rate,
        slippage_cost_rate=slippage_cost_rate,
        estimated_net_profit_rate=estimated_net_profit_rate,
        liquidity_score=round(liquidity_score, 4),
        status_score=round(status_score, 4),
        quality_score=round(quality_score, 4),
        risk_score=risk_score,
        risk_level=risk_level,
        opportunity_level=opportunity_level,
        risk_tags=risk_tags,
        displayable=displayable,
        trigger_count=trigger_count,
        historical_success_rate=historical_success_rate,
        occurrence_probability=occurrence_probability,
        data_quality_status=data_quality_status,
        quality_flags=quality_flags,
        expected_confirm_date=expected_confirm_date,
        expected_arrival_date=expected_arrival_date,
        expected_sell_date=expected_sell_date,
        calculated_at=datetime.now(timezone.utc),
        algorithm_version=ALGORITHM_VERSION,
        z_score=z_score,
        z_score_level=z_score_level,
        arbitrage_type=arbitrage_type,
    )
