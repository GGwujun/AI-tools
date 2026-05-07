from __future__ import annotations

from pydantic import BaseModel, Field


class ConditionChecklistItem(BaseModel):
    conditionCode: str
    title: str
    result: str
    description: str


class RiskChecklistItem(BaseModel):
    riskCode: str
    riskLevel: str
    title: str
    description: str


class StrategyMetricItem(BaseModel):
    label: str
    value: str
    description: str = ""


class RhythmStepItem(BaseModel):
    name: str
    text: str


class RhythmReferencePayload(BaseModel):
    title: str = "节奏参考"
    steps: list[RhythmStepItem] = Field(default_factory=list)


class StatusSummaryPayload(BaseModel):
    title: str = "当前状态"
    summaryText: str
    statusLevel: str


class ConditionReferenceResponse(BaseModel):
    fundCode: str
    fundName: str
    updatedAt: str | None = None
    statusSummary: StatusSummaryPayload
    keyMetrics: list[StrategyMetricItem] = Field(default_factory=list)
    conditionChecklist: list[ConditionChecklistItem] = Field(default_factory=list)
    riskChecklist: list[RiskChecklistItem] = Field(default_factory=list)
    rhythmReference: RhythmReferencePayload
    complianceText: str
