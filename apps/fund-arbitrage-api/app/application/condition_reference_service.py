from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select

from app.infrastructure.db.session import session_scope
from app.db_models import FundConditionReferenceSnapshot, FundSnapshot
from app.infrastructure.cache.cache_service import cache_service
from app.models.condition_reference import (
    ConditionChecklistItem,
    ConditionReferenceResponse,
    RiskChecklistItem,
    RhythmReferencePayload,
    RhythmStepItem,
    StatusSummaryPayload,
    StrategyMetricItem,
)


COMPLIANCE_TEXT = "以上内容基于历史数据、规则模型与公开信息整理，仅供参考，不构成投资建议。"


def _condition_items(opportunity, stat_payload: dict, quality_payload: dict) -> list[dict]:
    return [
        {
            "conditionCode": "PREMIUM_THRESHOLD",
            "title": "溢价率条件",
            "result": "PASSED" if (opportunity.gross_premium_rate or 0.0) >= 0.5 else "FAILED",
            "description": "当前溢价率高于0.5%观察阈值"
            if (opportunity.gross_premium_rate or 0.0) >= 0.5
            else "当前溢价率未达到观察阈值",
        },
        {
            "conditionCode": "HISTORY_SAMPLE",
            "title": "历史样本条件",
            "result": "PASSED" if stat_payload.get("trigger_count", 0) >= 20 else "WARNING",
            "description": "历史同阈值样本数量充足"
            if stat_payload.get("trigger_count", 0) >= 20
            else "历史样本偏少，统计参考价值有限",
        },
        {
            "conditionCode": "VALUATION_ERROR",
            "title": "估值误差条件",
            "result": "PASSED" if abs(opportunity.valuation_error_rate or 0.0) <= 0.003 else "WARNING",
            "description": "当前估值误差未见明显异常"
            if abs(opportunity.valuation_error_rate or 0.0) <= 0.003
            else "当前估值误差偏高，需要谨慎参考",
        },
        {
            "conditionCode": "CROWDING",
            "title": "拥挤度条件",
            "result": "PASSED" if opportunity.crowding_score <= 60 else "WARNING",
            "description": "当前拥挤度处于可观察区间"
            if opportunity.crowding_score <= 60
            else "当前拥挤度升高，溢价可能已被部分消化",
        },
        {
            "conditionCode": "LIQUIDITY",
            "title": "流动性条件",
            "result": "PASSED" if opportunity.liquidity_score >= 0.4 else "WARNING",
            "description": "成交额处于可观察区间"
            if opportunity.liquidity_score >= 0.4
            else "成交额偏低，可能影响退出效率",
        },
    ]


def _risk_items(opportunity, quality_payload: dict) -> list[dict]:
    items: list[dict] = [
        {
            "riskCode": "NAV_ESTIMATION_ERROR",
            "riskLevel": "MEDIUM" if abs(opportunity.valuation_error_rate or 0.0) <= 0.003 else "HIGH",
            "title": "净值估算偏差",
            "description": "预估净值可能与最终官方净值存在差异",
        },
        {
            "riskCode": "PREMIUM_DECAY",
            "riskLevel": "MEDIUM" if opportunity.crowding_score < 80 else "HIGH",
            "title": "溢价收敛风险",
            "description": "到账前溢价可能快速收敛",
        },
    ]
    if quality_payload.get("data_quality_status") == "WARN":
        items.append(
            {
                "riskCode": "DATA_QUALITY",
                "riskLevel": "MEDIUM",
                "title": "数据质量复核",
                "description": "当前估值来源或质量标记需要额外关注",
            }
        )
    return items


def _status_level(opportunity) -> str:
    if opportunity.data_quality_status == "ERROR" or opportunity.crowding_score >= 80:
        return "RISK_WARNING"
    if opportunity.final_score >= 75:
        return "WATCHABLE"
    if opportunity.final_score >= 60:
        return "NEUTRAL"
    return "CAUTION"


def _summary_text(opportunity, stat_payload: dict) -> str:
    if opportunity.data_quality_status == "ERROR":
        return "当前估值或行情数据存在异常，建议先观察数据恢复情况。"
    if opportunity.crowding_score >= 80:
        return "当前套利资金较为拥挤，收益可能已被部分透支，需重点关注溢价收敛风险。"
    if (opportunity.gross_premium_rate or 0.0) >= 0.5 and (stat_payload.get("success_rate") or 0.0) >= 0.6:
        return "当前溢价率处于可观察区间，历史同条件样本表现较好，但仍需关注估值误差与到账前波动。"
    return "当前条件偏中性，建议继续观察溢价率、估值误差与申购状态变化。"


