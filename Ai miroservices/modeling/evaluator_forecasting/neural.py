from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from .contracts import EvaluatorConfig, NormalizationStats, QUANTILES, WindowBundle
from .features import apply_ablation, fit_normalizer, transform_windows


@dataclass
class EnsembleResult:
    rows: pd.DataFrame
    seed_metrics: pd.DataFrame
    normalization: NormalizationStats
    history: pd.DataFrame
    attention: pd.DataFrame
    occlusion: pd.DataFrame
    permutation: pd.DataFrame


def _keras():
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
    os.environ.setdefault("KERAS_BACKEND", "tensorflow")
    import keras
    from keras import layers, ops

    return keras, layers, ops


def build_conv_attention_model(bundle: WindowBundle, cfg: EvaluatorConfig):
    keras, layers, ops = _keras()
    past_input = keras.Input(bundle.past.shape[1:], name="historical_window")
    future_input = keras.Input(bundle.future.shape[1:], name="known_future")
    spectral_input = keras.Input(bundle.spectral.shape[1:], name="spectral_summary")
    static_input = keras.Input(bundle.static.shape[1:], name="static_features")

    skip = layers.Conv1D(64, 1, padding="same", name="skip_projection")(past_input)
    x = layers.Conv1D(32, 3, padding="causal", activation="relu", name="conv_short")(past_input)
    x = layers.Conv1D(64, 6, padding="causal", activation="relu", name="conv_wide")(x)
    x = layers.LayerNormalization(name="conv_residual_norm")(x + skip)

    attention_1 = layers.MultiHeadAttention(
        num_heads=4, key_dim=16, dropout=0.10, name="self_attention_1"
    )
    attended_1, _ = attention_1(x, x, return_attention_scores=True)
    x = layers.LayerNormalization(name="attention_norm_1")(x + attended_1)
    attention_2 = layers.MultiHeadAttention(
        num_heads=4, key_dim=16, dropout=0.10, name="self_attention_2"
    )
    attended_2, attention_scores = attention_2(x, x, return_attention_scores=True)
    x = layers.LayerNormalization(name="attention_norm_2")(x + attended_2)
    historical_context = layers.GlobalAveragePooling1D(name="temporal_reduction")(x)

    future_context = layers.Flatten(name="future_flatten")(future_input)
    future_context = layers.Dense(64, activation="relu", name="future_projection")(future_context)
    spectral_context = layers.Dense(16, activation="relu", name="spectral_projection")(spectral_input)
    static_context = layers.Dense(32, activation="relu", name="static_projection")(static_input)
    context = layers.Concatenate(name="context_join")(
        [historical_context, future_context, spectral_context, static_context]
    )
    context = layers.Dense(128, activation="relu", name="decision_dense")(context)
    context = layers.Dropout(0.20, name="decision_dropout")(context)

    base = layers.Dense(cfg.horizon, activation="softplus", name="quantile_base")(context)
    base = layers.Reshape((cfg.horizon, 1))(base)
    increments = layers.Dense(
        cfg.horizon * (len(QUANTILES) - 1),
        bias_initializer=keras.initializers.Constant(-3.0),
        name="quantile_increments",
    )(context)
    increments = layers.Reshape((cfg.horizon, len(QUANTILES) - 1))(increments)
    increments = layers.Activation("softplus")(increments)
    cumulative = layers.Lambda(lambda value: ops.cumsum(value, axis=-1), name="ordered_increments")(increments)
    quantiles = layers.Concatenate(axis=-1, name="ordered_quantiles")([base, base + cumulative])

    inputs = [past_input, future_input, spectral_input, static_input]
    model = keras.Model(inputs, quantiles, name="global_conv1d_attention")
    attention_model = keras.Model(inputs, [quantiles, attention_scores], name="attention_explainer")
    quantile_tensor = ops.convert_to_tensor(QUANTILES)

    def pinball_loss(y_true, y_pred):
        error = ops.expand_dims(y_true, axis=-1) - y_pred
        return ops.mean(ops.maximum(quantile_tensor * error, (quantile_tensor - 1.0) * error))

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=cfg.learning_rate),
        loss=pinball_loss,
    )
    return model, attention_model


