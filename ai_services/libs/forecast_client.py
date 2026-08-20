"""OptiWMS Forecast Client — Python SDK for consuming the Forecast Gateway API.

Usage:
    from forecast_client import ForecastClient

    client = ForecastClient("http://forecast-service:8091")

    # Get latest published forecasts
    result = client.get_latest(warehouse_id="WH-001")

    # Run live inference for specific SKUs
    result = client.forecast(
        skus=["SKU-001", "SKU-002"],
        horizons=[1, 3, 6, 12],
    )

    # Iterate results
    for point in result.forecasts:
        print(f"{point.sku} H+{point.horizon}: {point.p50:.0f} units")

    # Check model info
    print(f"Model: {result.model.name}, Fallback: {result.model.fallback_used}")

    # Health check
    health = client.health()
    print(f"Status: {health.status}, Champion: {health.champion_model.name}")
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

import httpx


# ──────────────────────────────────────────────────────────────────────────────
# Data classes — lightweight, no Pydantic dependency required for consumers
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class ForecastPoint:
    """A single forecast data point."""

    sku: str
    horizon: int
    period: str
    p10: float
    p50: float
    p90: float
    category: str | None = None
    unit: str = "units"
    actual: float | None = None


@dataclass
class ModelInfo:
    """Metadata about the model that produced the forecast."""

    name: str
    version: str = "v1"
    is_champion: bool = True
    fallback_used: bool = False
    fallback_method: str | None = None


@dataclass
class ForecastResult:
    """Parsed response from the forecast gateway."""

    status: str
    model: ModelInfo
    forecasts: list[ForecastPoint]
    total_count: int
    request_id: str = ""
    warehouse_id: str | None = None
    message: str | None = None
    errors: list[dict] | None = None
    raw: dict = field(default_factory=dict, repr=False)

    @property
    def ok(self) -> bool:
        """True if the request was fully successful."""
        return self.status == "success"

    def by_sku(self, sku: str) -> list[ForecastPoint]:
        """Filter forecast points by SKU."""
        return [p for p in self.forecasts if p.sku.upper() == sku.upper()]

    def by_horizon(self, horizon: int) -> list[ForecastPoint]:
        """Filter forecast points by horizon."""
        return [p for p in self.forecasts if p.horizon == horizon]

    def to_dict(self) -> dict[str, Any]:
        """Convert to a plain dictionary."""
        return self.raw


@dataclass
class HealthResult:
    """Parsed health check response."""

    status: str
    champion_model: ModelInfo | None
    total_artifacts: int = 0
    last_run_id: int | None = None
    uptime_seconds: float | None = None


@dataclass
class AsyncJobResult:
    """Parsed async job reference."""

    job_id: int
    status: str
    poll_url: str
    message: str = ""
    estimated_seconds: float | None = None


# ──────────────────────────────────────────────────────────────────────────────
# Client
# ──────────────────────────────────────────────────────────────────────────────

class ForecastClient:
    """HTTP client for the OptiWMS Forecast Gateway API.

    Parameters
    ----------
    base_url : str
        Base URL of the forecast service, e.g. "http://forecast-service:8091"
    token : str | None
        Optional auth token (WMS_SERVICE_TOKEN for service-to-service calls)
    timeout : float
        HTTP request timeout in seconds (default: 30)
    """

    API_PREFIX = "/api/v1/gateway"

    def __init__(
        self,
        base_url: str = "http://localhost:8091",
        token: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        headers: dict[str, str] = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._client = httpx.Client(
            base_url=self._base_url,
            headers=headers,
            timeout=timeout,
        )

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    # ── Core endpoints ───────────────────────────────────────────────────

    def forecast(
        self,
        skus: list[str] | None = None,
        horizons: list[int] | None = None,
        warehouse_id: str | None = None,
        mode: str | None = None,
        include_inventory: bool = False,
    ) -> ForecastResult | AsyncJobResult:
        """Run a live forecast.

        Parameters
        ----------
        skus : list[str] | None
            SKUs to forecast. None = all available.
        horizons : list[int] | None
            Horizons (months ahead). Default: [1, 3, 6, 12]
        warehouse_id : str | None
            Warehouse scope.
        mode : str | None
            Force 'sync' or 'async'. None = auto.
        include_inventory : bool
            Also return inventory recommendations.

        Returns
        -------
        ForecastResult
            If executed synchronously.
        AsyncJobResult
            If executed asynchronously (contains job_id for polling).
        """
        payload: dict[str, Any] = {}
        if skus is not None:
            payload["skus"] = skus
        if horizons is not None:
            payload["horizons"] = horizons
        if warehouse_id:
            payload["warehouse_id"] = warehouse_id
        if mode:
            payload["mode"] = mode
        if include_inventory:
            payload["include_inventory"] = True

        resp = self._client.post(f"{self.API_PREFIX}/forecast", json=payload)
        resp.raise_for_status()
        data = resp.json()

        # Determine if this is a sync or async response.
        if "job_id" in data:
            return AsyncJobResult(
                job_id=data["job_id"],
                status=data.get("status", "accepted"),
                poll_url=data.get("poll_url", ""),
                message=data.get("message", ""),
                estimated_seconds=data.get("estimated_seconds"),
            )

        return self._parse_forecast_result(data)

    def get_latest(
        self,
        sku: str | None = None,
        warehouse_id: str | None = None,
        horizon: int | None = None,
        category: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> ForecastResult:
        """Get the latest published forecasts.

        This is the fastest way to get forecasts — reads pre-computed
        predictions from the database.
        """
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if sku:
            params["sku"] = sku
        if warehouse_id:
            params["warehouse_id"] = warehouse_id
        if horizon is not None:
            params["horizon"] = horizon
        if category:
            params["category"] = category

        resp = self._client.get(f"{self.API_PREFIX}/forecast/latest", params=params)
        resp.raise_for_status()
        return self._parse_forecast_result(resp.json())

    def get_sku(self, sku: str, warehouse_id: str | None = None) -> ForecastResult:
        """Get all forecast horizons for a specific SKU."""
        params: dict[str, Any] = {}
        if warehouse_id:
            params["warehouse_id"] = warehouse_id

        resp = self._client.get(f"{self.API_PREFIX}/forecast/{sku}", params=params)
        resp.raise_for_status()
        return self._parse_forecast_result(resp.json())

    def poll_job(
        self,
        job_id: int,
        include_results: bool = True,
        limit: int = 500,
    ) -> dict[str, Any]:
        """Poll an async job for status and results."""
        params: dict[str, Any] = {
            "include_results": include_results,
            "limit": limit,
        }
        resp = self._client.get(f"{self.API_PREFIX}/jobs/{job_id}", params=params)
        resp.raise_for_status()
        return resp.json()

    def wait_for_job(
        self,
        job_id: int,
        timeout: float = 120.0,
        poll_interval: float = 2.0,
    ) -> ForecastResult:
        """Wait for an async job to complete and return results.

        Parameters
        ----------
        job_id : int
            The job ID to wait for.
        timeout : float
            Max seconds to wait before raising TimeoutError.
        poll_interval : float
            Seconds between polls.
        """
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            data = self.poll_job(job_id, include_results=True)
            status = data.get("status", "")
            if status == "completed":
                # Reshape into ForecastResult format.
                return self._parse_forecast_result({
                    "status": "success",
                    "model": {"name": data.get("model_name", "unknown")},
                    "forecasts": data.get("forecasts", []),
                    "total_count": data.get("total_count", 0),
                    "warehouse_id": data.get("warehouse_id"),
                })
            if status == "failed":
                raise RuntimeError(f"Forecast job {job_id} failed: {data.get('error', 'unknown')}")
            time.sleep(poll_interval)
        raise TimeoutError(f"Forecast job {job_id} did not complete within {timeout}s.")

    def health(self) -> HealthResult:
        """Check gateway health status."""
        resp = self._client.get(f"{self.API_PREFIX}/health")
        resp.raise_for_status()
        data = resp.json()

        champion = None
        if data.get("champion_model"):
            cm = data["champion_model"]
            champion = ModelInfo(
                name=cm.get("name", "unknown"),
                version=cm.get("version", "v1"),
                is_champion=cm.get("is_champion", True),
                fallback_used=cm.get("fallback_used", False),
            )

        return HealthResult(
            status=data.get("status", "unknown"),
            champion_model=champion,
            total_artifacts=data.get("total_artifacts", 0),
            last_run_id=data.get("last_run_id"),
            uptime_seconds=data.get("uptime_seconds"),
        )

    def models(self) -> dict[str, Any]:
        """List available models and champion info."""
        resp = self._client.get(f"{self.API_PREFIX}/models")
        resp.raise_for_status()
        return resp.json()

    # ── Internal helpers ─────────────────────────────────────────────────

    def _parse_forecast_result(self, data: dict[str, Any]) -> ForecastResult:
        """Parse a raw JSON response into a ForecastResult."""
        model_data = data.get("model") or {}
        model = ModelInfo(
            name=model_data.get("name", "unknown"),
            version=model_data.get("version", "v1"),
            is_champion=model_data.get("is_champion", True),
            fallback_used=model_data.get("fallback_used", False),
            fallback_method=model_data.get("fallback_method"),
        )

        forecasts = [
            ForecastPoint(
                sku=p.get("sku", ""),
                horizon=p.get("horizon", 0),
                period=p.get("period", ""),
                p10=float(p.get("p10", 0.0)),
                p50=float(p.get("p50", 0.0)),
                p90=float(p.get("p90", 0.0)),
                category=p.get("category"),
                unit=p.get("unit", "units"),
                actual=p.get("actual"),
            )
            for p in (data.get("forecasts") or [])
        ]

        return ForecastResult(
            status=data.get("status", "unknown"),
            model=model,
            forecasts=forecasts,
            total_count=data.get("total_count", len(forecasts)),
            request_id=data.get("request_id", ""),
            warehouse_id=data.get("warehouse_id"),
            message=data.get("message"),
            errors=data.get("errors"),
            raw=data,
        )