def _rhythm_payload(detail_payload: dict) -> dict:
    rhythm = detail_payload.get("rhythm", {})
    return {
        "title": "节奏参考",
        "steps": [
            {"name": "申购状态", "text": "当前显示可申购"},
            {"name": "确认时间", "text": f"预计{rhythm.get('expected_confirm_date', '--')}确认"},
            {"name": "到账时间", "text": f"预计{rhythm.get('expected_arrival_date', '--')}到账"},
            {"name": "后续关注", "text": "重点关注溢价率、估值误差、申购状态变化"},
        ],
    }


def build_and_store_condition_reference(session, *, snapshot: FundSnapshot, opportunity) -> FundConditionReferenceSnapshot:
    detail_payload = snapshot.detail_payload or {}
    stat_payload = detail_payload.get("historical_stats", {})
    quality_payload = detail_payload.get("quality", {})

    condition_items = _condition_items(opportunity, stat_payload, quality_payload)
    risk_items = _risk_items(opportunity, quality_payload)
    status_level = _status_level(opportunity)
    summary_text = _summary_text(opportunity, stat_payload)
    rhythm_reference = _rhythm_payload(detail_payload)

    record = FundConditionReferenceSnapshot(
        fund_code=snapshot.code,
        snapshot_time=datetime.now(timezone.utc),
        status_level=status_level,
        summary_text=summary_text,
        premium_rate=opportunity.gross_premium_rate,
        historical_success_rate=stat_payload.get("success_rate"),
        valuation_error_rate=opportunity.valuation_error_rate,
        crowding_score=opportunity.crowding_score,
        condition_result_json=condition_items,
        risk_result_json=risk_items,
        rhythm_reference_json=rhythm_reference,
        compliance_text=COMPLIANCE_TEXT,
        updated_at=datetime.now(timezone.utc),
    )
    session.add(record)
    return record


def get_condition_reference(*, fund_code: str) -> ConditionReferenceResponse | None:
    cache_key = f"condition-reference:{fund_code}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return ConditionReferenceResponse(**cached)

    with session_scope() as session:
        snapshot = session.execute(
            select(FundConditionReferenceSnapshot)
            .where(FundConditionReferenceSnapshot.fund_code == fund_code)
            .order_by(FundConditionReferenceSnapshot.snapshot_time.desc())
        ).scalars().first()
        fund = session.execute(select(FundSnapshot).where(FundSnapshot.code == fund_code)).scalar_one_or_none()
        if snapshot is None or fund is None:
            return None

        sample_desc = ""
        if len(snapshot.condition_result_json or []) > 1:
            sample_desc = (snapshot.condition_result_json[1] or {}).get("description", "")

        response = ConditionReferenceResponse(
            fundCode=fund.code,
            fundName=fund.name,
            updatedAt=snapshot.snapshot_time.strftime("%Y-%m-%d %H:%M:%S"),
            statusSummary=StatusSummaryPayload(
                title="当前状态",
                summaryText=snapshot.summary_text,
                statusLevel=snapshot.status_level,
            ),
            keyMetrics=[
                StrategyMetricItem(label="当前溢价率", value=f"{(snapshot.premium_rate or 0.0):.2f}%", description="当前快照"),
                StrategyMetricItem(
                    label="历史成功率",
                    value=f"{((snapshot.historical_success_rate or 0.0) * 100):.2f}%",
                    description=sample_desc,
                ),
                StrategyMetricItem(
                    label="估值误差",
                    value=f"{((snapshot.valuation_error_rate or 0.0) * 100):.2f}%",
                    description="当前质量校验",
                ),
                StrategyMetricItem(
                    label="拥挤度",
                    value=f"{snapshot.crowding_score or 0.0:.1f}",
                    description="拥挤度评分",
                ),
            ],
            conditionChecklist=[ConditionChecklistItem(**item) for item in (snapshot.condition_result_json or [])],
            riskChecklist=[RiskChecklistItem(**item) for item in (snapshot.risk_result_json or [])],
            rhythmReference=RhythmReferencePayload(
                title=snapshot.rhythm_reference_json.get("title", "节奏参考"),
                steps=[RhythmStepItem(**item) for item in snapshot.rhythm_reference_json.get("steps", [])],
            ),
            complianceText=snapshot.compliance_text,
        )
        cache_service.set_json(cache_key, response.model_dump(mode="json"), 30)
        return response
