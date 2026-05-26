"""Standardized response schemas for the Forecast Gateway API.

These models define the **public contract** that all consumers code against.
Even if the underlying ML model changes (Random Forest → LightGBM → neural),
these schemas remain stable.

Enterprise design: inspired by AWS Forecast, Google Vertex AI, and Azure ML
response envelope patterns.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class ForecastPoint(BaseModel):
    """A single forecast data point for one SKU at one horizon."""

    sku: str = Field(..., description="Product/SKU identifier")
    category: str | None = Field(default=None, description="Product category")
    horizon: int = Field(..., ge=1, le=12, description="Forecast horizon in months ahead")
    period: str = Field(..., description="Target period label, e.g. '2026-06' or 'H+3'")
    p10: float = Field(..., description="10th percentile — optimistic lower bound")
    p50: float = Field(..., description="50th percentile — median point forecast")
    p90: float = Field(..., description="90th percentile — pessimistic upper bound")
    unit: str = Field(default="units", description="Unit of measurement for the forecast values")
    confidence_level: float = Field(default=0.80, description="Confidence interval coverage (P10-P90)")
    actual: float | None = Field(default=None, description="Actual observed value (null for future periods)")


class ModelInfo(BaseModel):
    """Metadata about the model that produced the forecast."""

    name: str = Field(..., description="Model name, e.g. 'random_forest'")
    version: str = Field(default="v1", description="Model version tag")
    is_champion: bool = Field(default=True, description="Whether this is the designated champion model")
    fallback_used: bool = Field(default=False, description="Whether a fallback/baseline was used instead of the primary model")
    fallback_method: str | None = Field(default=None, description="Fallback method if used, e.g. 'snaive12', 'last_value'")


class PaginationInfo(BaseModel):
    """Pagination metadata for list responses."""

    total: int = Field(..., description="Total items matching the query")
    limit: int = Field(..., description="Items per page")
    offset: int = Field(default=0, description="Current offset")
    has_more: bool = Field(default=False, description="Whether more items exist beyond this page")


class ForecastResponse(BaseModel):
    """Standardized response envelope for all gateway forecast endpoints.

    This is the contract your team codes against.  The shape never changes
    even when the underlying model is swapped.
    """

    api_version: str = Field(default="1.0", description="API contract version")
    request_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique request ID for tracing and support",
    )
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="Response timestamp in ISO 8601 format",
    )
    status: str = Field(
        default="success",
        description="Response status: success | partial | error",
    )
    model: ModelInfo = Field(..., description="Model that produced these forecasts")
    warehouse_id: str | None = Field(default=None, description="Warehouse scope (null = all)")
    forecasts: list[ForecastPoint] = Field(default_factory=list, description="Forecast data points")
    total_count: int = Field(default=0, description="Total forecast points returned")
    pagination: PaginationInfo | None = Field(default=None, description="Pagination info for list queries")
    errors: list[dict[str, Any]] | None = Field(default=None, description="Per-series errors if any")
    message: str | None = Field(default=None, description="Human-readable status message")


class AsyncJobResponse(BaseModel):
    """Response returned when a forecast request is processed asynchronously."""

    api_version: str = Field(default="1.0")
    request_id: str = Field(default_factory=lambda: str(uuid4()))
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    status: str = Field(default="accepted", description="accepted | processing | completed | failed")
    job_id: int = Field(..., description="Job/run ID to poll for results")
    poll_url: str = Field(..., description="URL to poll for job status and results")
    estimated_seconds: float | None = Field(default=None, description="Estimated processing time")
    message: str = Field(default="Forecast job accepted. Poll the poll_url for results.")


class GatewayHealthResponse(BaseModel):
    """Health check response for the gateway."""

    api_version: str = Field(default="1.0")
    status: str = Field(..., description="ok | degraded | error")
    service: str = Field(default="forecast-gateway")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    champion_model: ModelInfo | None = Field(default=None, description="Current champion model info")
    total_artifacts: int = Field(default=0, description="Number of available model artifacts")
    last_run_id: int | None = Field(default=None, description="ID of the last published forecast run")
    uptime_seconds: float | None = Field(default=None)
