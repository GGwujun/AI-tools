from __future__ import annotations


def display_label(*, score_level: str, data_quality_status: str, crowding_level: str, risk_level: str) -> tuple[str, str]:
    if data_quality_status == "ERROR":
        return "数据待确认", "当前估值或行情数据存在异常，建议先观察数据恢复情况。"
    if crowding_level == "HIGH" or risk_level == "HIGH":
        return "谨慎观察", "当前风险或拥挤度较高，建议重点核对条件与风险。"
    if score_level == "STRONG":
        return "重点观察", "当前满足较多观察条件，可继续跟踪关键指标变化。"
    if score_level == "ACTIONABLE":
        return "可继续跟踪", "当前处于可关注区间，建议持续跟踪溢价和风险变化。"
    if score_level == "WATCH":
        return "观察中", "当前条件偏中性，适合继续观察。"
    return "当前不优先", "当前不满足主要观察条件，建议降低优先级。"
