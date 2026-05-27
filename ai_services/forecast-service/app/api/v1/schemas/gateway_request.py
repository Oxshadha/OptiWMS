"""Request schemas for the Forecast Gateway API.

Designed so callers never need to know internal details like dataset codes
or model names.  Everything is auto-resolved by the gateway.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    """Request body for ``POST /api/v1/gateway/forecast``.

    Callers specify *what* they want forecasted — the gateway handles
    model selection, dataset resolution, and sync/async routing internally.
    """

    skus: list[str] | None = Field(
        default=None,
        description=(
            "List of SKU identifiers to forecast. "
            "If null or empty, forecasts all available SKUs."
        ),
    )
    horizons: list[int] = Field(
        default=[1, 3, 6, 12],
        description="Which forecast horizons (months ahead) to generate. Default: 1, 3, 6, 12.",
    )
    warehouse_id: str | None = Field(
        default=None,
        description="Warehouse scope. Null = use default warehouse.",
    )
    mode: str | None = Field(
        default=None,
        description=(
            "Execution mode override: 'sync' (wait for results), "
            "'async' (returns job_id for polling), or null for auto-detection "
            "based on request size."
        ),
    )
    include_inventory: bool = Field(
        default=False,
        description="If true, also return inventory reorder recommendations alongside forecasts.",
    )
    fields: list[str] | None = Field(
        default=None,
        description=(
            "Optional field projection. Only return these fields per forecast point. "
            "Example: ['sku', 'p50', 'horizon'] for a lightweight response."
        ),
    )


class LatestForecastQuery(BaseModel):
    """Query parameters for ``GET /api/v1/gateway/forecast/latest``.

    Used as a Pydantic model for documentation; actual endpoint uses
    FastAPI Query parameters.
    """

    sku: str | None = Field(default=None, description="Filter by SKU")
    warehouse_id: str | None = Field(default=None, description="Filter by warehouse")
    horizon: int | None = Field(default=None, ge=1, le=12, description="Filter by horizon")
    category: str | None = Field(default=None, description="Filter by product category")
    limit: int = Field(default=100, ge=1, le=5000, description="Max results per page")
    offset: int = Field(default=0, ge=0, description="Pagination offset")
    fields: str | None = Field(
        default=None,
        description="Comma-separated field projection, e.g. 'sku,p50,horizon'",
    )
