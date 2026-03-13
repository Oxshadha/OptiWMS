from pathlib import Path
import pandas as pd

REPORT_PATH = Path("/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/dashboard_forecast_output.csv")
INV_PATH = Path("/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/dashboard_inventory_recommendations.csv")


def load_forecast() -> pd.DataFrame:
    if REPORT_PATH.exists():
        df = pd.read_csv(REPORT_PATH)
        return df
    return pd.DataFrame()


def load_inventory() -> pd.DataFrame:
    if INV_PATH.exists():
        return pd.read_csv(INV_PATH)
    return pd.DataFrame()
