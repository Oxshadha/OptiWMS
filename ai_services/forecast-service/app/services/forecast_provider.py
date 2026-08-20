"""Model-independent Forecast Provider abstraction.

This module defines a ``ForecastProvider`` protocol and a concrete
``BoostingForecastProvider`` implementation that wraps the existing
``artifact_service`` module.  When a new model family is introduced
(e.g. a neural network), a new provider class is created — the gateway
router needs **zero changes**.

Design:
    Gateway Router
        ↓
    get_active_provider()   ← factory function
        ↓
    BoostingForecastProvider   (or FutureNeuralProvider, etc.)
        ↓
    artifact_service / model artifacts
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Protocol, runtime_checkable

import pandas as pd

from app.api.v1.schemas.forecast_response import ForecastPoint, ForecastResponse, ModelInfo
from app.core.config import settings

logger = logging.getLogger("forecast.gateway.provider")


# ---------------------------------------------------------------------------
# Provider protocol — the interface future models must implement
# ---------------------------------------------------------------------------

@runtime_checkable
class ForecastProvider(Protocol):
    """Contract that any forecast model implementation must satisfy.

    Implement this protocol to plug in a new model family.  The gateway
    router calls ``predict()`` and ``model_info()`` without knowing which
    concrete class is behind the interface.
    """

    def predict(
        self,
        skus: list[str] | None,
        horizons: list[int],
        warehouse_id: str | None,
    ) -> ForecastResponse:
        """Run inference for the given SKUs and horizons.

        Parameters
        ----------
        skus : list[str] | None
            SKU identifiers.  ``None`` means *all available SKUs*.
        horizons : list[int]
            Forecast horizons (months ahead), e.g. ``[1, 3, 6, 12]``.
        warehouse_id : str | None
            Optional warehouse scope.

        Returns
        -------
        ForecastResponse
            Standardised response envelope.
        """
        ...

    def model_info(self) -> ModelInfo:
        """Return metadata about the currently active model."""
        ...

    def health_check(self) -> dict[str, Any]:
        """Return a health-check payload for the ``/health`` endpoint."""
        ...


# ---------------------------------------------------------------------------
# Concrete implementation wrapping the existing artifact_service
# ---------------------------------------------------------------------------

class BoostingForecastProvider:
    """Provider implementation for the tree-boosting model family.

    Supports Random Forest, LightGBM, XGBoost, and CatBoost — the same
    models already managed by ``artifact_service``.
    """

    def __init__(self, dataset: str | None = None) -> None:
        self._dataset = dataset or settings.default_forecast_dataset

    # -- Protocol implementation -------------------------------------------

    def predict(
        self,
        skus: list[str] | None,
        horizons: list[int],
        warehouse_id: str | None,
    ) -> ForecastResponse:
        from app.services.artifact_service import (
            infer_boosting_online,
            resolve_champion_model,
        )
        from app.services.forecast_service import _build_online_history_series

        dataset = self._dataset
        # Resolve the champion model for horizon-1 (representative).
        champion_name = resolve_champion_model(
            dataset=dataset, horizon=horizons[0] if horizons else 1, requested_model=None,
        )

        # Build history series from the runtime data source.
        try:
            all_series, _source = _build_online_history_series(
                dataset=dataset,
                model_name=champion_name,
                warehouse_id=warehouse_id,
            )
        except Exception as exc:
            logger.warning("Failed to build history series: %s — returning empty", exc)
            return ForecastResponse(
                status="error",
                model=self._make_model_info(champion_name),
                warehouse_id=warehouse_id,
                forecasts=[],
                total_count=0,
                errors=[{"error": str(exc)}],
                message=f"Could not resolve history for inference: {exc}",
            )

        # Filter to requested SKUs if specified.
        if skus:
            sku_set = {s.strip().upper() for s in skus}
            filtered = [
                s for s in all_series
                if str(s.get("fg_code") or s.get("series_id") or "").strip().upper() in sku_set
            ]
            if not filtered:
                return ForecastResponse(
                    status="success",
                    model=self._make_model_info(champion_name),
                    warehouse_id=warehouse_id,
                    forecasts=[],
                    total_count=0,
                    message=f"No matching SKUs found for: {skus}",
                )
            series_to_infer = filtered
        else:
            series_to_infer = all_series

        # Run inference for each horizon.
        all_points: list[ForecastPoint] = []
        all_errors: list[dict[str, Any]] = []
        overall_fallback_used = False

        for h in sorted(horizons):
            try:
                result = infer_boosting_online(
                    dataset=dataset,
                    model_name=champion_name,
                    horizon=h,
                    series=series_to_infer,
                    stage="production",
                    clip_negative=True,
                )
            except Exception as exc:
                logger.error("Inference failed for horizon %d: %s", h, exc)
                all_errors.append({"horizon": h, "error": str(exc)})
                continue

            items = result.get("items") or []
            errors = result.get("errors") or []
            if errors:
                all_errors.extend(errors)

            if result.get("fallback_used"):
                overall_fallback_used = True

            for item in items:
                p50 = float(item.get("prediction", 0.0))
                p10_val = item.get("p10")
                p90_val = item.get("p90")
                p10 = max(0.0, float(p10_val) if p10_val is not None else p50 * 0.85)
                p90 = max(p50, float(p90_val) if p90_val is not None else p50 * 1.15)

                all_points.append(
                    ForecastPoint(
                        sku=str(item.get("fg_code") or item.get("series_id") or ""),
                        category=item.get("fg_category"),
                        horizon=h,
                        period=f"H+{h}",
                        p10=round(p10, 2),
                        p50=round(p50, 2),
                        p90=round(p90, 2),
                    )
                )

        fallback_method = None
        if overall_fallback_used:
            # Collect unique fallback methods from the last inference result.
            fallback_method = ", ".join(
                sorted(
                    {
                        str(it.get("baseline_method") or "unknown")
                        for it in (result.get("items") or [])  # type: ignore[possibly-undefined]
                        if it.get("fallback_used")
                    }
                )
            ) or None

        model_info = ModelInfo(
            name=champion_name.lower(),
            version="v1",
            is_champion=True,
            fallback_used=overall_fallback_used,
            fallback_method=fallback_method,
        )

        status = "success"
        if all_errors and all_points:
            status = "partial"
        elif all_errors and not all_points:
            status = "error"

        return ForecastResponse(
            status=status,
            model=model_info,
            warehouse_id=warehouse_id,
            forecasts=all_points,
            total_count=len(all_points),
            errors=all_errors if all_errors else None,
            message=f"Generated {len(all_points)} forecast points across {len(horizons)} horizons.",
        )

    def model_info(self) -> ModelInfo:
        from app.services.artifact_service import resolve_champion_model

        champion = resolve_champion_model(
            dataset=self._dataset, horizon=1, requested_model=None,
        )
        return ModelInfo(
            name=champion.lower(),
            version="v1",
            is_champion=True,
            fallback_used=False,
            fallback_method=None,
        )

    def health_check(self) -> dict[str, Any]:
        from app.services.artifact_service import list_artifacts

        artifacts = list_artifacts(dataset=self._dataset)
        champion = self.model_info()
        return {
            "provider": "boosting",
            "dataset": self._dataset,
            "champion_model": champion.name,
            "total_artifacts": len(artifacts),
            "status": "ok" if artifacts else "degraded",
        }

    # -- Internal helpers --------------------------------------------------

    def _make_model_info(self, model_name: str) -> ModelInfo:
        return ModelInfo(
            name=model_name.lower(),
            version="v1",
            is_champion=True,
            fallback_used=False,
            fallback_method=None,
        )


class V8SnapshotForecastProvider:
    """Serve the locked v8 recursive H1-H12 operational forecast snapshot.

    v8 is a global RM/PM model with known-future causal inputs. It is therefore
    recalculated as a governed batch and served from the exact persisted
    snapshot used by inventory and optimizer consumers.
    """

    MODEL_NAME = "PROJECT_OPS_EXTRA_TREES_CAUSAL"

    def __init__(self, root: str | None = None) -> None:
        self._root = Path(root or settings.v8_forecast_root)
        self._forecast_path = self._root / "outputs" / "operational_forecasts.csv"
        self._metadata_path = (
            self._root / "outputs" / "serving_bundle" / "production" / "metadata.json"
        )

    def predict(
        self,
        skus: list[str] | None,
        horizons: list[int],
        warehouse_id: str | None,
    ) -> ForecastResponse:
        if not self._forecast_path.exists():
            return ForecastResponse(
                status="error",
                model=self.model_info(),
                warehouse_id=warehouse_id,
                forecasts=[],
                total_count=0,
                errors=[{"error": f"Missing v8 snapshot: {self._forecast_path}"}],
                message="The v8 operational snapshot must be recalculated before serving.",
            )
        frame = pd.read_csv(self._forecast_path)
        if skus:
            wanted = {str(s).strip().upper() for s in skus}
            frame = frame[
                frame["material_code"].astype(str).str.upper().isin(wanted)
            ]
        frame = frame[frame["horizon"].astype(int).isin({int(h) for h in horizons})]
        points = [
            ForecastPoint(
                sku=str(row.material_code),
                category=str(row.material_type),
                horizon=int(row.horizon),
                period=str(row.forecast_period),
                p10=round(float(row.p10), 2),
                p50=round(float(row.p50), 2),
                p90=round(float(row.p90), 2),
            )
            for row in frame.sort_values(["material_code", "horizon"]).itertuples(index=False)
        ]
        return ForecastResponse(
            status="success",
            model=self.model_info(),
            warehouse_id=warehouse_id,
            forecasts=points,
            total_count=len(points),
            message=(
                f"Served {len(points)} v8 project-operational RM/PM forecast points "
                "from the governed recursive snapshot."
            ),
        )

    def model_info(self) -> ModelInfo:
        version = "v8"
        if self._metadata_path.exists():
            try:
                metadata = json.loads(self._metadata_path.read_text(encoding="utf-8"))
                version = str(metadata.get("model_id") or version)
            except (OSError, ValueError):
                pass
        return ModelInfo(
            name=self.MODEL_NAME.lower(),
            version=version,
            is_champion=True,
            fallback_used=False,
            fallback_method=None,
        )

    def health_check(self) -> dict[str, Any]:
        ready = self._forecast_path.exists() and self._metadata_path.exists()
        rows = 0
        if self._forecast_path.exists():
            try:
                rows = sum(1 for _ in self._forecast_path.open(encoding="utf-8")) - 1
            except OSError:
                rows = 0
        return {
            "provider": "v8_snapshot",
            "dataset": "PROJECT_OPS_RM_PM",
            "champion_model": self.MODEL_NAME,
            "total_artifacts": 1 if self._metadata_path.exists() else 0,
            "forecast_rows": max(rows, 0),
            "status": "ok" if ready and rows > 0 else "degraded",
        }


# ---------------------------------------------------------------------------
# Factory — the gateway router calls this to get the active provider
# ---------------------------------------------------------------------------

_active_provider: ForecastProvider | None = None


def get_active_provider() -> ForecastProvider:
    """Return the active forecast provider (singleton).

    The project-operational default serves the locked v8 batch snapshot.
    Set ``FORECAST_PROVIDER_TYPE=artifact`` to use the legacy online artifact
    inference provider.
    """
    global _active_provider
    if _active_provider is None:
        provider_type = (settings.forecast_provider_type or "v8_snapshot").strip().lower()
        if provider_type == "v8_snapshot":
            _active_provider = V8SnapshotForecastProvider()
        elif provider_type == "artifact":
            _active_provider = BoostingForecastProvider()
        else:
            raise ValueError(f"Unsupported FORECAST_PROVIDER_TYPE={provider_type!r}")
    return _active_provider


def reset_provider() -> None:
    """Reset the cached provider (useful for testing or config reload)."""
    global _active_provider
    _active_provider = None
