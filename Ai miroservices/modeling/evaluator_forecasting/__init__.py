"""Evaluator-grade time-series evidence shared by the v8 and canonical notebooks."""

from .contracts import EvaluatorConfig, QUANTILES, WindowBundle
from .features import (
    apply_ablation,
    build_prediction_windows,
    build_training_windows,
    cyclic_month_features,
    fit_normalizer,
    spectral_summary,
    transform_windows,
)

__all__ = [
    "EvaluatorConfig",
    "QUANTILES",
    "WindowBundle",
    "apply_ablation",
    "build_prediction_windows",
    "build_training_windows",
    "cyclic_month_features",
    "fit_normalizer",
    "spectral_summary",
    "transform_windows",
]
