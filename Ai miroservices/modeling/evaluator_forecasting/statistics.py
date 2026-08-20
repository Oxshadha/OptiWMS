from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
from scipy import signal, stats
from statsmodels.api import OLS, add_constant
from statsmodels.stats.diagnostic import acorr_ljungbox, het_breuschpagan
from statsmodels.stats.multitest import multipletests
from statsmodels.tsa.seasonal import STL
from statsmodels.tsa.stattools import adfuller, kpss

from .contracts import EvaluatorConfig


EPS = 1e-9


def aggregate_metrics(rows: pd.DataFrame, split: str) -> pd.DataFrame:
    output = []
    for model_name, group in rows.groupby("model_name"):
        residual = group["y_true"] - group["prediction"]
        denominator = max(float(group["y_true"].abs().sum()), EPS)
        output.append(
            {
                "split": split,
                "model_name": model_name,
                "rows": int(len(group)),
                "series": int(group["material_id"].nunique()),
                "WAPE": float(residual.abs().sum() / denominator),
                "MAE": float(residual.abs().mean()),
                "RMSE": float(np.sqrt(np.mean(residual**2))),
                "Bias": float(residual.sum() / denominator),
                "under_forecast_rate": float((residual > 0).mean()),
                "selection_score": float(residual.abs().sum() / denominator + 0.5 * abs(residual.sum() / denominator)),
            }
        )
    return pd.DataFrame(output).sort_values(["selection_score", "WAPE", "MAE"]).reset_index(drop=True)


def _annual_power(values: np.ndarray) -> float:
    frequencies, power = signal.periodogram(np.log1p(np.clip(values, 0, None)), detrend="linear")
    index = int(np.argmin(np.abs(frequencies - 1 / 12)))
    return float(power[index] / max(float(power[frequencies > 0].sum()), EPS))


def spectral_stationarity_audit(panel: pd.DataFrame, cfg: EvaluatorConfig) -> pd.DataFrame:
    rng = np.random.default_rng(20260725)
    rows = []
    for material_id, group in panel.sort_values("month").groupby("material_id"):
        values = group["demand_units"].to_numpy(dtype=float)
        transformed = np.log1p(np.clip(values, 0, None))
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            try:
                adf_p = float(adfuller(transformed, autolag="AIC")[1])
            except Exception:
                adf_p = np.nan
            try:
                kpss_p = float(kpss(transformed, regression="ct", nlags="auto")[1])
            except Exception:
                kpss_p = np.nan
        try:
            decomposition = STL(transformed, period=12, robust=True).fit()
            denominator = max(float(np.var(decomposition.resid + decomposition.seasonal)), EPS)
            seasonal_strength = max(0.0, 1.0 - float(np.var(decomposition.resid)) / denominator)
        except Exception:
            seasonal_strength = np.nan

        detrended = signal.detrend(transformed)
        phi = float(np.corrcoef(detrended[:-1], detrended[1:])[0, 1]) if len(detrended) > 2 else 0.0
        phi = float(np.clip(np.nan_to_num(phi), -0.95, 0.95))
        innovations = detrended[1:] - phi * detrended[:-1]
        innovation_std = max(float(np.std(innovations, ddof=1)), EPS)
        observed = _annual_power(values)
        null_power = []
        for _ in range(cfg.spectral_bootstrap_samples):
            simulated = np.zeros_like(detrended)
            simulated[0] = rng.normal(scale=innovation_std / max(np.sqrt(1 - phi**2), EPS))
            for index in range(1, len(simulated)):
                simulated[index] = phi * simulated[index - 1] + rng.normal(scale=innovation_std)
            frequencies, power = signal.periodogram(simulated, detrend="linear")
            annual_index = int(np.argmin(np.abs(frequencies - 1 / 12)))
            null_power.append(float(power[annual_index] / max(float(power[frequencies > 0].sum()), EPS)))
        p_value = float((1 + np.sum(np.asarray(null_power) >= observed)) / (len(null_power) + 1))
        rows.append(
            {
                "material_id": material_id,
                "material_code": group.iloc[0]["material_code"],
                "material_type": group.iloc[0]["material_type"],
                "observations": len(values),
                "adf_p_value": adf_p,
                "kpss_trend_p_value": kpss_p,
                "stationarity_evidence": "SUPPORTED" if adf_p < cfg.alpha and kpss_p >= cfg.alpha else "REJECTED",
                "annual_power_ratio": observed,
                "seasonal_strength": seasonal_strength,
                "annual_red_noise_p_value": p_value,
            }
        )
    result = pd.DataFrame(rows)
    valid = result["annual_red_noise_p_value"].notna()
    result["annual_red_noise_fdr_p_value"] = np.nan
    if valid.any():
        result.loc[valid, "annual_red_noise_fdr_p_value"] = multipletests(
            result.loc[valid, "annual_red_noise_p_value"], method="fdr_bh"
        )[1]
    result["annual_seasonality_evidence"] = np.where(
        result["annual_red_noise_fdr_p_value"] < cfg.alpha, "SUPPORTED", "REJECTED"
    )
    result["interpretation"] = "Stationarity is diagnostic, not a requirement for tree or neural candidates."
    return result


