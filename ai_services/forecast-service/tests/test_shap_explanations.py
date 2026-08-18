"""Faithfulness tests for the forecast SHAP explanations.

The point of these tests is not that SHAP produces *some* numbers, but that the
numbers reconstruct the prediction they claim to explain. An explanation that
does not add up is decoration.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import pandas as pd
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import Base, ForecastRun, ForecastShapExplanation
from app.services.shap_service import load_shap_snapshot, query_shap_explanation

PIPELINE_OUTPUT = (
    Path(__file__).resolve().parents[3]
    / "Ai miroservices"
    / "modeling"
    / "v8_controlled_synthetic_validation"
    / "outputs"
)
SNAPSHOT = PIPELINE_OUTPUT / "operational_shap.csv"

requires_snapshot = pytest.mark.skipif(
    not SNAPSHOT.exists(),
    reason="operational_shap.csv not generated; run the modelling pipeline first",
)


@pytest.fixture()
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path/'t.db'}")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    session.add(ForecastRun(
        id=1, dataset="PROJECT_OPS_RM_PM", model_name="PROJECT_OPS_EXTRA_TREES_CAUSAL",
        model_version="V8", warehouse_id="WH-001", status="published",
    ))
    session.commit()
    yield session
    session.close()


@pytest.fixture()
def loaded(db):
    load_shap_snapshot(
        db=db, run_id=1, output_dir=PIPELINE_OUTPUT,
        dataset="PROJECT_OPS_RM_PM", model_name="PROJECT_OPS_EXTRA_TREES_CAUSAL",
    )
    db.commit()
    return db


# ── The core guarantee ───────────────────────────────────────────────────────

@requires_snapshot
def test_additivity_holds_in_log_space(loaded):
    """base_value + sum(contributions) must reconstruct the model output.

    This is what separates a faithful attribution from a plausible-looking one.
    """
    rows = loaded.query(ForecastShapExplanation).all()
    assert rows, "no explanations loaded"
    worst = 0.0
    for row in rows:
        total = sum(f["shap_value"] for f in json.loads(row.top_features_json))
        worst = max(worst, abs(row.base_value + total - row.prediction))
    assert worst < 1e-6, f"additivity violated: max error {worst:.3e}"


@requires_snapshot
def test_units_deltas_reconcile_to_the_prediction(loaded):
    """The units-space view must sum to prediction - baseline, not to the log sum."""
    for row in loaded.query(ForecastShapExplanation).limit(200):
        delta = sum(f["delta_units"] for f in json.loads(row.top_features_json))
        expected = row.prediction_units - row.baseline_units
        assert abs(delta - expected) < 0.5, f"{row.sku} h{row.horizon}: {delta} vs {expected}"


@requires_snapshot
def test_log_and_units_spaces_are_not_confused(loaded):
    """expm1(base_value) must equal baseline_units.

    Guards the specific bug this replaced: a log-space baseline of 8.38 was being
    rendered as '8.4 units' when it means 4,351 units.
    """
    row = loaded.query(ForecastShapExplanation).first()
    assert row.explanation_space == "log1p"
    assert math.isclose(math.expm1(row.base_value), row.baseline_units, rel_tol=1e-6)
    assert math.isclose(math.expm1(row.prediction), row.prediction_units, rel_tol=1e-6)


# ── Explanation quality ──────────────────────────────────────────────────────

@requires_snapshot
def test_row_identity_is_not_reported_as_a_driver(loaded):
    """material_code_enc is an ordinal row id; ranking it as a 'driver' is meaningless."""
    for row in loaded.query(ForecastShapExplanation).limit(200):
        names = {f["feature"] for f in json.loads(row.top_features_json)}
        assert "material_code_enc" not in names
        assert "material_type_enc" not in names


@requires_snapshot
def test_every_contribution_carries_a_human_label(loaded):
    for row in loaded.query(ForecastShapExplanation).limit(200):
        for f in json.loads(row.top_features_json):
            assert f["label"] and f["label"] != f["feature"], f"unlabelled: {f['feature']}"


@requires_snapshot
def test_recursive_horizons_declare_predicted_lags(loaded):
    """At h=1 every input is observed; deeper horizons must admit that their lags
    are the model's own output fed back in."""
    h1 = loaded.query(ForecastShapExplanation).filter_by(horizon=1).first()
    assert {f["lag_provenance"] for f in json.loads(h1.top_features_json)} <= {"observed", "mixed"}

    deep = loaded.query(ForecastShapExplanation).filter_by(horizon=12).all()
    flags = {f["lag_provenance"] for r in deep for f in json.loads(r.top_features_json)}
    assert "predicted" in flags or "partly_predicted" in flags


@requires_snapshot
def test_query_returns_a_complete_envelope(loaded):
    row = loaded.query(ForecastShapExplanation).first()
    result = query_shap_explanation(loaded, sku=row.sku, horizon=row.horizon)
    for key in ("explanation_space", "base_value", "prediction",
                "baseline_units", "prediction_units", "top_features", "additivity"):
        assert key in result


def test_missing_snapshot_is_not_fatal(db, tmp_path):
    """An older pipeline run produced no attributions; the forecast still publishes."""
    assert load_shap_snapshot(
        db=db, run_id=1, output_dir=tmp_path,
        dataset="PROJECT_OPS_RM_PM", model_name="PROJECT_OPS_EXTRA_TREES_CAUSAL",
    ) == 0


def test_malformed_snapshot_is_rejected_loudly(db, tmp_path):
    """A truncated CSV must fail rather than persist half an explanation."""
    pd.DataFrame({"material_code": ["RM-0001"], "horizon": [1]}).to_csv(
        tmp_path / "operational_shap.csv", index=False)
    with pytest.raises(ValueError, match="missing required columns"):
        load_shap_snapshot(
            db=db, run_id=1, output_dir=tmp_path,
            dataset="PROJECT_OPS_RM_PM", model_name="PROJECT_OPS_EXTRA_TREES_CAUSAL",
        )
