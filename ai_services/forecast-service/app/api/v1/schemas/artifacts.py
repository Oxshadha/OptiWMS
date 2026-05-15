from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ClassicalInferenceRequest(BaseModel):
    dataset: str
    model_name: str
    series_id: str
    steps: int = Field(default=12, ge=1)


class BoostingInferenceRequest(BaseModel):
    dataset: str
    model_name: str
    horizon: int = Field(ge=1)
    rows: list[dict[str, Any]]


class OnlineSeriesPoint(BaseModel):
    month: str
    demand_units: float


class BoostingOnlineSeriesItem(BaseModel):
    series_id: str
    fg_code: str
    fg_category: str | None = None
    history: list[OnlineSeriesPoint]


class BoostingOnlineInferenceRequest(BaseModel):
    dataset: str
    model_name: str | None = None
    horizon: int = Field(ge=1)
    series: list[BoostingOnlineSeriesItem]
    stage: str = "production"
    clip_negative: bool = True