def calibrate_intervals(selection_rows: pd.DataFrame, test_rows: pd.DataFrame) -> pd.DataFrame:
    result = test_rows.copy()
    result["forecast_p10"] = np.nan
    result["forecast_p90"] = np.nan
    for model_name, selection in selection_rows.groupby("model_name"):
        target = result["model_name"].eq(model_name)
        if not target.any():
            continue
        normalized = selection["residual"] / selection["prediction"].clip(lower=1.0)
        lower, upper = normalized.quantile([0.10, 0.90], interpolation="higher")
        result.loc[target, "forecast_p10"] = (
            result.loc[target, "prediction"] * (1 + lower)
        ).clip(lower=0)
        result.loc[target, "forecast_p90"] = (
            result.loc[target, "prediction"] * (1 + upper)
        ).clip(lower=0)
    neural = result["model_name"].eq("CONV1D_ATTENTION_GLOBAL")
    if neural.any() and {"p10", "p90"}.issubset(result):
        result.loc[neural, "forecast_p10"] = result.loc[neural, "p10"]
        result.loc[neural, "forecast_p90"] = result.loc[neural, "p90"]
    result["interval_covered"] = result["y_true"].between(result["forecast_p10"], result["forecast_p90"])
    return result


def interval_calibration(rows: pd.DataFrame, cfg: EvaluatorConfig) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    output = []
    for model_name, group in rows.groupby("model_name"):
        covered = group["interval_covered"].astype(float).to_numpy()
        months = sorted(pd.to_datetime(group["forecast_month"]).unique())
        monthly = [
            group[pd.to_datetime(group["forecast_month"]).eq(month)]["interval_covered"].mean()
            for month in months
        ]
        bootstrap = [
            float(np.mean(rng.choice(monthly, size=len(monthly), replace=True)))
            for _ in range(cfg.bootstrap_samples)
        ]
        output.append(
            {
                "model_name": model_name,
                "nominal_coverage": 0.80,
                "empirical_coverage": float(np.mean(covered)),
                "coverage_ci_low": float(np.quantile(bootstrap, 0.025)),
                "coverage_ci_high": float(np.quantile(bootstrap, 0.975)),
                "average_interval_width": float((group["forecast_p90"] - group["forecast_p10"]).mean()),
                "calibration_source": "pre-test rolling-origin residuals only",
            }
        )
    return pd.DataFrame(output)


