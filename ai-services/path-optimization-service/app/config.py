"""Configuration settings for Path Optimization Service"""
import os
from typing import Optional

class Settings:
    """Application settings"""
    
    # Service
    service_name: str = "path-optimization-service"
    service_version: str = "0.1.0"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8081
    debug: bool = False
    
    # Database (optional)
    database_url: Optional[str] = None
    
    # Logging
    log_level: str = "INFO"
    
    # A* Pathfinding
    max_grid_size: int = 1000
    enable_batch_processing: bool = True
    max_batch_size: int = 100

settings = Settings()
