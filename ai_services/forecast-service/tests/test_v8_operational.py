from __future__ import annotations

import json

import pandas as pd

from app.api.v1.routes import v8_operational
from app.services.forecast_provider import V8SnapshotForecastProvider


def test_v8_snapshot_provider_serves_requested_sku_and_horizons(tmp_path):
    output = tmp_path / "outputs"
    metadata = output / "serving_bundle" / "production"
    metadata.mkdir(parents=True)
    pd.DataFrame(
        [
            {
                "material_code": "RM-0001",
                "material_type": "raw_material",
                "horizon": 1,
                "forecast_period": "2026-01-01",
                "p10": 8.0,
                "p50": 10.0,
                "p90": 12.0,
            },
            {
                "material_code": "RM-0001",
                "material_type": "raw_material",
                "horizon": 2,
                "forecast_period": "2026-02-01",
                "p10": 9.0,
                "p50": 11.0,
                "p90": 13.0,
            },
            {
                "material_code": "PM-0001",
                "material_type": "packaging_material",
                "horizon": 1,
                "forecast_period": "2026-01-01",
                "p10": 18.0,
                "p50": 20.0,
                "p90": 22.0,
            },
        ]
    ).to_csv(output / "operational_forecasts.csv", index=False)
    (metadata / "metadata.json").write_text(
        json.dumps({"model_id": "V8_CONTROLLED_EXTRA_TREES_CAUSAL"})
    )

    provider = V8SnapshotForecastProvider(str(tmp_path))
    result = provider.predict(["rm-0001"], [1, 2], "WH-001")

    assert result.status == "success"
    assert result.total_count == 2
    assert [point.horizon for point in result.forecasts] == [1, 2]
    assert result.forecasts[0].sku == "RM-0001"
    assert provider.health_check()["status"] == "ok"


def test_v8_recalculate_runs_refit_before_dry_run_publish(monkeypatch, tmp_path):
    project = tmp_path / "v8"
    repository = tmp_path / "repository"
    (project / "outputs").mkdir(parents=True)
    calls: list[list[str]] = []

    def fake_run(command: list[str], timeout_seconds: int, cwd=None) -> dict:
        calls.append(command)
        if "pipeline.operational_forecast" in command:
            assert timeout_seconds == 1800
            return {"forecast_rows": 1440, "recursive_test_WAPE": 0.0875}
        assert command[-1] == "--dry-run"
        assert timeout_seconds == 600
        return {"status": "dry_run", "validation": {"forecast_rows": 1440}}

    monkeypatch.setenv("V8_FORECAST_ROOT", str(project))
    monkeypatch.setenv("OPTIWMS_REPOSITORY_ROOT", str(repository))
    monkeypatch.setenv("WMS_RUNTIME_DATABASE_URL", "postgresql://test")
    monkeypatch.setattr(v8_operational, "_run", fake_run)

    result = v8_operational.recalculate(
        dry_run=True,
        warehouse_id="WH-001",
        db=object(),
    )

    assert result["status"] == "dry_run"
    assert result["model_name"] == "PROJECT_OPS_EXTRA_TREES_CAUSAL"
    assert len(calls) == 2
    assert calls[0][1:3] == ["-m", "pipeline.operational_forecast"]
