from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "forecast-service"
    service_port: int = 8091
    ai_env: str = "local"
    log_level: str = "INFO"
    wms_api_base_url: str = "http://localhost:8080/api"
    wms_service_token: str | None = None
    database_url: str = "sqlite:///./forecast_service.db"
    reports_dir: str = "/reports"
    runtime_data_source_mode: str = "csv"  # csv | wms_db | auto
    wms_runtime_database_url: str | None = None
    wms_runtime_schema: str = "public"
    wms_runtime_outbound_statuses: str = "shipped,delivered,completed"
    artifact_dir: str = "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/artifacts"
    forecast_report_file: str = "dashboard_forecast_output.csv"
    inventory_report_file: str = "dashboard_inventory_recommendations.csv"
    metrics_report_file: str = "test_metrics_by_horizon.csv"
    inference_audit_log_file: str = "/tmp/forecast-service/inference_audit.jsonl"
    champion_models_json: str = "{}"
    fallback_classical_model: str = "ARIMA"
    publish_queue_poll_interval_seconds: float = 1.0
    publish_min_prediction_rows: int = 1
    publish_min_inventory_rows: int = 1
    publish_require_test_metrics: bool = True
    publish_require_non_null_test_kpis: bool = True
    retention_max_runs_per_scope: int = 30
    retention_max_run_age_days: int = 45
    inference_audit_max_lines: int = 10000
    alert_fallback_rate_threshold: float = 0.05
    alert_errors_threshold: int = 1
    alert_p95_latency_ms_threshold: float = 500.0
    api_auth_required: bool = False
    api_auth_token: str | None = None
    inference_rate_limit_per_minute: int = 600
    gate_max_wape: float = 0.135
    gate_max_abs_bias: float = 0.10
    gate_max_under_forecast_rate: float = 0.60
    gate_max_mase_mean: float = 1.10
    gate_max_fallback_rate: float = 0.05
    gate_max_hard_error_rate: float = 0.01
    gate_max_p95_latency_ms: float = 2500.0
    gate_enforce_on_promotion: bool = True
    gate_promotion_inference_window: int = 500
    drift_alert_wape_increase_ratio: float = 0.25
    drift_eval_min_rows: int = 200
    health_monitor_interval_seconds: float = 120.0
    freshness_max_age_minutes: float = 180.0
    runtime_contract_check_cache_seconds: float = 60.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
