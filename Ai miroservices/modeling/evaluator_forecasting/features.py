from __future__ import annotations

from dataclasses import replace

import numpy as np
import pandas as pd
from scipy import signal
from statsmodels.tsa.seasonal import STL

from .contracts import (
    FUTURE_FEATURES,
    PAST_FEATURES,
    SPECTRAL_FEATURES,
    NormalizationStats,
    WindowBundle,
)


EPS = 1e-8
REQUIRED_COLUMNS = {
    "month",
    "material_id",
    "material_code",
    "material_type",
    "category",
    "lead_time_days",
    "demand_units",
}


def cyclic_month_features(months: pd.Series | pd.DatetimeIndex | np.ndarray) -> np.ndarray:
    values = pd.DatetimeIndex(pd.to_datetime(months)).month.to_numpy(dtype=float)
    angle = 2 * np.pi * (values - 1) / 12
    return np.column_stack([np.sin(angle), np.cos(angle), np.sin(2 * angle), np.cos(2 * angle)])


def spectral_summary(values: np.ndarray) -> np.ndarray:
    """Leakage-safe time/frequency summaries from one historical input window."""
    y = np.asarray(values, dtype=float)
    if y.ndim != 1 or len(y) < 12:
        raise ValueError("spectral_summary requires at least 12 one-dimensional observations")
    detrended = signal.detrend(np.log1p(np.clip(y, 0.0, None)), type="linear")
    spectrum = np.fft.rfft(detrended) / max(len(detrended), 1)
    frequencies = np.fft.rfftfreq(len(detrended), d=1.0)
    power = np.abs(spectrum) ** 2
    positive = frequencies > 0
    total = max(float(power[positive].sum()), EPS)

    def coefficient(target_frequency: float) -> complex:
        index = int(np.argmin(np.abs(frequencies - target_frequency)))
        return complex(spectrum[index])

    annual = coefficient(1 / 12)
    semiannual = coefficient(1 / 6)
    low = (frequencies > 0) & (frequencies <= 1 / 6 + EPS)
    normalized = power[positive] / total
    entropy = -float(np.sum(normalized * np.log(normalized + EPS))) / max(np.log(len(normalized) + EPS), EPS)
    annual_index = int(np.argmin(np.abs(frequencies - 1 / 12)))
    def lag_correlation(lag: int) -> float:
        left, right = detrended[:-lag], detrended[lag:]
        if np.std(left) < EPS or np.std(right) < EPS:
            return 0.0
        return float(np.corrcoef(left, right)[0, 1])

    acf_lag_1 = lag_correlation(1)
    acf_lag_12 = lag_correlation(12)
    pacf_lag_1 = acf_lag_1
    pacf_lags = 6
    response = detrended[pacf_lags:]
    design = np.column_stack(
        [detrended[pacf_lags - lag : len(detrended) - lag] for lag in range(1, pacf_lags + 1)]
    )
    try:
        pacf_lag_6 = float(np.linalg.lstsq(design, response, rcond=None)[0][-1])
    except np.linalg.LinAlgError:
        pacf_lag_6 = 0.0
    time = np.arange(len(detrended), dtype=float)
    trend_slope = float(np.polyfit(time, np.log1p(np.clip(y, 0.0, None)), 1)[0])
    try:
        decomposition = STL(np.log1p(np.clip(y, 0.0, None)), period=12, robust=False).fit()
        seasonal_denom = max(float(np.var(decomposition.resid + decomposition.seasonal)), EPS)
        trend_denom = max(float(np.var(decomposition.resid + decomposition.trend)), EPS)
        seasonal_strength = max(0.0, 1.0 - float(np.var(decomposition.resid)) / seasonal_denom)
        trend_strength = max(0.0, 1.0 - float(np.var(decomposition.resid)) / trend_denom)
    except Exception:
        seasonal_strength = 0.0
        trend_strength = 0.0
    return np.asarray(
        [
            annual.real,
            annual.imag,
            semiannual.real,
            semiannual.imag,
            float(power[low].sum() / total),
            float(power[annual_index] / total),
            entropy,
            acf_lag_1,
            acf_lag_12,
            pacf_lag_1,
            pacf_lag_6,
            trend_slope,
            seasonal_strength,
            trend_strength,
        ],
        dtype=np.float32,
    )


