from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


QUANTILES = np.asarray([0.10, 0.50, 2 / 3, 0.75, 5 / 6, 0.90], dtype=np.float32)
PAST_FEATURES = (
    "scaled_log_demand",
    "scaled_log_plan",
    "plan_available",
    "promotion_flag",
    "shutdown_flag",
    "active_fg_count",
    "rolling_mean_3",
    "rolling_mean_6",
    "rolling_std_6",
    "rolling_mean_12",
    "local_trend_3_to_12",
)
FUTURE_FEATURES = (
    "month_sin",
    "month_cos",
    "halfyear_sin",
    "halfyear_cos",
    "scaled_log_plan",
    "plan_available",
    "promotion_flag",
    "promotion_available",
    "shutdown_flag",
    "shutdown_available",
)
SPECTRAL_FEATURES = (
    "annual_real",
    "annual_imag",
    "semiannual_real",
    "semiannual_imag",
    "low_frequency_power_ratio",
    "annual_power_ratio",
    "spectral_entropy",
    "acf_lag_1",
    "acf_lag_12",
    "pacf_lag_1",
    "pacf_lag_6",
    "linear_trend_slope",
    "stl_seasonal_strength",
    "stl_trend_strength",
)


@dataclass(frozen=True)
class EvaluatorConfig:
    history: int = 24
    horizon: int = 12
    seeds: tuple[int, ...] = (17, 42, 101, 303, 707)
    selection_origins: tuple[str, ...] = (
        "2023-07-01",
        "2023-08-01",
        "2023-09-01",
        "2023-10-01",
        "2023-11-01",
        "2023-12-01",
        "2024-01-01",
    )
    test_origin: str = "2025-01-01"
    validation_cutpoints: int = 2
    max_epochs: int = 120
    patience: int = 12
    batch_size: int = 64
    learning_rate: float = 1e-3
    bootstrap_samples: int = 500
    spectral_bootstrap_samples: int = 200
    alpha: float = 0.05


@dataclass
class WindowBundle:
    past: np.ndarray
    future: np.ndarray
    spectral: np.ndarray
    static: np.ndarray
    labels: np.ndarray | None
    target_scale: np.ndarray
    metadata: pd.DataFrame
    static_columns: tuple[str, ...]

    def subset(self, indexes: np.ndarray | list[int]) -> "WindowBundle":
        idx = np.asarray(indexes)
        return WindowBundle(
            past=self.past[idx],
            future=self.future[idx],
            spectral=self.spectral[idx],
            static=self.static[idx],
            labels=None if self.labels is None else self.labels[idx],
            target_scale=self.target_scale[idx],
            metadata=self.metadata.iloc[idx].reset_index(drop=True),
            static_columns=self.static_columns,
        )


@dataclass(frozen=True)
class NormalizationStats:
    past_mean: np.ndarray
    past_std: np.ndarray
    future_mean: np.ndarray
    future_std: np.ndarray
    spectral_mean: np.ndarray
    spectral_std: np.ndarray
    static_mean: np.ndarray
    static_std: np.ndarray

    def to_dict(self) -> dict:
        return {
            field: np.asarray(getattr(self, field), dtype=float).tolist()
            for field in self.__dataclass_fields__
        }