def split_training_bundle(bundle: WindowBundle, validation_cutpoints: int) -> tuple[WindowBundle, WindowBundle]:
    cutpoints = sorted(pd.to_datetime(bundle.metadata["label_end_month"]).unique())
    if len(cutpoints) <= validation_cutpoints:
        raise ValueError("insufficient temporal cutpoints for train-only normalization and validation")
    validation_months = set(cutpoints[-validation_cutpoints:])
    is_validation = pd.to_datetime(bundle.metadata["label_end_month"]).isin(validation_months).to_numpy()
    return bundle.subset(np.flatnonzero(~is_validation)), bundle.subset(np.flatnonzero(is_validation))


def _inputs(bundle: WindowBundle) -> list[np.ndarray]:
    return [bundle.past, bundle.future, bundle.spectral, bundle.static]


def _actual(bundle: WindowBundle) -> np.ndarray:
    if bundle.labels is None:
        raise ValueError("evaluation requires labels")
    return np.expm1(bundle.labels * bundle.target_scale[:, None]).clip(min=0.0)


def _invert(predictions: np.ndarray, bundle: WindowBundle) -> np.ndarray:
    return np.expm1(predictions * bundle.target_scale[:, None, None]).clip(min=0.0)


def _wape(actual: np.ndarray, prediction: np.ndarray) -> float:
    return float(np.abs(actual - prediction).sum() / max(float(np.abs(actual).sum()), 1e-9))


def _result_rows(bundle: WindowBundle, predictions: np.ndarray, model_name: str) -> pd.DataFrame:
    actual = _actual(bundle)
    rows = []
    for sample_index, meta in bundle.metadata.iterrows():
        for horizon in range(1, actual.shape[1] + 1):
            record = {
                **meta.to_dict(),
                "forecast_month": pd.Timestamp(meta["origin_month"]) + pd.DateOffset(months=horizon - 1),
                "horizon": horizon,
                "model_name": model_name,
                "y_true": float(actual[sample_index, horizon - 1]),
            }
            for q_index, quantile in enumerate(QUANTILES):
                name = f"p{int(round(float(quantile) * 100)):02d}"
                record[name] = float(predictions[sample_index, horizon - 1, q_index])
            record["prediction"] = record["p50"]
            record["residual"] = record["y_true"] - record["prediction"]
            record["absolute_error"] = abs(record["residual"])
            rows.append(record)
    return pd.DataFrame(rows)