def _validate_panel(panel: pd.DataFrame) -> pd.DataFrame:
    missing = REQUIRED_COLUMNS - set(panel.columns)
    if missing:
        raise ValueError(f"forecast panel is missing columns: {sorted(missing)}")
    result = panel.copy()
    result["month"] = pd.to_datetime(result["month"]).dt.to_period("M").dt.to_timestamp()
    result = result.sort_values(["material_id", "month"]).reset_index(drop=True)
    optional_defaults = {
        "planned_bom_requirement": np.nan,
        "promotion_flag": np.nan,
        "shutdown_flag": np.nan,
        "active_fg_count": 0.0,
    }
    for column, default in optional_defaults.items():
        if column not in result:
            result[column] = default
    if result.duplicated(["material_id", "month"]).any():
        raise ValueError("forecast panel must have one row per material and month")
    return result


def _static_schema(panel: pd.DataFrame) -> tuple[pd.DataFrame, tuple[str, ...]]:
    metadata = panel.sort_values("month").groupby("material_id", as_index=False).tail(1)
    encoded = pd.get_dummies(
        metadata[["material_id", "material_type", "category"]],
        columns=["material_type", "category"],
        dtype=float,
    )
    encoded["lead_time_days"] = metadata["lead_time_days"].astype(float).to_numpy()
    columns = tuple(column for column in encoded.columns if column != "material_id")
    return encoded.set_index("material_id"), columns


def _static_at_history_end(history: pd.DataFrame, static_columns: tuple[str, ...]) -> pd.Series:
    """Encode static/context fields as observed at the end of this sample's history."""
    latest = history.iloc[-1]
    values = pd.Series(0.0, index=list(static_columns), dtype=float)
    material_type_column = f"material_type_{latest['material_type']}"
    category_column = f"category_{latest['category']}"
    if material_type_column in values.index:
        values.loc[material_type_column] = 1.0
    if category_column in values.index:
        values.loc[category_column] = 1.0
    values.loc["lead_time_days"] = float(latest["lead_time_days"])
    return values


def _flag(values: pd.Series) -> tuple[np.ndarray, np.ndarray]:
    available = values.notna().to_numpy(dtype=np.float32)
    filled = values.astype("boolean").fillna(False).to_numpy(dtype=np.float32)
    return filled, available