def residual_diagnostics(rows: pd.DataFrame, champion: str, cfg: EvaluatorConfig) -> pd.DataFrame:
    selected = rows[rows["model_name"].eq(champion)].copy()
    residual = selected["residual"].to_numpy(dtype=float)
    monthly = selected.groupby("forecast_month")["residual"].mean().sort_index()
    hac = OLS(monthly.to_numpy(), np.ones((len(monthly), 1))).fit(
        cov_type="HAC", cov_kwds={"maxlags": min(4, max(len(monthly) - 1, 0))}
    )
    lag = min(4, max(1, len(monthly) // 3))
    ljung = acorr_ljungbox(monthly, lags=[lag], return_df=True).iloc[0]
    jarque = stats.jarque_bera(residual)
    breusch = het_breuschpagan(residual, add_constant(selected[["prediction"]].to_numpy()))
    scale = stats.spearmanr(np.abs(residual), selected["prediction"])
    return pd.DataFrame(
        [
            {
                "test": "HAC mean residual equals zero",
                "statistic": float(hac.tvalues[0]),
                "p_value": float(hac.pvalues[0]),
                "null_hypothesis": "mean residual is zero",
                "status": "SUPPORTED" if hac.pvalues[0] >= cfg.alpha else "REJECTED",
            },
            {
                "test": f"Ljung-Box monthly residual lag {lag}",
                "statistic": float(ljung["lb_stat"]),
                "p_value": float(ljung["lb_pvalue"]),
                "null_hypothesis": "no residual autocorrelation",
                "status": "SUPPORTED" if ljung["lb_pvalue"] >= cfg.alpha else "REJECTED",
            },
            {
                "test": "Jarque-Bera normality",
                "statistic": float(jarque.statistic),
                "p_value": float(jarque.pvalue),
                "null_hypothesis": "residuals are normally distributed",
                "status": "NOT_REQUIRED" if jarque.pvalue < cfg.alpha else "SUPPORTED",
            },
            {
                "test": "Breusch-Pagan constant variance",
                "statistic": float(breusch[0]),
                "p_value": float(breusch[1]),
                "null_hypothesis": "residual variance is constant",
                "status": "SUPPORTED" if breusch[1] >= cfg.alpha else "REJECTED",
            },
            {
                "test": "Spearman absolute residual versus fitted",
                "statistic": float(scale.statistic),
                "p_value": float(scale.pvalue),
                "null_hypothesis": "error scale is unrelated to fitted scale",
                "status": "SUPPORTED" if scale.pvalue >= cfg.alpha else "REJECTED",
            },
        ]
    )


def model_comparisons(rows: pd.DataFrame, champion: str, cfg: EvaluatorConfig) -> pd.DataFrame:
    keys = ["origin_month", "forecast_month", "material_id", "horizon"]
    champion_rows = rows[rows["model_name"].eq(champion)][keys + ["absolute_error", "y_true"]].rename(
        columns={"absolute_error": "champion_error"}
    )
    rng = np.random.default_rng(20260725)
    output = []
    for challenger, candidate in rows.groupby("model_name"):
        if challenger == champion:
            continue
        paired = champion_rows.merge(
            candidate[keys + ["absolute_error"]].rename(columns={"absolute_error": "challenger_error"}),
            on=keys,
            how="inner",
        )
        paired["difference"] = paired["champion_error"] - paired["challenger_error"]
        monthly = paired.groupby(["origin_month", "forecast_month"], as_index=False)["difference"].mean()
        fit = OLS(monthly["difference"].to_numpy(), np.ones((len(monthly), 1))).fit(
            cov_type="HAC", cov_kwds={"maxlags": min(cfg.horizon - 1, max(len(monthly) - 1, 0))}
        )
        origins = paired["origin_month"].unique()
        series = paired["material_id"].unique()
        bootstrap = []
        for _ in range(cfg.bootstrap_samples):
            origin_sample = rng.choice(origins, size=len(origins), replace=True)
            series_sample = rng.choice(series, size=len(series), replace=True)
            parts = []
            for origin in origin_sample:
                block = paired[paired["origin_month"].eq(origin)]
                block = block.set_index("material_id")
                parts.extend(block.loc[block.index.intersection(series_sample), "difference"].tolist())
            bootstrap.append(float(np.mean(parts)) if parts else np.nan)
        bootstrap = np.asarray(bootstrap)
        output.append(
            {
                "champion": champion,
                "challenger": challenger,
                "paired_rows": len(paired),
                "mean_absolute_error_difference": float(paired["difference"].mean()),
                "relative_WAPE_difference": float(
                    (paired["champion_error"].sum() - paired["challenger_error"].sum())
                    / max(float(paired["y_true"].sum()), EPS)
                ),
                "dm_hac_statistic": float(fit.tvalues[0]),
                "dm_hac_p_value": float(fit.pvalues[0]),
                "block_bootstrap_ci_low": float(np.nanquantile(bootstrap, 0.025)),
                "block_bootstrap_ci_high": float(np.nanquantile(bootstrap, 0.975)),
                "test_note": "HAC lag accounts for overlapping H1-H12 forecasts; origin/series block bootstrap is secondary evidence.",
            }
        )
    result = pd.DataFrame(output)
    if not result.empty:
        result["holm_p_value"] = multipletests(result["dm_hac_p_value"], method="holm")[1]
        result["statistically_distinguishable"] = (
            (result["holm_p_value"] < cfg.alpha)
            & ((result["block_bootstrap_ci_low"] > 0) | (result["block_bootstrap_ci_high"] < 0))
        )
    return result.sort_values("mean_absolute_error_difference")


def decision_cost_sensitivity(rows: pd.DataFrame) -> pd.DataFrame:
    output = []
    for model_name, group in rows.groupby("model_name"):
        for ratio in [1, 2, 3, 5]:
            quantile = ratio / (ratio + 1)
            quantile_column = f"p{int(round(quantile * 100)):02d}"
            if quantile_column in group and group[quantile_column].notna().any():
                decision_forecast = group[quantile_column].fillna(group["prediction"])
                forecast_source = quantile_column
            else:
                decision_forecast = group["prediction"]
                forecast_source = "point_forecast"
            under = (group["y_true"] - decision_forecast).clip(lower=0)
            over = (decision_forecast - group["y_true"]).clip(lower=0)
            safety_stock = (decision_forecast - group["prediction"]).clip(lower=0)
            total_cost = ratio * under.sum() + over.sum()
            output.append(
                {
                    "model_name": model_name,
                    "under_to_over_cost_ratio": f"{ratio}:1",
                    "decision_quantile": quantile,
                    "forecast_source": forecast_source,
                    "shortage_units": float(under.sum()),
                    "inventory_holding_units": float(over.sum()),
                    "safety_stock_units": float(safety_stock.sum()),
                    "fill_rate_proxy": float(1 - under.sum() / max(group["y_true"].sum(), EPS)),
                    "weighted_total_cost_proxy": float(total_cost),
                    "claim_boundary": "Sensitivity proxy only until shortage and holding costs are supplied.",
                }
            )
    return pd.DataFrame(output)


def slice_metrics(rows: pd.DataFrame) -> pd.DataFrame:
    frames = []
    work = rows.copy()
    work["demand_band"] = pd.qcut(
        work["y_true"].rank(method="first"), 5, labels=["Q1", "Q2", "Q3", "Q4", "Q5"]
    )
    dimensions = ["horizon", "material_type", "demand_band"]
    dimensions.extend(
        column
        for column in ["abc_class", "fms_class", "promotion_flag", "shutdown_flag", "supplier_disruption_flag"]
        if column in work.columns
    )
    for dimension in dimensions:
        for keys, group in work.groupby(["model_name", dimension], observed=True):
            model, value = keys
            residual = group["y_true"] - group["prediction"]
            frames.append(
                {
                    "model_name": model,
                    "slice_dimension": dimension,
                    "slice_value": value,
                    "rows": len(group),
                    "WAPE": float(residual.abs().sum() / max(group["y_true"].abs().sum(), EPS)),
                    "Bias": float(residual.sum() / max(group["y_true"].abs().sum(), EPS)),
                }
            )
    return pd.DataFrame(frames)


def assumption_registry(
    spectral: pd.DataFrame,
    residual: pd.DataFrame,
    calibration: pd.DataFrame,
    champion: str,
) -> pd.DataFrame:
    residual_status = dict(zip(residual["test"], residual["status"]))
    champion_calibration = calibration[calibration["model_name"].eq(champion)].iloc[0]
    calibration_supported = (
        champion_calibration["coverage_ci_low"] <= champion_calibration["nominal_coverage"]
        <= champion_calibration["coverage_ci_high"]
    )
    annual_share = float(spectral["annual_seasonality_evidence"].eq("SUPPORTED").mean())
    stationarity_share = float(spectral["stationarity_evidence"].eq("SUPPORTED").mean())
    return pd.DataFrame(
        [
            {
                "assumption": "Temporal ordering and no random K-fold",
                "status": "SUPPORTED",
                "evidence": "Expanding-origin H1-H12 protocol with a locked 2025 test.",
                "action": "Keep all preprocessing inside each origin.",
            },
            {
                "assumption": "Annual seasonality is present",
                "status": "SUPPORTED" if annual_share >= 0.25 else "REJECTED",
                "evidence": f"{annual_share:.1%} of series pass AR(1)-red-noise annual spectral testing after FDR.",
                "action": "Retain cyclic and spectral ablations; do not force seasonality on every series.",
            },
            {
                "assumption": "Series are stationary",
                "status": "SUPPORTED" if stationarity_share >= 0.80 else "NOT_REQUIRED",
                "evidence": f"{stationarity_share:.1%} pass joint ADF/KPSS evidence.",
                "action": "Trees and neural models do not require stationarity; monitor regime slices.",
            },
            {
                "assumption": "Residuals are centered",
                "status": residual_status.get("HAC mean residual equals zero", "UNVERIFIED"),
                "evidence": "HAC intercept test on monthly aggregate residuals.",
                "action": "Keep bias in the selection score and monitor by horizon.",
            },
            {
                "assumption": "Residuals are serially uncorrelated",
                "status": next(
                    (value for key, value in residual_status.items() if key.startswith("Ljung-Box")), "UNVERIFIED"
                ),
                "evidence": "Ljung-Box test on monthly aggregate residuals.",
                "action": "Use HAC/block inference regardless of outcome.",
            },
            {
                "assumption": "Residuals are Gaussian",
                "status": "NOT_REQUIRED",
                "evidence": "Jarque-Bera is reported but Gaussian intervals are not used.",
                "action": "Use empirical/quantile intervals and block-bootstrap inference.",
            },
            {
                "assumption": "Residual variance is constant",
                "status": residual_status.get("Breusch-Pagan constant variance", "UNVERIFIED"),
                "evidence": "Breusch-Pagan and scale-error tests.",
                "action": "Use scale-normalized intervals and slice metrics.",
            },
            {
                "assumption": "P10-P90 intervals are calibrated",
                "status": "SUPPORTED" if calibration_supported else "REJECTED",
                "evidence": "Untouched-test block-bootstrap coverage interval.",
                "action": "Recalibrate on pre-test residuals if rejected.",
            },
            {
                "assumption": "Generated sample represents the operational population",
                "status": "UNVERIFIED",
                "evidence": "All current histories are controlled/generated rather than sampled customer operations.",
                "action": "Require representative real issue history, population definition, lineage and shadow validation.",
            },
        ]
    )


def claim_evidence_matrix() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "claim": "The implementation is leakage-safe and reproducible.",
                "evidence_required": "Feature invariance tests, train-only normalization, deterministic seeds.",
                "synthetic_status": "SUPPORTED",
                "production_status": "UNVERIFIED",
            },
            {
                "claim": "Cyclic and spectral features recover temporal structure.",
                "evidence_required": "AR(1) spectral tests and feature-group ablations.",
                "synthetic_status": "TESTABLE",
                "production_status": "UNVERIFIED",
            },
            {
                "claim": "The neural network is superior to simpler candidates.",
                "evidence_required": "Locked selection ranking, HAC/DM test, block CI, calibration and decision utility.",
                "synthetic_status": "RESULT_DEPENDENT",
                "production_status": "UNVERIFIED",
            },
            {
                "claim": "Forecasts are suitable for operational inventory decisions.",
                "evidence_required": "Real costs, service targets, lead-time outcomes and shadow-mode approval.",
                "synthetic_status": "PROHIBITED",
                "production_status": "UNVERIFIED",
            },
        ]
    )
