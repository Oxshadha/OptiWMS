"""SHAP explanations for the v8 causal ExtraTrees forecast.

The attributions themselves are computed in the modelling pipeline
(``pipeline/explainability.py``), because that is the only place the exact
feature frame behind each recursive step exists. Reconstructing it here would
duplicate the feature logic and risk train/serve skew. This module loads the
pipeline's output into ``forecast_shap_explanations`` at publish time and serves
it back per SKU/horizon.

**Everything is stored in log space.** The model is fitted on ``log1p(demand)``,
so SHAP is additive there and nowhere else:

    base_value + sum(shap_value) == prediction        (explanation space)

``baseline_units`` / ``prediction_units`` carry the ``expm1`` view, and each
contribution carries its own ``delta_units``. Those deltas are a
cumulative-walk decomposition, so they sum to
``prediction_units - baseline_units`` but are ordering-dependent. A log-space
value must never be presented as a unit count -- a baseline of 8.38 in log space
is 4,351 units.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session

from app.db.models import ForecastShapExplanation

logger = logging.getLogger(__name__)

SHAP_SNAPSHOT_FILENAME = "operational_shap.csv"

_REQUIRED_COLUMNS = {
    "material_code", "horizon", "rank", "feature", "label",
    "shap_value_log", "feature_value", "delta_units", "lag_provenance",
    "base_value_log", "prediction_log", "baseline_units", "prediction_units",
}


def load_shap_snapshot(
    db: Session,
    run_id: int,
    output_dir: Path,
    dataset: str,
    model_name: str,
) -> int:
    """Load ``operational_shap.csv`` into ``forecast_shap_explanations``.

    Returns the number of (SKU, horizon) explanations persisted. A missing file
    is not an error -- an older pipeline run simply produced no attributions, and
    the forecast is still publishable without them.
    """
    path = Path(output_dir) / SHAP_SNAPSHOT_FILENAME
    if not path.exists():
        logger.warning(
            "shap_service: %s not found; publishing forecast without explanations. "
            "Re-run the modelling pipeline to generate it.", path,
        )
        return 0

    frame = pd.read_csv(path)
    missing = _REQUIRED_COLUMNS - set(frame.columns)
    if missing:
        raise ValueError(
            f"{path} is missing required columns: {sorted(missing)}. "
            "It was probably written by an older pipeline version."
        )

    inserted = 0
    for (sku, horizon), group in frame.groupby(["material_code", "horizon"], sort=False):
        group = group.sort_values("rank")
        first = group.iloc[0]

        contributions: list[dict[str, Any]] = [
            {
                "feature": row["feature"],
                "label": row["label"],
                # Log space: this is what satisfies the additivity guarantee.
                "shap_value": round(float(row["shap_value_log"]), 9),
                # Units space: display only, ordering-dependent.
                "delta_units": round(float(row["delta_units"]), 2),
                "feature_value": (
                    None if pd.isna(row["feature_value"]) else round(float(row["feature_value"]), 4)
                ),
                "lag_provenance": row["lag_provenance"],
            }
            for _, row in group.iterrows()
        ]

        db.add(ForecastShapExplanation(
            run_id=run_id,
            dataset=dataset,
            model_name=model_name,
            sku=str(sku),
            horizon=int(horizon),
            top_features_json=json.dumps(contributions),
            explanation_space="log1p",
            base_value=float(first["base_value_log"]),
            prediction=float(first["prediction_log"]),
            baseline_units=float(first["baseline_units"]),
            prediction_units=float(first["prediction_units"]),
        ))
        inserted += 1

    logger.info("shap_service: persisted %d SHAP explanations for run %d", inserted, run_id)
    return inserted


def query_shap_explanation(
    db: Session,
    sku: str,
    horizon: int,
    dataset: str | None = None,
    model_name: str | None = None,
) -> dict[str, Any] | None:
    """Most recent SHAP explanation for a SKU/horizon, ready for JSON serialization."""
    query = (
        db.query(ForecastShapExplanation)
        .filter(ForecastShapExplanation.sku == sku)
        .filter(ForecastShapExplanation.horizon == horizon)
    )
    if dataset:
        query = query.filter(ForecastShapExplanation.dataset == dataset)
    if model_name:
        query = query.filter(ForecastShapExplanation.model_name == model_name)

    row = query.order_by(ForecastShapExplanation.created_at.desc()).first()
    if not row:
        return None

    try:
        top_features = json.loads(row.top_features_json)
    except (json.JSONDecodeError, TypeError):
        top_features = []

    return {
        "sku": row.sku,
        "horizon": row.horizon,
        "dataset": row.dataset,
        "model_name": row.model_name,
        "explanation_space": row.explanation_space,
        # Explanation space -- these are the values that reconstruct the prediction.
        "base_value": row.base_value,
        "prediction": row.prediction,
        # Units space -- for display.
        "baseline_units": row.baseline_units,
        "prediction_units": row.prediction_units,
        "top_features": top_features,
        "additivity": "base_value + sum(top_features[].shap_value) == prediction",
        "computed_at": row.created_at.isoformat() if row.created_at else None,
    }
