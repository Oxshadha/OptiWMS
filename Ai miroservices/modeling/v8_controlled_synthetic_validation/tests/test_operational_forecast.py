from __future__ import annotations

import numpy as np
import pandas as pd

from pipeline.modeling import CAUSAL_FEATURES, build_features
from pipeline.operational_forecast import (
    OUTPUT,
    _new_model,
    recursive_forecast,
)


def test_persisted_operational_snapshot_is_ordered_and_complete():
    frame = pd.read_csv(OUTPUT / "operational_forecasts.csv")
    assert len(frame) == 120 * 12
    assert frame["material_code"].nunique() == 120
    assert sorted(frame["horizon"].unique()) == list(range(1, 13))
    assert (frame["p10"] <= frame["p50"]).all()
    assert (frame["p50"] <= frame["p90"]).all()
    assert frame["decision_eligible"].all()
    assert set(frame["external_population_validity"]) == {"UNVERIFIED"}
    comparison = pd.read_csv(OUTPUT / "operational_model_comparison.csv").iloc[0]
    assert comparison["paired_rows"] == 120 * 12
    assert comparison["champion_WAPE"] < comparison["challenger_WAPE"]
    assert comparison["circular_block_bootstrap_ci_high"] < 0
    assert comparison["decision"] == "RETAIN_EXTRA_TREES"


def test_recursive_forecast_does_not_use_future_actual_demand():
    demand = pd.read_csv(OUTPUT / "data" / "material_demand.csv", parse_dates=["month"])
    origin = pd.Timestamp("2025-01-01")
    supervised = build_features(demand)
    train = supervised[supervised["target_month"] < origin]
    model = _new_model()
    model.fit(train[CAUSAL_FEATURES], np.log1p(train["target"]))

    known = demand[demand["month"].between(origin, "2025-12-01")].copy()
    changed = known.copy()
    changed["demand_units"] = changed["demand_units"] * 1000 + 999999
    baseline = recursive_forecast(model, demand, known, origin)
    perturbed = recursive_forecast(model, demand, changed, origin)

    np.testing.assert_allclose(
        baseline["prediction"].to_numpy(),
        perturbed["prediction"].to_numpy(),
        rtol=0,
        atol=1e-8,
    )
