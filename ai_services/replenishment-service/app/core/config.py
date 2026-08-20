from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    api_title: str = "OptiWMS Replenishment Service"
    api_version: str = "1.0.0"
    
    # Service URLs
    forecast_service_url: str = Field(default="http://localhost:8091")
    slotting_service_url: str = Field(default="http://localhost:8083")
    wms_backend_url: str = Field(default="http://localhost:8080")
    
    # Database
    wms_runtime_database_url: str = Field(default="postgresql://optiwms:optiwms123@localhost:5434/optiwms")
    replenishment_db_path: str = Field(default="sqlite:///./replenishment.db")
    
    # Baseline Configurations (Adjusted based on SL context)
    default_service_level: float = Field(default=0.95)
    ordering_cost_per_order: float = Field(default=1200.0) # LKR
    annual_holding_cost_percent: float = Field(default=0.25) # 25%
    forklift_cost_per_move: float = Field(default=120.0) # LKR
    reslotting_cov_threshold: float = Field(default=0.20)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
