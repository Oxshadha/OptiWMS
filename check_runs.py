import sqlite3
import pandas as pd

try:
    conn = sqlite3.connect("ai_services/forecast-service/forecast_service.db")
    runs = pd.read_sql("SELECT id, status, dataset, model_name, created_at FROM forecast_runs ORDER BY id DESC LIMIT 5", conn)
    print("=== LATEST RUNS ===")
    print(runs)
    
    jobs = pd.read_sql("SELECT id, run_id, mode, status, error FROM publish_jobs ORDER BY id DESC LIMIT 5", conn)
    print("\n=== LATEST JOBS ===")
    print(jobs)
    
    metrics = pd.read_sql("SELECT * FROM forecast_metrics ORDER BY id DESC LIMIT 1", conn)
    print("\n=== LATEST METRICS ===")
    print(metrics)
    
except Exception as e:
    print(f"Error: {e}")
