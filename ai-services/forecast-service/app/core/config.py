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
    artifact_dir: str = "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/artifacts"
    forecast_report_file: str = "dashboard_forecast_output.csv"
    inventory_report_file: str = "dashboard_inventory_recommendations.csv"
    metrics_report_file: str = "test_metrics_by_horizon.csv"
    inference_audit_log_file: str = "/tmp/forecast-service/inference_audit.jsonl"
    champion_models_json: str = "{}"
    alert_fallback_rate_threshold: float = 0.05
    alert_errors_threshold: int = 1
    alert_p95_latency_ms_threshold: float = 500.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
