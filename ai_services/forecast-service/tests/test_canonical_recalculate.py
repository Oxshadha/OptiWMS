from __future__ import annotations

from app.api.v1.routes import canonical


def test_canonical_recalculate_runs_evidence_then_forecast_only_publish(monkeypatch, tmp_path):
    project = tmp_path / "project"
    repository = tmp_path / "repository"
    (project / "outputs").mkdir(parents=True)
    calls: list[list[str]] = []

    def fake_run(command: list[str], timeout_seconds: int) -> dict:
        calls.append(command)
        if command[1].endswith("runtime_recalculate.py"):
            assert timeout_seconds == 1800
            return {"champion": "EXTRA_TREES", "promotion_status": "PENDING_MANAGER_APPROVAL"}
        assert command[-1] == "--forecast-only"
        assert timeout_seconds == 600
        return {"forecast_results": 8952, "backtest_rows": 8952}

    monkeypatch.setenv("CANONICAL_FORECAST_ROOT", str(project))
    monkeypatch.setenv("OPTIWMS_REPOSITORY_ROOT", str(repository))
    monkeypatch.setenv("WMS_RUNTIME_DATABASE_URL", "postgresql://test")
    monkeypatch.setattr(canonical, "_run", fake_run)

    result = canonical.recalculate()

    assert result["status"] == "published_draft"
    assert result["model_name"] == "EXTRA_TREES"
    assert result["promotion_status"] == "PENDING_MANAGER_APPROVAL"
    assert len(calls) == 2
    assert "--forecast-only" in calls[1]
