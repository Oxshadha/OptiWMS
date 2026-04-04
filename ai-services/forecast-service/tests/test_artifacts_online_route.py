from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import settings
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
            "fallback_used": False,
            "fallback_reason": None,
            "fallback_count": 0,
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
    assert body["fallback_used"] is False
    assert body["fallback_count"] == 0


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


def test_get_inference_audit_success(monkeypatch):
    def fake_list_inference_audit(**kwargs):
        assert kwargs["limit"] == 20
        assert kwargs["dataset"] == "A"
        assert kwargs["model_name"] == "XGBOOST"
        return {
            "summary": {
                "count": 2,
                "fallback_rate": 0.5,
                "total_errors": 1,
                "avg_latency_ms": 120.5,
                "p95_latency_ms": 200.0,
            },
            "items": [
                {
                    "event": "infer_boosting_online",
                    "dataset": "A",
                    "model_name": "XGBOOST",
                    "fallback_used": False,
                    "latency_ms": 41.0,
                },
                {
                    "event": "infer_boosting_online",
                    "dataset": "A",
                    "model_name": "XGBOOST",
                    "fallback_used": True,
                    "latency_ms": 200.0,
                },
            ],
        }

    monkeypatch.setattr(
        "app.api.v1.routes.artifacts.list_inference_audit",
        fake_list_inference_audit,
    )

    client = TestClient(app)
    res = client.get("/artifacts/inference-audit?limit=20&dataset=A&model_name=XGBOOST")
    assert res.status_code == 200
    body = res.json()
    assert body["summary"]["count"] == 2
    assert body["summary"]["fallback_rate"] == 0.5
    assert len(body["items"]) == 2


def test_get_inference_alerts_success(monkeypatch):
    def fake_evaluate_inference_alerts(**kwargs):
        assert kwargs["limit"] == 50
        assert kwargs["dataset"] == "A"
        return {
            "status": "warn",
            "summary": {"count": 10, "fallback_rate": 0.2, "total_errors": 0, "avg_latency_ms": 120.0, "p95_latency_ms": 510.0},
            "rules_triggered": [
                {"rule": "fallback_rate", "status": "warn", "threshold": 0.05, "value": 0.2, "message": "Fallback usage rate above threshold."}
            ],
            "window_size": 50,
            "dataset": "A",
            "model_name": None,
        }

    monkeypatch.setattr(
        "app.api.v1.routes.artifacts.evaluate_inference_alerts",
        fake_evaluate_inference_alerts,
    )

    client = TestClient(app)
    res = client.get("/artifacts/inference-alerts?limit=50&dataset=A")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "warn"
    assert body["summary"]["fallback_rate"] == 0.2
    assert len(body["rules_triggered"]) == 1


def test_get_acceptance_gate_success(monkeypatch):
    def fake_evaluate_acceptance_gate(**kwargs):
        assert kwargs["dataset"] == "A"
        assert kwargs["model_name"] == "XGBOOST"
        assert kwargs["split"] == "test"
        assert kwargs["inference_window"] == 300
        return {"ready": True, "checks": []}

    monkeypatch.setattr(
        "app.api.v1.routes.artifacts.evaluate_acceptance_gate",
        fake_evaluate_acceptance_gate,
    )

    client = TestClient(app)
    res = client.get("/artifacts/acceptance-gate?dataset=A&model_name=XGBOOST&split=test&inference_window=300")
    assert res.status_code == 200
    assert res.json()["ready"] is True


def test_infer_boosting_online_rate_limited(monkeypatch):
    monkeypatch.setattr("app.api.v1.routes.artifacts.RATE_LIMITER.allow", lambda _: False)

    client = TestClient(app)
    payload = {
        "dataset": "A",
        "model_name": "XGBOOST",
        "horizon": 1,
        "series": [
            {
                "series_id": "sku_001",
                "fg_code": "FG001",
                "history": [
                    {"month": "2025-01", "demand_units": 100.0},
                    {"month": "2025-02", "demand_units": 110.0},
                ],
            }
        ],
    }
    res = client.post("/artifacts/infer-boosting-online", json=payload)
    assert res.status_code == 429


def test_service_auth_required(monkeypatch):
    old_required = settings.api_auth_required
    old_token = settings.api_auth_token
    settings.api_auth_required = True
    settings.api_auth_token = "secret-token"
    try:
        client = TestClient(app)
        unauthorized = client.get("/artifacts/inference-audit")
        assert unauthorized.status_code == 401
        authorized = client.get(
            "/artifacts/inference-audit",
            headers={"Authorization": "Bearer secret-token"},
        )
        assert authorized.status_code == 200
    finally:
        settings.api_auth_required = old_required
        settings.api_auth_token = old_token
