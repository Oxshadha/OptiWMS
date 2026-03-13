from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "orchestrator-service"
    service_port: int = 8092
    ai_env: str = "local"
    log_level: str = "INFO"
    wms_api_base_url: str = "http://localhost:8080/api"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
