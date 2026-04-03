from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ClassicalInferenceRequest(BaseModel):
    dataset: str
    model_name: str
    series_id: str
    steps: int = Field(default=12, ge=1, le=24)


class BoostingInferenceRequest(BaseModel):
    dataset: str
    model_name: str
    horizon: int = Field(ge=1, le=12)
    rows: list[dict[str, Any]]


class OnlineHistoryPoint(BaseModel):
    month: str
    demand_units: float = Field(ge=0)
    on_hand_inventory: float | None = None
    stockout_days: float | None = None
    promotion_flag: float | None = None
    price_or_discount: float | None = None
    lead_time_days: float | None = None
    supplier_otif: float | None = None
    inbound_po_qty: float | None = None
    open_sales_orders: float | None = None
    returns_qty: float | None = None
    holiday_flag: float | None = None


class OnlineSeriesRequest(BaseModel):
    series_id: str
    fg_code: str
    fg_category: str | None = None
    history: list[OnlineHistoryPoint] = Field(min_length=2)
    static_features: dict[str, Any] = Field(default_factory=dict)


class BoostingOnlineInferenceRequest(BaseModel):
    dataset: str
    model_name: str
    horizon: int = Field(ge=1, le=12)
    series: list[OnlineSeriesRequest] = Field(min_length=1)
    stage: str = "production"
    clip_negative: bool = True

