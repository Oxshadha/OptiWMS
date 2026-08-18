"""SHAP attribution for the v8 causal ExtraTrees forecast.

The model is trained on ``log1p(demand)`` and served through ``expm1``. SHAP is
additive in the space the model actually outputs, so every contribution here is
computed and stored in **log space**, where the guarantee

    base_value + sum(contributions) == model.predict(X)

holds exactly. Reporting a log-space value as if it were units is a ~500x error
(a baseline of 8.38 in log space is 4,351 units), so the units-space view is
derived explicitly by :func:`to_units_deltas` rather than by relabelling.

Two properties of this model shape the output:

* ``material_code_enc`` and ``material_type_enc`` are ordinal encodings of row
  identity, not drivers. They are excluded from the ranked drivers but their
  contribution is retained in the ``__other__`` bucket so additivity survives.
* Horizons 2-12 are produced recursively, feeding the model's own predictions
  back in as lags. A lag at horizon 12 is therefore a model artefact, not an
  observation, and every contribution carries ``lag_provenance`` saying so.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# Human-readable label for each of the 28 CAUSAL_FEATURES. Every feature the
# model uses is named here; an unlabelled feature is a bug, not a fallback.
FEATURE_LABELS: dict[str, str] = {
    "month_num": "month of year",
    "quarter": "quarter of year",
    "year_index": "year trend",
    "month_sin": "seasonal cycle (sine)",
    "month_cos": "seasonal cycle (cosine)",
    "material_code_enc": "material identity code",
    "material_type_enc": "material type code",
    "lag_1": "demand 1 month before",
    "lag_2": "demand 2 months before",
    "lag_3": "demand 3 months before",
    "lag_6": "demand 6 months before",
    "lag_12": "demand 12 months before",
    "roll_mean_3": "3-month average demand",
    "roll_mean_6": "6-month average demand",
    "roll_mean_12": "12-month average demand",
    "roll_std_6": "demand volatility (6-month)",
    "roll_std_12": "demand volatility (12-month)",
    "roll_max_6": "peak demand in last 6 months",
    "ewm_mean_3": "recent weighted average demand",
    "nonzero_rate_12": "months with demand out of last 12",
    "trend_6": "6-month demand trend slope",
    "planned_bom_requirement": "planned production requirement",
    "promotion_flag": "promotion running",
    "holiday_flag": "holiday month",
    "active_fg_count": "active finished goods using this material",
    "lead_time_days": "supplier lead time",
    "moq": "minimum order quantity",
    "order_multiple": "order pack multiple",
}

# Ordinal encodings of *which row this is*, not *why demand moved*.
IDENTITY_FEATURES: frozenset[str] = frozenset({"material_code_enc", "material_type_enc"})

OTHER_BUCKET = "__other__"
OTHER_LABEL = "all remaining features (incl. material identity)"

# Features derived from the demand history window, so they inherit the
# provenance of the lags feeding them.
_WINDOW_PREFIXES = ("roll_", "ewm_", "trend_", "nonzero_rate")


def label_for(feature: str) -> str:
    """Human-readable label. Raises for an unknown feature rather than guessing."""
    if feature == OTHER_BUCKET:
        return OTHER_LABEL
    try:
        return FEATURE_LABELS[feature]
    except KeyError as exc:
        raise KeyError(
            f"No label for feature {feature!r}. Add it to FEATURE_LABELS -- "
            "an unlabelled feature would reach the user as a raw column name."
        ) from exc


def lag_provenance(feature: str, horizon: int) -> str:
    """Whether this feature's inputs are observed history or the model's own output.

    At horizon ``h`` the recursion has already predicted months 1..h-1, so
    ``lag_k`` reads a predicted month whenever ``k <= h - 1``. Window features
    read the same recent months and become partly synthetic from ``h >= 2``.
    """
    if horizon <= 1:
        return "observed"
    if feature.startswith("lag_"):
        k = int(feature.split("_")[1])
        return "predicted" if k <= horizon - 1 else "observed"
    if feature.startswith(_WINDOW_PREFIXES):
        return "partly_predicted"
    return "observed"


def to_units_deltas(base_log: float, ordered_shap: list[float]) -> list[float]:
    """Convert ordered log-space contributions into units-space deltas.

    ``expm1`` is non-linear, so log-space contributions cannot simply be
    exponentiated. Walking the cumulative sum and taking the difference at each
    step gives deltas that sum exactly to ``expm1(base + sum) - expm1(base)``.
    The split depends on the ordering, which is why the ordering (descending
    absolute log contribution) is fixed and recorded.
    """
    deltas: list[float] = []
    running = base_log
    previous_units = float(np.expm1(base_log))
    for value in ordered_shap:
        running += value
        current_units = float(np.expm1(running))
        deltas.append(current_units - previous_units)
        previous_units = current_units
    return deltas


def explain_frame(
    model,
    features: pd.DataFrame,
    identifiers: pd.DataFrame,
    horizon: int,
    top_n: int = 8,
    explainer=None,
) -> pd.DataFrame:
    """Compute SHAP attributions for one horizon step.

    Parameters
    ----------
    model       : the fitted ExtraTreesRegressor (log1p target)
    features    : exactly the frame passed to ``model.predict`` -- same row order
    identifiers : row-aligned ``material_id`` / ``material_code`` / ``target_month``
    horizon     : 1-12, used for lag provenance
    top_n       : ranked drivers to keep; the remainder go to ``__other__``
    explainer   : reuse a built ``shap.TreeExplainer`` across horizons

    Returns a long frame, one row per (material, horizon, driver slot).
    """
    import shap  # local import: only the publish path needs it

    if len(features) != len(identifiers):
        raise ValueError(
            f"Row mismatch: {len(features)} feature rows vs {len(identifiers)} identifier "
            "rows. Misalignment would attribute one material's drivers to another."
        )

    if explainer is None:
        explainer = shap.TreeExplainer(model)
    shap_matrix = np.asarray(explainer.shap_values(features))
    base_log = float(np.ravel(explainer.expected_value)[0])
    predicted_log = np.asarray(model.predict(features), dtype=float)

    # The guarantee this whole module rests on.
    reconstruction = base_log + shap_matrix.sum(axis=1)
    max_error = float(np.abs(reconstruction - predicted_log).max())
    if max_error > 1e-6:
        raise AssertionError(
            f"SHAP additivity violated at horizon {horizon}: max error {max_error:.3e}. "
            "The explanation does not reconstruct the prediction."
        )

    columns = list(features.columns)
    identity_idx = {i for i, c in enumerate(columns) if c in IDENTITY_FEATURES}
    records: list[dict] = []

    for row in range(len(features)):
        row_shap = shap_matrix[row]
        ids = identifiers.iloc[row]

        ranked = sorted(
            (i for i in range(len(columns)) if i not in identity_idx),
            key=lambda i: abs(row_shap[i]),
            reverse=True,
        )
        chosen = ranked[:top_n]
        # Everything not ranked -- including identity -- stays in the bucket, so
        # base + drivers + other still equals the prediction exactly.
        other_log = float(row_shap.sum() - sum(row_shap[i] for i in chosen))

        ordered_log = [float(row_shap[i]) for i in chosen] + [other_log]
        deltas = to_units_deltas(base_log, ordered_log)

        common = {
            "material_id": ids["material_id"],
            "material_code": ids["material_code"],
            "target_month": ids["target_month"],
            "horizon": horizon,
            "base_value_log": base_log,
            "baseline_units": float(np.expm1(base_log)),
            "prediction_log": float(predicted_log[row]),
            "prediction_units": float(np.expm1(predicted_log[row])),
            "explanation_space": "log1p",
        }
        for rank, (idx, delta) in enumerate(zip(chosen, deltas), start=1):
            feature = columns[idx]
            records.append({
                **common,
                "rank": rank,
                "feature": feature,
                "label": label_for(feature),
                "shap_value_log": float(row_shap[idx]),
                "feature_value": float(features.iat[row, idx]),
                "delta_units": delta,
                "lag_provenance": lag_provenance(feature, horizon),
            })
        records.append({
            **common,
            "rank": len(chosen) + 1,
            "feature": OTHER_BUCKET,
            "label": OTHER_LABEL,
            "shap_value_log": other_log,
            "feature_value": float("nan"),
            "delta_units": deltas[-1],
            "lag_provenance": "mixed",
        })

    return pd.DataFrame.from_records(records)
