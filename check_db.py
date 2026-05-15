from sqlalchemy import create_engine
import pandas as pd

engine = create_engine("postgresql://optiwms:optiwms@localhost:5434/optiwms")

print("--- Inventory Recommendations ---")
df = pd.read_sql("SELECT * FROM inventory_recommendations ORDER BY run_id DESC LIMIT 5", engine)
print(df)

print("\n--- Forecast Predictions (CREAM_002) ---")
df2 = pd.read_sql("SELECT * FROM forecast_predictions WHERE sku = 'CREAM_002' ORDER BY run_id DESC LIMIT 5", engine)
print(df2)

print("\n--- Latest Runs ---")
df3 = pd.read_sql("SELECT * FROM forecast_runs ORDER BY id DESC LIMIT 5", engine)
print(df3)
