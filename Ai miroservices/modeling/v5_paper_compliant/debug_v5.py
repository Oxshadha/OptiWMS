import pandas as pd
import numpy as np

try:
    df = pd.read_parquet('data/04_ensemble_probabilistic_preds.parquet')
    print("Preds dataframe shape:", df.shape)
    tot = df[df['series_id'] == 'TOTAL'].head()
    print("TOTAL series sample:")
    print(tot[['month', 'demand_transformed', 'pred_mean']])
except Exception as e:
    print(e)
