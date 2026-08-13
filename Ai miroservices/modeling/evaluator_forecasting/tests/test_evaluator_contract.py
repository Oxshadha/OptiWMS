from __future__ import annotations

import inspect
from dataclasses import replace

import numpy as np
import pandas as pd

from evaluator_forecasting.contracts import EvaluatorConfig
from evaluator_forecasting.features import (
    build_prediction_windows,
    build_training_windows,
    cyclic_month_features,
    fit_normalizer,
    spectral_summary,
)
from evaluator_forecasting.neural import build_conv_attention_model


def _panel(months: int = 60, series: int = 3) -> pd.DataFrame:
    dates = pd.date_range("2020-01-01", periods=months, freq="MS")
    rows = []
    for material in range(series):
        for index, month in enumerate(dates):
            target = 100 + 20 * np.sin(2 * np.pi * index / 12 + material / 3)
            rows.append(
                {
                    "month": month,
                    "material_id": material,
                    "material_code": f"RM-{material:04d}",
                    "material_type": "raw_material",
                    "category": "TEST",
                    "lead_time_days": 15 + material,
                    "demand_units": target,
                    "planned_bom_requirement": target * 0.95,
                    "promotion_flag": month.month == 12,
                    "shutdown_flag": False,
                    "active_fg_count": 2,
                }
            )
    return pd.DataFrame(rows)


def test_month_cycles_wrap_without_artificial_boundary():
    features = cyclic_month_features(pd.to_datetime(["2025-11-01", "2025-12-01", "2026-01-01"]))
    november_to_december = np.linalg.norm(features[0, :2] - features[1, :2])
    december_to_january = np.linalg.norm(features[1, :2] - features[2, :2])
    assert np.isclose(november_to_december, december_to_january)


def test_spectral_summary_recovers_annual_signal():
    values = 100 + 30 * np.sin(2 * np.pi * np.arange(24) / 12)
    summary = spectral_summary(values)
    assert summary.shape == (14,)
    assert summary[5] > 0.80


def test_window_shapes_and_quantile_model_contract():
    panel = _panel()
    training = build_training_windows(panel, "2024-01-01")
    prediction = build_prediction_windows(panel, "2024-01-01")
    assert training.past.shape[1:] == (24, 11)
    assert training.future.shape[1:] == (12, 10)
    assert training.labels.shape[1] == 12
    assert prediction.past.shape == (3, 24, 11)
    model, _ = build_conv_attention_model(training, replace(EvaluatorConfig(), max_epochs=1))
    output = model.predict(
        [prediction.past, prediction.future, prediction.spectral, prediction.static],
        verbose=0,
    )
    assert output.shape == (3, 12, 6)
    assert np.all(np.diff(output, axis=-1) >= 0)


def test_model_initialization_is_deterministic_for_fixed_seed():
    import keras

    training = build_training_windows(_panel(), "2024-01-01")
    cfg = replace(EvaluatorConfig(), max_epochs=1)
    keras.utils.set_random_seed(123)
    first, _ = build_conv_attention_model(training, cfg)
    first_weights = [value.copy() for value in first.get_weights()]
    keras.backend.clear_session()
    keras.utils.set_random_seed(123)
    second, _ = build_conv_attention_model(training, cfg)
    for expected, actual in zip(first_weights, second.get_weights()):
        np.testing.assert_allclose(expected, actual)


def test_future_actuals_do_not_change_origin_features():
    panel = _panel()
    baseline = build_prediction_windows(panel, "2024-01-01")
    changed = panel.copy()
    changed.loc[changed["month"] >= "2024-01-01", "demand_units"] *= 1000
    mutated = build_prediction_windows(changed, "2024-01-01")
    np.testing.assert_allclose(baseline.past, mutated.past)
    np.testing.assert_allclose(baseline.spectral, mutated.spectral)


def test_unstamped_external_future_covariates_are_not_treated_as_known():
    panel = _panel()
    panel["source"] = "EXTERNAL_OPERATIONAL"
    windows = build_prediction_windows(panel, "2024-01-01")
    assert np.all(windows.future[:, :, 5] == 0)  # plan availability
    assert np.all(windows.future[:, :, 7] == 0)  # promotion availability
    assert np.all(windows.future[:, :, 9] == 0)  # shutdown availability


def test_normalizer_is_fitted_only_from_passed_training_bundle():
    panel = _panel()
    windows = build_training_windows(panel, "2024-01-01")
    early = windows.subset(np.flatnonzero(windows.metadata["label_end_month"] < pd.Timestamp("2023-09-01")))
    stats = fit_normalizer(early)
    changed = windows.subset(np.arange(len(windows.past)))
    changed.past[-1] *= 1000
    repeated = fit_normalizer(early)
    assert stats.to_dict() == repeated.to_dict()


def test_random_kfold_is_not_present_in_evaluator_sources():
    import evaluator_forecasting.features as features
    import evaluator_forecasting.neural as neural

    source = inspect.getsource(features) + inspect.getsource(neural)
    assert "KFold" not in source
    assert "train_test_split" not in source
