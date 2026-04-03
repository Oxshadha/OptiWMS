from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_infer_boosting_online_success(monkeypatch):
    def fake_infer_boosting_online(**kwargs):
        return {
            "dataset": kwargs["dataset"],
            "model_name": kwargs["model_name"],
            "horizon": kwargs["horizon"],
            "stage": kwargs["stage"],
            "count": 1,
            "items": [
                {
                    "series_id": "sku_001",
                    "fg_code": "FG001",
                    "fg_category": "Soap",
                    "prediction": 123.4,
                    "horizon": 1,
                }
            ],
            "errors": [],
            "metadata": {"model_version": "v1"},
        }

    monkeypatch.setattr(
        "app.api.v1.routes.artifacts.infer_boosting_online",
        fake_infer_boosting_online,
    )

    client = TestClient(app)
    payload = {
        "dataset": "A",
        "model_name": "XGBOOST",
        "horizon": 1,
        "stage": "production",
        "clip_negative": True,
        "series": [
            {
                "series_id": "sku_001",
                "fg_code": "FG001",
                "fg_category": "Soap",
                "history": [
                    {"month": "2025-01", "demand_units": 100.0},
                    {"month": "2025-02", "demand_units": 110.0},
                ],
            }
        ],
    }

    res = client.post("/artifacts/infer-boosting-online", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body["dataset"] == "A"
    assert body["model_name"] == "XGBOOST"
    assert body["count"] == 1
    assert body["items"][0]["series_id"] == "sku_001"


def test_infer_boosting_online_validation_error():
    client = TestClient(app)
    payload = {
        "dataset": "A",
        "model_name": "XGBOOST",
        "horizon": 13,  # invalid
        "series": [
            {
                "series_id": "sku_001",
                "fg_code": "FG001",
                "history": [
                    {"month": "2025-01"}  # demand_units missing
                ],
            }
        ],
    }

    res = client.post("/artifacts/infer-boosting-online", json=payload)
    assert res.status_code == 422