def _make_window(
    history: pd.DataFrame,
    future: pd.DataFrame,
    static_row: pd.Series,
    static_columns: tuple[str, ...],
    include_labels: bool,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray | None, float]:
    future = future.copy()
    origin = pd.Timestamp(future.iloc[0]["month"])
    source = str(future.iloc[0].get("source", "")).upper()
    generated_source = any(token in source for token in ["GENERATED", "SYNTHETIC", "CONTROLLED", "PROJECT_OPERATIONAL_BASELINE"])
    availability_contract = {
        "planned_bom_requirement": "planned_bom_known_at",
        "promotion_flag": "promotion_known_at",
        "shutdown_flag": "shutdown_known_at",
    }
    for value_column, known_column in availability_contract.items():
        if known_column in future.columns:
            known_at = pd.to_datetime(future[known_column], errors="coerce")
            future.loc[known_at.isna() | known_at.gt(origin), value_column] = np.nan
        elif not generated_source:
            # External future covariates without a provenance timestamp are not origin-known.
            future[value_column] = np.nan

    history_target = history["demand_units"].to_numpy(dtype=float)
    log_history = np.log1p(np.clip(history_target, 0.0, None))
    scale = max(float(np.mean(log_history)), 1.0)

    history_plan = history["planned_bom_requirement"]
    history_plan_available = history_plan.notna().to_numpy(dtype=np.float32)
    history_promotion, _ = _flag(history["promotion_flag"])
    history_shutdown, _ = _flag(history["shutdown_flag"])
    log_series = pd.Series(log_history)
    rolling_mean_3 = log_series.rolling(3, min_periods=1).mean().to_numpy() / scale
    rolling_mean_6 = log_series.rolling(6, min_periods=1).mean().to_numpy() / scale
    rolling_std_6 = log_series.rolling(6, min_periods=2).std().fillna(0).to_numpy() / scale
    rolling_mean_12 = log_series.rolling(12, min_periods=1).mean().to_numpy() / scale
    local_trend = np.clip(
        rolling_mean_3 / np.maximum(rolling_mean_12, EPS),
        0.1,
        10.0,
    )
    past = np.column_stack(
        [
            log_history / scale,
            np.log1p(history_plan.fillna(0).clip(lower=0).to_numpy(dtype=float)) / scale,
            history_plan_available,
            history_promotion,
            history_shutdown,
            history["active_fg_count"].fillna(0).to_numpy(dtype=float),
            rolling_mean_3,
            rolling_mean_6,
            rolling_std_6,
            rolling_mean_12,
            local_trend,
        ]
    ).astype(np.float32)

    cyclic = cyclic_month_features(future["month"])
    future_plan = future["planned_bom_requirement"]
    future_promotion, future_promotion_available = _flag(future["promotion_flag"])
    future_shutdown, future_shutdown_available = _flag(future["shutdown_flag"])
    future_features = np.column_stack(
        [
            cyclic,
            np.log1p(future_plan.fillna(0).clip(lower=0).to_numpy(dtype=float)) / scale,
            future_plan.notna().to_numpy(dtype=np.float32),
            future_promotion,
            future_promotion_available,
            future_shutdown,
            future_shutdown_available,
        ]
    ).astype(np.float32)
    static = static_row.loc[list(static_columns)].to_numpy(dtype=np.float32)
    labels = None
    if include_labels:
        labels = (np.log1p(np.clip(future["demand_units"].to_numpy(dtype=float), 0.0, None)) / scale).astype(np.float32)
    return past, future_features, spectral_summary(history_target), static, labels, scale


def _empty_bundle(history: int, horizon: int, static_columns: tuple[str, ...], include_labels: bool) -> WindowBundle:
    return WindowBundle(
        past=np.empty((0, history, len(PAST_FEATURES)), dtype=np.float32),
        future=np.empty((0, horizon, len(FUTURE_FEATURES)), dtype=np.float32),
        spectral=np.empty((0, len(SPECTRAL_FEATURES)), dtype=np.float32),
        static=np.empty((0, len(static_columns)), dtype=np.float32),
        labels=np.empty((0, horizon), dtype=np.float32) if include_labels else None,
        target_scale=np.empty((0,), dtype=np.float32),
        metadata=pd.DataFrame(),
        static_columns=static_columns,
    )


def build_training_windows(panel: pd.DataFrame, cutoff: str | pd.Timestamp, history: int = 24, horizon: int = 12) -> WindowBundle:
    frame = _validate_panel(panel)
    cutoff = pd.Timestamp(cutoff)
    _, static_columns = _static_schema(frame[frame["month"] < cutoff])
    arrays: list[tuple] = []
    records = []
    for material_id, group in frame[frame["month"] < cutoff].groupby("material_id", sort=False):
        group = group.sort_values("month").reset_index(drop=True)
        for start in range(0, len(group) - history - horizon + 1):
            past = group.iloc[start : start + history]
            future = group.iloc[start + history : start + history + horizon]
            if len(future) != horizon:
                continue
            arrays.append(
                _make_window(
                    past,
                    future,
                    _static_at_history_end(past, static_columns),
                    static_columns,
                    True,
                )
            )
            records.append(
                {
                    "material_id": material_id,
                    "material_code": group.iloc[0]["material_code"],
                    "material_type": group.iloc[0]["material_type"],
                    "origin_month": future.iloc[0]["month"],
                    "label_end_month": future.iloc[-1]["month"],
                }
            )
    if not arrays:
        return _empty_bundle(history, horizon, static_columns, True)
    past, future, spectral, static, labels, scales = zip(*arrays)
    return WindowBundle(
        past=np.stack(past),
        future=np.stack(future),
        spectral=np.stack(spectral),
        static=np.stack(static),
        labels=np.stack(labels),
        target_scale=np.asarray(scales, dtype=np.float32),
        metadata=pd.DataFrame(records),
        static_columns=static_columns,
    )