def train_ensemble(
    training: WindowBundle,
    prediction: WindowBundle,
    cfg: EvaluatorConfig,
    *,
    feature_group: str = "full",
    seeds: tuple[int, ...] | None = None,
    explain: bool = False,
    verbose: int = 0,
) -> EnsembleResult:
    keras, _, _ = _keras()
    train_raw, validation_raw = split_training_bundle(training, cfg.validation_cutpoints)
    normalization = fit_normalizer(train_raw)
    train = apply_ablation(transform_windows(train_raw, normalization), feature_group)
    validation = apply_ablation(transform_windows(validation_raw, normalization), feature_group)
    evaluation = apply_ablation(transform_windows(prediction, normalization), feature_group)
    selected_seeds = seeds or cfg.seeds
    predictions = []
    seed_rows = []
    histories = []
    final_attention_model = None
    final_model = None
    actual = _actual(prediction)

    for seed in selected_seeds:
        keras.backend.clear_session()
        keras.utils.set_random_seed(seed)
        try:
            import tensorflow as tf

            tf.config.experimental.enable_op_determinism()
        except Exception:
            pass
        model, attention_model = build_conv_attention_model(train, cfg)
        callbacks = [
            keras.callbacks.EarlyStopping(
                monitor="val_loss",
                patience=cfg.patience,
                restore_best_weights=True,
                min_delta=1e-5,
            )
        ]
        fitted = model.fit(
            _inputs(train),
            train.labels,
            validation_data=(_inputs(validation), validation.labels),
            epochs=cfg.max_epochs,
            batch_size=cfg.batch_size,
            callbacks=callbacks,
            verbose=verbose,
            shuffle=True,
        )
        normalized_prediction = model.predict(_inputs(evaluation), verbose=0)
        prediction_original = _invert(normalized_prediction, prediction)
        predictions.append(prediction_original)
        median = prediction_original[:, :, int(np.where(np.isclose(QUANTILES, 0.5))[0][0])]
        seed_rows.append(
            {
                "seed": seed,
                "feature_group": feature_group,
                "epochs": len(fitted.history["loss"]),
                "best_validation_loss": float(min(fitted.history["val_loss"])),
                "WAPE": _wape(actual, median),
                "RMSE": float(np.sqrt(np.mean((actual - median) ** 2))),
            }
        )
        histories.extend(
            {
                "seed": seed,
                "feature_group": feature_group,
                "epoch": epoch + 1,
                "loss": float(loss),
                "validation_loss": float(validation_loss),
            }
            for epoch, (loss, validation_loss) in enumerate(zip(fitted.history["loss"], fitted.history["val_loss"]))
        )
        final_attention_model = attention_model
        final_model = model

    ensemble = np.median(np.stack(predictions), axis=0)
    rows = _result_rows(prediction, ensemble, "CONV1D_ATTENTION_GLOBAL")

    attention = pd.DataFrame()
    occlusion_rows = []
    permutation_rows = []
    if explain:
        _, final_attention = final_attention_model.predict(_inputs(evaluation), verbose=0)
        attention_mean = np.asarray(final_attention).mean(axis=(0, 1, 2))
        attention = pd.DataFrame(
            {
                "lag_position": np.arange(-cfg.history, 0),
                "mean_attention_weight": attention_mean,
                "note": "Attention weights are descriptive and are not causal effects.",
            }
        )

        baseline = final_model.predict(_inputs(evaluation), verbose=0)
        baseline_prediction = _invert(baseline, prediction)[:, :, 1]
        for position in range(cfg.history):
            changed = evaluation.subset(np.arange(len(evaluation.past)))
            changed.past[:, position, 0] = 0.0
            altered = final_model.predict(_inputs(changed), verbose=0)
            altered_prediction = _invert(altered, prediction)[:, :, 1]
            occlusion_rows.append(
                {
                    "lag_position": position - cfg.history,
                    "baseline_WAPE": _wape(actual, baseline_prediction),
                    "occluded_WAPE": _wape(actual, altered_prediction),
                    "WAPE_increase": _wape(actual, altered_prediction) - _wape(actual, baseline_prediction),
                    "note": "Single-seed lag occlusion; association, not causation.",
                }
            )

        rng = np.random.default_rng(42)
        sources = [
            ("past_exogenous", "past"),
            ("known_future", "future"),
            ("spectral_summary", "spectral"),
            ("static_features", "static"),
        ]
        for label, attribute in sources:
            changed = evaluation.subset(np.arange(len(evaluation.past)))
            values = getattr(changed, attribute)
            setattr(changed, attribute, values[rng.permutation(len(values))])
            altered = final_model.predict(_inputs(changed), verbose=0)
            altered_prediction = _invert(altered, prediction)[:, :, 1]
            permutation_rows.append(
                {
                    "feature_group": label,
                    "baseline_WAPE": _wape(actual, baseline_prediction),
                    "permuted_WAPE": _wape(actual, altered_prediction),
                    "WAPE_increase": _wape(actual, altered_prediction) - _wape(actual, baseline_prediction),
                    "note": "Held-out group permutation; association, not causation.",
                }
            )

    return EnsembleResult(
        rows=rows,
        seed_metrics=pd.DataFrame(seed_rows),
        normalization=normalization,
        history=pd.DataFrame(histories),
        attention=attention,
        occlusion=pd.DataFrame(occlusion_rows),
        permutation=pd.DataFrame(permutation_rows),
    )


def save_normalization(stats: NormalizationStats, path: Path) -> None:
    path.write_text(json.dumps(stats.to_dict(), indent=2), encoding="utf-8")
