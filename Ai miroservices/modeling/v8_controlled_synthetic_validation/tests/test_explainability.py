"""Unit tests for SHAP attribution behaviour.

These use a small purpose-built model rather than the champion, so each rule can
be exercised on data constructed to trigger it. The champion-scale faithfulness
checks live in forecast-service's test_shap_explanations.py.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
from sklearn.ensemble import ExtraTreesRegressor

from pipeline.explainability import (
    FEATURE_LABELS,
    OTHER_BUCKET,
    explain_frame,
    label_for,
    lag_provenance,
    to_units_deltas,
)
from pipeline.modeling import CAUSAL_FEATURES


@pytest.fixture(scope="module")
def identity_driven_model():
    """A model where row identity is deliberately the dominant signal.

    Without the identity filter, material_code_enc would top the ranked drivers
    on this data -- which is what makes the filter testable rather than
    hypothetical.
    """
    rng = np.random.default_rng(7)
    n = 400
    frame = pd.DataFrame(
        rng.uniform(1.0, 50.0, size=(n, len(CAUSAL_FEATURES))), columns=CAUSAL_FEATURES
    )
    frame["material_code_enc"] = rng.integers(0, 20, n).astype(float)
    # Target is driven almost entirely by the identity encoding.
    target = frame["material_code_enc"] * 100.0 + rng.normal(0, 0.5, n)
    model = ExtraTreesRegressor(n_estimators=40, random_state=0).fit(frame, np.log1p(target))
    return model, frame


def _identifiers(n: int) -> pd.DataFrame:
    return pd.DataFrame({
        "material_id": range(n),
        "material_code": [f"RM-{i:04d}" for i in range(n)],
        "target_month": ["2026-01-01"] * n,
    })


def test_identity_is_excluded_but_its_contribution_is_kept(identity_driven_model):
    """Row identity must not be ranked as a driver, yet dropping its contribution
    outright would break additivity -- it belongs in the __other__ bucket."""
    model, frame = identity_driven_model
    sample = frame.head(25).reset_index(drop=True)
    result = explain_frame(model, sample, _identifiers(25), horizon=1, top_n=5)

    # Named literally, not via IDENTITY_FEATURES: asserting against the same
    # constant the code filters on would pass even if the filter were emptied.
    ranked = set(result[result.feature != OTHER_BUCKET].feature)
    assert "material_code_enc" not in ranked, "row identity was reported as a demand driver"
    assert "material_type_enc" not in ranked
    # Additivity survives regardless: base + every slot == prediction.
    per_row = result.groupby("material_code").agg(
        total=("shap_value_log", "sum"),
        base=("base_value_log", "first"),
        pred=("prediction_log", "first"),
    )
    assert np.abs(per_row.base + per_row.total - per_row.pred).max() < 1e-6


def test_additivity_assertion_fires_on_a_mismatched_model(identity_driven_model):
    """explain_frame must refuse to emit an explanation it cannot reconcile."""
    model, frame = identity_driven_model

    import shap

    class Detuned:
        """Predicts something the tree structure does not account for."""
        def __init__(self, inner): self._inner = inner
        def predict(self, X): return self._inner.predict(X) + 5.0

    # The explainer is built from the real trees; only predict() disagrees, which
    # is exactly the train/serve skew the assertion exists to catch.
    with pytest.raises(AssertionError, match="additivity violated"):
        explain_frame(Detuned(model), frame.head(5).reset_index(drop=True),
                      _identifiers(5), horizon=1, top_n=3,
                      explainer=shap.TreeExplainer(model))


def test_every_model_feature_has_a_label():
    assert set(CAUSAL_FEATURES) == set(FEATURE_LABELS), (
        "FEATURE_LABELS must cover exactly the model's features"
    )


def test_unknown_feature_raises_rather_than_guessing():
    with pytest.raises(KeyError, match="No label for feature"):
        label_for("some_new_column")


@pytest.mark.parametrize(
    "feature,horizon,expected",
    [
        ("lag_1", 1, "observed"),      # nothing predicted yet
        ("lag_1", 2, "predicted"),     # month 1 was the model's own output
        ("lag_1", 12, "predicted"),
        ("lag_12", 12, "observed"),    # reaches back past the recursion
        ("lag_3", 4, "predicted"),   # reaches the origin month, which step 1 predicted
        ("lag_3", 3, "observed"),    # reaches origin-1, still real history
        ("roll_mean_6", 1, "observed"),
        ("roll_mean_6", 4, "partly_predicted"),
        ("promotion_flag", 9, "observed"),
    ],
)
def test_lag_provenance(feature, horizon, expected):
    assert lag_provenance(feature, horizon) == expected


def test_units_deltas_sum_to_the_units_gap():
    base = 8.3783
    contributions = [0.9, -0.4, 0.25, -0.05]
    deltas = to_units_deltas(base, contributions)
    expected = float(np.expm1(base + sum(contributions)) - np.expm1(base))
    assert abs(sum(deltas) - expected) < 1e-6


def test_row_count_mismatch_is_rejected(identity_driven_model):
    """Misaligned identifiers would attribute one material's drivers to another."""
    model, frame = identity_driven_model
    with pytest.raises(ValueError, match="Row mismatch"):
        explain_frame(model, frame.head(10).reset_index(drop=True),
                      _identifiers(9), horizon=1)