def build_prediction_windows(panel: pd.DataFrame, origin: str | pd.Timestamp, history: int = 24, horizon: int = 12) -> WindowBundle:
    frame = _validate_panel(panel)
    origin = pd.Timestamp(origin)
    _, static_columns = _static_schema(frame[frame["month"] < origin])
    arrays: list[tuple] = []
    records = []
    for material_id, group in frame.groupby("material_id", sort=False):
        group = group.sort_values("month").reset_index(drop=True)
        past = group[group["month"] < origin].tail(history)
        future = group[(group["month"] >= origin) & (group["month"] < origin + pd.DateOffset(months=horizon))].head(horizon)
        if len(past) != history or len(future) != horizon:
            continue
        arrays.append(
            _make_window(
                past,
                future,
                _static_at_history_end(past, static_columns),
                static_columns,
                True,
            )
        )
        records.append(
            {
                "material_id": material_id,
                "material_code": group.iloc[0]["material_code"],
                "material_type": group.iloc[0]["material_type"],
                "origin_month": origin,
            }
        )
    if not arrays:
        return _empty_bundle(history, horizon, static_columns, True)
    past, future, spectral, static, labels, scales = zip(*arrays)
    return WindowBundle(
        past=np.stack(past),
        future=np.stack(future),
        spectral=np.stack(spectral),
        static=np.stack(static),
        labels=np.stack(labels),
        target_scale=np.asarray(scales, dtype=np.float32),
        metadata=pd.DataFrame(records),
        static_columns=static_columns,
    )


def _mean_std(values: np.ndarray, axes: tuple[int, ...]) -> tuple[np.ndarray, np.ndarray]:
    mean = np.nanmean(values, axis=axes)
    std = np.nanstd(values, axis=axes)
    return np.asarray(mean, dtype=np.float32), np.where(std < EPS, 1.0, std).astype(np.float32)


def fit_normalizer(bundle: WindowBundle) -> NormalizationStats:
    if len(bundle.past) == 0:
        raise ValueError("cannot fit normalization on an empty bundle")
    past_mean, past_std = _mean_std(bundle.past, (0, 1))
    future_mean, future_std = _mean_std(bundle.future, (0, 1))
    spectral_mean, spectral_std = _mean_std(bundle.spectral, (0,))
    static_mean, static_std = _mean_std(bundle.static, (0,))
    return NormalizationStats(
        past_mean,
        past_std,
        future_mean,
        future_std,
        spectral_mean,
        spectral_std,
        static_mean,
        static_std,
    )


def transform_windows(bundle: WindowBundle, stats: NormalizationStats) -> WindowBundle:
    return replace(
        bundle,
        past=((bundle.past - stats.past_mean) / stats.past_std).astype(np.float32),
        future=((bundle.future - stats.future_mean) / stats.future_std).astype(np.float32),
        spectral=((bundle.spectral - stats.spectral_mean) / stats.spectral_std).astype(np.float32),
        static=((bundle.static - stats.static_mean) / stats.static_std).astype(np.float32),
    )


def apply_ablation(bundle: WindowBundle, group: str) -> WindowBundle:
    if group not in {"time_only", "cyclic", "spectral", "known_future", "full"}:
        raise ValueError(f"unknown ablation group: {group}")
    result = bundle.subset(np.arange(len(bundle.past)))
    if group == "full":
        return result
    # Target history is the first channel. Calendar cycles are the first four future channels.
    result.past[:, :, 1:] = 0.0
    result.future[:, :, :] = 0.0
    result.spectral[:, :] = 0.0
    if group in {"cyclic", "spectral", "known_future"}:
        result.future[:, :, :4] = bundle.future[:, :, :4]
    if group == "spectral":
        result.spectral[:, :] = bundle.spectral
    if group == "known_future":
        result.future[:, :, :] = bundle.future
        result.past[:, :, :] = bundle.past
    return result
