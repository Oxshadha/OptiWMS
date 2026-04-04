from __future__ import annotations

import json

from app.services.artifact_service import infer_boosting_online
from app.services.artifact_service import resolve_champion_model
from app.core.config import settings


def test_infer_boosting_online_model_missing_fallback(monkeypatch):
    def fake_load(*args, **kwargs):
        raise FileNotFoundError("missing artifact")

    monkeypatch.setattr("app.services.artifact_service.load_boosting_artifact", fake_load)

    payload = [
        {
            "series_id": "sku_001",
            "fg_code": "FG001",
            "fg_category": "Soap",
            "history": [
                {"month": "2025-01", "demand_units": 100.0},
                {"month": "2025-02", "demand_units": 120.0},
            ],
        },
        {
            "series_id": "sku_002",
            "fg_code": "FG002",
            "fg_category": "Lotion/Cream",
            "history": [
                {"month": "2025-01", "demand_units": 80.0},
                {"month": "2025-02", "demand_units": 95.0},
            ],
        },
    ]

    out = infer_boosting_online(
        dataset="A",
        model_name="XGBOOST",
        horizon=1,
        series=payload,
        stage="production",
        clip_negative=True,
    )

    assert out["count"] == 2
    assert out["fallback_used"] is True
    assert out["fallback_count"] == 2
    assert out["items"][0]["fallback_used"] is True
    assert out["items"][0]["fallback_reason"].startswith("model_load_or_metadata_error:")
    assert out["items"][0]["baseline_method"] == "last_value"
    assert out["items"][0]["prediction"] == 120.0


def test_resolve_champion_model_uses_config(monkeypatch):
    monkeypatch.setattr(
        settings,
        "champion_models_json",
        json.dumps({"A": {"default": "CATBOOST", "1": "LIGHTGBM"}}),
    )
    assert resolve_champion_model(dataset="A", horizon=1, requested_model=None) == "LIGHTGBM"
    assert resolve_champion_model(dataset="A", horizon=2, requested_model=None) == "CATBOOST"
    assert resolve_champion_model(dataset="A", horizon=2, requested_model="XGBOOST") == "XGBOOST"


def test_infer_boosting_online_without_model_name_uses_default_champion(monkeypatch):
    monkeypatch.setattr(settings, "champion_models_json", "{}")

    captured = {"model_name": None}

    def fake_load(dataset, model_name, horizon, stage="production"):
        captured["model_name"] = model_name
        raise FileNotFoundError("missing artifact")

    monkeypatch.setattr("app.services.artifact_service.load_boosting_artifact", fake_load)

    out = infer_boosting_online(
        dataset="A",
        model_name=None,
        horizon=1,
        series=[
            {
                "series_id": "sku_001",
                "fg_code": "FG001",
                "fg_category": "Soap",
                "history": [
                    {"month": "2025-01", "demand_units": 100.0},
                    {"month": "2025-02", "demand_units": 120.0},
                ],
            }
        ],
        stage="production",
        clip_negative=True,
    )
    assert captured["model_name"] == "XGBOOST"
    assert out["model_name"] == "XGBOOST"
    assert out["fallback_used"] is True
