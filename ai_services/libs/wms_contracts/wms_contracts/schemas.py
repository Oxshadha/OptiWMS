from pydantic import BaseModel, Field


class ForecastQuery(BaseModel):
    sku: str | None = None
    horizon: int | None = Field(default=None, ge=1, le=12)
    date_from: str | None = None
    date_to: str | None = None


class ForecastPoint(BaseModel):
    sku: str
    month: str
    horizon: int
    p10: float
    p50: float
    p90: float


class InventoryRecommendation(BaseModel):
    sku: str
    safety_stock: float
    reorder_point: float
    target_max: float
    suggested_order_qty: float
