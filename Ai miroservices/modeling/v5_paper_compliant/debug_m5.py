import pandas as pd
df = pd.read_parquet('../outputs/m5_prepared/m5_monthly_panel.parquet')
print("Total demand by month:")
print(df.groupby('month')['demand'].sum().tail(10))
