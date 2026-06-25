import pandas as pd
import numpy as np

# 1. Preprocessing
df = pd.read_parquet('../outputs/m5_prepared/m5_monthly_panel.parquet')
df['month'] = pd.to_datetime(df['month'].astype(str))
df = df[df['month'] < '2016-05-01'].copy()
def clip_outliers_mad(series, threshold=3.5):
    median = series.median()
    mad = np.median(np.abs(series - median))
    if mad == 0: return series
    modified_z_scores = 0.6745 * (series - median) / mad
    upper_bound = median + (threshold * mad / 0.6745)
    lower_bound = max(0, median - (threshold * mad / 0.6745))
    return series.clip(lower=lower_bound, upper=upper_bound)
df['demand_clean'] = df.groupby('series_id')['demand'].transform(clip_outliers_mad)

# 2. Hierarchy
level_2 = df[['month', 'series_id', 'category', 'demand_clean']].copy()
level_1 = level_2.groupby(['month', 'category'])['demand_clean'].sum().reset_index()
level_1['series_id'] = 'CAT_' + level_1['category']
level_0 = level_2.groupby(['month'])['demand_clean'].sum().reset_index()
level_0['series_id'] = 'TOTAL'
level_0['category'] = 'TOTAL'
hierarchical_df = pd.concat([level_0, level_1, level_2], ignore_index=True)
hierarchical_df['demand_transformed'] = np.log1p(hierarchical_df['demand_clean'])

# Print transformed scale for Total
tot = hierarchical_df[hierarchical_df['series_id'] == 'TOTAL'].sort_values('month')
print("Total demand_clean range:", tot['demand_clean'].min(), tot['demand_clean'].max())
print("Total demand_transformed range:", tot['demand_transformed'].min(), tot['demand_transformed'].max())
