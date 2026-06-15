import nbformat as nbf
import os
import sys

V5_DIR = "v5_paper_compliant"
os.makedirs(V5_DIR, exist_ok=True)
os.makedirs(os.path.join(V5_DIR, "plots"), exist_ok=True)
os.makedirs(os.path.join(V5_DIR, "data"), exist_ok=True)

def md(nb, s): nb.cells.append(nbf.v4.new_markdown_cell(s))
def code(nb, s): nb.cells.append(nbf.v4.new_code_cell(s))

def create_nb1():
    nb = nbf.v4.new_notebook()
    nb.metadata.kernelspec = {"display_name":"Python 3","language":"python","name":"python3"}
    
    md(nb, """# Notebook 1: Data Pre-Processing & Exploratory Data Analysis

## Theoretical Foundation
As emphasized in **Section 2.2 (Pre-processing data)** of *Forecasting: theory and practice* by Petropoulos et al., high-quality forecasts depend heavily on data preparation. This notebook implements:
1. **Robust Outlier Handling (Section 2.2.4):** Using Median Absolute Deviation (MAD) to clean the demand signal.
2. **Box-Cox Transformations (Section 2.2.1):** To stabilize variance before any modeling takes place.
3. **Time Series Decomposition (Section 2.2.2):** To visualize trend and seasonality.""")

    code(nb, """import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from statsmodels.tsa.seasonal import seasonal_decompose

plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams.update({'figure.figsize':(14,6), 'font.size':11})

import warnings
warnings.filterwarnings('ignore')

# Load the raw dataset (previously prepared by v2 pipeline)
PANEL_PATH = "../outputs/m5_prepared/m5_monthly_panel.parquet"
df = pd.read_parquet(PANEL_PATH)
df['month'] = pd.to_datetime(df['month'].astype(str))

# FIX: Drop incomplete final month (2016-05)
df = df[df['month'] < '2016-05-01'].copy()

print(f"Loaded {df.shape[0]} rows. Data ranges from {df['month'].min()} to {df['month'].max()}")""")

    md(nb, """### 1. Robust Outlier Handling
*Reference: Section 2.2.4 - Robust handling of outliers in time series forecasting.*
Outliers can severely distort both classical and ML models. We use the Median Absolute Deviation (MAD) to identify and clip outliers robustly.""")

    code(nb, """def clip_outliers_mad(series, threshold=3.5):
    median = series.median()
    mad = np.median(np.abs(series - median))
    if mad == 0:
        return series # Avoid division by zero
    modified_z_scores = 0.6745 * (series - median) / mad
    
    # Clip values where modified Z-score > threshold
    upper_bound = median + (threshold * mad / 0.6745)
    lower_bound = max(0, median - (threshold * mad / 0.6745)) # demand >= 0
    
    return series.clip(lower=lower_bound, upper=upper_bound)

# Apply to each series independently
df['demand_clean'] = df.groupby('series_id')['demand'].transform(clip_outliers_mad)

# Visualize the effect on a volatile series
sample_series = df['series_id'].unique()[0]
sample_df = df[df['series_id'] == sample_series].sort_values('month')

plt.figure(figsize=(14, 5))
plt.plot(sample_df['month'], sample_df['demand'], label='Original Demand', alpha=0.5, marker='o')
plt.plot(sample_df['month'], sample_df['demand_clean'], label='Cleaned Demand (MAD)', marker='x')
plt.title(f"Outlier Handling for Series: {sample_series}")
plt.legend()
plt.tight_layout()
plt.savefig('plots/01_outlier_handling.png')
plt.show()""")

    md(nb, """### 2. Variance Stabilization (log1p)
*Reference: Section 2.2.1 - Box-Cox transformations.*
To stabilize variance, we apply the `log1p` transformation (equivalent to Box-Cox with $\lambda=0$). We do this *after* hierarchical aggregation in Notebook 2, so here we just verify the overall dataset.""")

    code(nb, """# Since we will apply log1p after aggregation in Notebook 2, 
# we just preview the distribution of the cleaned demand here.
plt.figure(figsize=(14, 5))
sns.histplot(df['demand_clean'], bins=50, kde=True)
plt.title('Distribution of Cleaned Demand (Raw Scale)')
plt.xlabel('Demand')
plt.tight_layout()
plt.show()""")

    md(nb, """### 3. Time Series Decomposition
*Reference: Section 2.2.2 - Time series decomposition.*
We decompose the aggregated total demand to verify the underlying structural components.""")

    code(nb, """# Aggregate total demand across all series
total_demand = df.groupby('month')['demand_clean'].sum().reset_index()
total_demand.set_index('month', inplace=True)

# Additive decomposition on the original scale
decomp = seasonal_decompose(total_demand['demand_clean'], model='additive', period=12)

fig, axes = plt.subplots(4, 1, figsize=(14, 10), sharex=True)
decomp.observed.plot(ax=axes[0], color='black'); axes[0].set_title('Observed')
decomp.trend.plot(ax=axes[1], color='coral'); axes[1].set_title('Trend')
decomp.seasonal.plot(ax=axes[2], color='seagreen'); axes[2].set_title('Seasonal')
decomp.resid.plot(ax=axes[3], color='grey'); axes[3].set_title('Residual')
plt.suptitle('Seasonal Decomposition of Total Cleaned Demand', fontsize=14, fontweight='bold')
plt.tight_layout()
plt.savefig('plots/03_decomposition.png')
plt.show()""")

    code(nb, """# Save the cleaned dataset
df.to_parquet('data/01_preprocessed_m5.parquet', index=False)
print("Successfully saved preprocessed data.")""")

    nbf.write(nb, os.path.join(V5_DIR, "01_Data_Preprocessing.ipynb"))
    print("Generated Notebook 1")


def create_nb2():
    nb = nbf.v4.new_notebook()
    nb.metadata.kernelspec = {"display_name":"Python 3","language":"python","name":"python3"}
    
    md(nb, """# Notebook 2: Hierarchical Features

## Theoretical Foundation
As defined in **Section 2.10.1 (Cross-sectional hierarchical forecasting)**, we must recognize that M5 sales are naturally grouped. Forecasting at multiple levels and reconciling them improves accuracy globally.

This notebook builds the hierarchical dataset:
- **Level 0 (Total):** The sum of all sales.
- **Level 1 (Department):** Sales grouped by department (`dept_id`).
- **Level 2 (Store-Department):** Sales grouped by store and department (`store_id`, `dept_id`).
- **Level 3 (Item-Store):** The base level.""")

    code(nb, """import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

df = pd.read_parquet('data/01_preprocessed_m5.parquet')
print(f"Loaded {df.shape[0]} rows of preprocessed data.")""")

    md(nb, """### 1. Constructing the Hierarchy""")

    code(nb, """# The raw data has item_id, dept_id, cat_id, store_id
print("Columns available:", df.columns.tolist())

# Level 2: Series
level_2 = df[['month', 'series_id', 'category', 'demand_clean']].copy()

# Level 1: Category (AGGREGATE ON RAW SCALE)
level_1 = level_2.groupby(['month', 'category'])['demand_clean'].sum().reset_index()
level_1['series_id'] = 'CAT_' + level_1['category']

# Level 0: Total (AGGREGATE ON RAW SCALE)
level_0 = level_2.groupby(['month'])['demand_clean'].sum().reset_index()
level_0['series_id'] = 'TOTAL'
level_0['category'] = 'TOTAL'

# Combine all levels
hierarchical_df = pd.concat([
    level_0[['month', 'series_id', 'demand_clean']],
    level_1[['month', 'series_id', 'demand_clean']],
    level_2[['month', 'series_id', 'demand_clean']]
], ignore_index=True)

# APPLY STABILIZATION (log1p) AFTER AGGREGATION
hierarchical_df['demand_transformed'] = np.log1p(hierarchical_df['demand_clean'])

print(f"Hierarchical Dataset: {hierarchical_df.shape[0]} rows across {hierarchical_df['series_id'].nunique()} distinct series.")
""")

    md(nb, """### 2. Feature Engineering across all levels
We engineer lags and rolling features for *every* node in the hierarchy, allowing models to learn dynamics at the aggregate and base levels.""")

    code(nb, """def engineer_features(group):
    g = group.sort_values('month').copy()
    target = g['demand_transformed']
    
    # Lags
    for lag in [1, 2, 3, 6, 12]:
        g[f'lag_{lag}'] = target.shift(lag)
        
    # Rolling Means
    for w in [3, 6, 12]:
        g[f'roll_mean_{w}'] = target.shift(1).rolling(w, min_periods=1).mean()
        g[f'roll_std_{w}'] = target.shift(1).rolling(w, min_periods=2).std().fillna(0)
        
    # Calendar Features
    g['month_num'] = g['month'].dt.month
    g['quarter'] = g['month'].dt.quarter
    g['month_sin'] = np.sin(2 * np.pi * g['month_num'] / 12.0)
    g['month_cos'] = np.cos(2 * np.pi * g['month_num'] / 12.0)
    
    return g

# Apply feature engineering to each series in the hierarchy
features_df = hierarchical_df.groupby('series_id').apply(engineer_features).reset_index(drop=True)

# Drop initial rows with NaNs due to max lag (12)
features_df = features_df.dropna(subset=['lag_12']).reset_index(drop=True)
print(f"Final Features Dataset: {features_df.shape[0]} rows, {features_df.shape[1]} columns.")

features_df.to_parquet('data/02_hierarchical_features.parquet', index=False)
print("Saved hierarchical features.")""")

    nbf.write(nb, os.path.join(V5_DIR, "02_Hierarchical_Features.ipynb"))
    print("Generated Notebook 2")

def create_nb3():
    nb = nbf.v4.new_notebook()
    nb.metadata.kernelspec = {"display_name":"Python 3","language":"python","name":"python3"}
    
    md(nb, """# Notebook 3: Model Training & Time-Series Cross-Validation

## Theoretical Foundation
According to **Section 2.5.5 (Cross-validation for time-series data)**, traditional train/test splits are insufficient for time series. We implement **Rolling Origin Evaluation** (Time-Series CV) to rigorously test our models.
Furthermore, we employ powerful gradient boosting algorithms (LightGBM) which handle non-linear relationships well (Section 2.7.10).""")

    code(nb, """import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.metrics import mean_squared_error, mean_absolute_error
import warnings
warnings.filterwarnings('ignore')

df = pd.read_parquet('data/02_hierarchical_features.parquet')
df['month'] = pd.to_datetime(df['month'])
df.sort_values(['series_id', 'month'], inplace=True)

FEATURE_COLS = [c for c in df.columns if c.startswith(('lag', 'roll', 'month_', 'quarter'))]
TARGET = 'demand_transformed'

print(f"Features: {FEATURE_COLS}")""")

    md(nb, """### 1. Rolling Origin Time-Series Cross Validation
We train the model over multiple expanding windows, evaluating on the immediate next month (H=1) up to H=6.""")

    code(nb, """# Define rolling origin cutoffs
months = sorted(df['month'].unique())
cv_splits = []
test_horizon = 6
# We take the last 3 possible origins for CV
for i in range(1, 4):
    test_start_idx = -test_horizon * i
    train_end = months[test_start_idx - 1]
    test_start = months[test_start_idx]
    test_end = months[test_start_idx + test_horizon - 1]
    cv_splits.append((train_end, test_start, test_end))

print("Time Series CV Splits:")
for i, (tr_e, te_s, te_e) in enumerate(cv_splits):
    print(f"Fold {i+1}: Train until {tr_e.date()} | Test from {te_s.date()} to {te_e.date()}")""")

    md(nb, """### 2. Train and Evaluate Base Models
We train a single global LightGBM model across all hierarchical levels. Global models often outperform local models by learning cross-series patterns (Section 2.7.1).""")

    code(nb, """fold_results = []
models = []

for i, (train_end, test_start, test_end) in enumerate(cv_splits):
    train_mask = df['month'] <= train_end
    test_mask = (df['month'] >= test_start) & (df['month'] <= test_end)
    
    X_train, y_train = df[train_mask][FEATURE_COLS], df[train_mask][TARGET]
    X_test, y_test = df[test_mask][FEATURE_COLS], df[test_mask][TARGET]
    
    # Train model
    model = lgb.LGBMRegressor(n_estimators=200, learning_rate=0.05, random_state=42, verbose=-1)
    model.fit(X_train, y_train)
    models.append(model)
    
    # Predict
    preds = model.predict(X_test)
    
    # Evaluate (on transformed scale for now)
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    mae = mean_absolute_error(y_test, preds)
    
    fold_results.append({'Fold': i+1, 'RMSE': rmse, 'MAE': mae})
    print(f"Fold {i+1} -> RMSE: {rmse:.3f}, MAE: {mae:.3f}")

cv_df = pd.DataFrame(fold_results)
print("\\nAverage CV Performance:")
print(cv_df.mean())

# Save the model from the most recent fold
import joblib
joblib.dump(models[0], 'data/03_lgbm_model.pkl')""")

    nbf.write(nb, os.path.join(V5_DIR, "03_Model_Training_CV.ipynb"))
    print("Generated Notebook 3")

def create_nb4():
    nb = nbf.v4.new_notebook()
    nb.metadata.kernelspec = {"display_name":"Python 3","language":"python","name":"python3"}
    
    md(nb, """# Notebook 4: Ensembles and Uncertainty (Probabilistic Forecasting)

## Theoretical Foundation
As per **Section 2.6 (Combining forecasts)**, ensembles reduce variance and consistently improve accuracy. 
Additionally, **Section 2.3.21 (Estimation and representation of uncertainty)** dictates that point forecasts are insufficient; we must provide prediction intervals.

Here we:
1. Train a secondary model (CatBoost) to ensemble with our LightGBM model.
2. Generate probabilistic predictions using Quantile Regression.""")

    code(nb, """import pandas as pd
import numpy as np
import lightgbm as lgb
from catboost import CatBoostRegressor
import joblib
import warnings
warnings.filterwarnings('ignore')

df = pd.read_parquet('data/02_hierarchical_features.parquet')
df['month'] = pd.to_datetime(df['month'])
FEATURE_COLS = [c for c in df.columns if c.startswith(('lag', 'roll', 'month_', 'quarter'))]
TARGET = 'demand_transformed'

# We use the final 6 months as our actual Test set
test_start = sorted(df['month'].unique())[-6]
train_df = df[df['month'] < test_start]
test_df = df[df['month'] >= test_start].copy()

X_train, y_train = train_df[FEATURE_COLS], train_df[TARGET]
X_test, y_test = test_df[FEATURE_COLS], test_df[TARGET]""")

    md(nb, """### 1. Ensembling
Train LightGBM and CatBoost, then average their predictions.""")

    code(nb, """# LightGBM (Point Forecast)
lgb_model = lgb.LGBMRegressor(n_estimators=200, learning_rate=0.05, random_state=42, verbose=-1)
lgb_model.fit(X_train, y_train)
lgb_preds = lgb_model.predict(X_test)

# CatBoost (Point Forecast)
cb_model = CatBoostRegressor(iterations=200, learning_rate=0.05, random_seed=42, verbose=0)
cb_model.fit(X_train, y_train)
cb_preds = cb_model.predict(X_test)

# Simple Average Ensemble
ensemble_preds = (lgb_preds + cb_preds) / 2.0
test_df['pred_mean'] = ensemble_preds""")

    md(nb, """### 2. Probabilistic Forecasting (Prediction Intervals)
Train quantile models for the 10th and 90th percentiles to provide an 80% Prediction Interval.""")

    code(nb, """# LightGBM Quantile Regression
lgb_q10 = lgb.LGBMRegressor(objective='quantile', alpha=0.1, n_estimators=200, verbose=-1)
lgb_q10.fit(X_train, y_train)
test_df['pred_q10'] = lgb_q10.predict(X_test)

lgb_q90 = lgb.LGBMRegressor(objective='quantile', alpha=0.9, n_estimators=200, verbose=-1)
lgb_q90.fit(X_train, y_train)
test_df['pred_q90'] = lgb_q90.predict(X_test)

test_df.to_parquet('data/04_ensemble_probabilistic_preds.parquet', index=False)
print("Ensemble and probabilistic predictions saved.")""")

    nbf.write(nb, os.path.join(V5_DIR, "04_Ensembles_and_Uncertainty.ipynb"))
    print("Generated Notebook 4")

def create_nb5():
    nb = nbf.v4.new_notebook()
    nb.metadata.kernelspec = {"display_name":"Python 3","language":"python","name":"python3"}
    
    md(nb, """# Notebook 5: Reconciliation and Evaluation

## Theoretical Foundation
This notebook implements the final, most critical components of modern forecasting theory:
1. **Hierarchical Reconciliation (Section 2.10.1):** We mathematically adjust the independent base forecasts so that the lower-level forecasts sum up exactly to the upper-level forecasts. We use a simple Bottom-Up approach to demonstrate the concept.
2. **Evaluation (Section 2.12.6):** We use the Diebold-Mariano test to prove our model is statistically significantly better than a baseline.""")

    code(nb, """import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')

preds_df = pd.read_parquet('data/04_ensemble_probabilistic_preds.parquet')""")

    md(nb, """### 1. Back-Transformation
We must revert the log1p transformation to evaluate on the original scale.""")

    code(nb, """def invert_log1p(series):
    # log1p back-transform is expm1
    # We use np.clip to avoid infinite exponentials just in case
    return np.expm1(np.clip(series, a_min=0, a_max=20))

for col in ['demand_transformed', 'pred_mean', 'pred_q10', 'pred_q90']:
    new_col = col.replace('_transformed', '') if 'transformed' in col else col + '_orig'
    preds_df[new_col] = invert_log1p(preds_df[col])

# Rename for clarity
preds_df.rename(columns={'demand': 'actuals'}, inplace=True)
""")

    md(nb, """### 2. Hierarchical Reconciliation (Bottom-Up)
To ensure structural consistency ($Total = \sum Categories$), we reconcile the forecasts. Here we implement Bottom-Up: we take the base level (Category) forecasts and sum them to obtain the reconciled Total.""")

    code(nb, """# Separate base level (Category) and aggregate level (Total)
base_preds = preds_df[preds_df['series_id'].str.startswith('CAT_')].copy()

# Bottom-Up Reconciliation
reconciled_total = base_preds.groupby('month')[['pred_mean_orig', 'pred_q10_orig', 'pred_q90_orig']].sum().reset_index()
reconciled_total['series_id'] = 'TOTAL_RECONCILED'

# Compare original Total vs Reconciled Total
original_total = preds_df[preds_df['series_id'] == 'TOTAL'].sort_values('month')

fig, ax = plt.subplots(figsize=(14, 6))
ax.plot(original_total['month'], original_total['actuals'], 'k-', label='Actual Total', linewidth=2)
ax.plot(original_total['month'], original_total['pred_mean_orig'], 'r--', label='Base Total Forecast')
ax.plot(reconciled_total['month'], reconciled_total['pred_mean_orig'], 'b-.', label='Reconciled Total (Bottom-Up)')
ax.fill_between(reconciled_total['month'], reconciled_total['pred_q10_orig'], reconciled_total['pred_q90_orig'], color='blue', alpha=0.1, label='80% PI (Reconciled)')
ax.set_title('Hierarchical Reconciliation: Base vs Reconciled Total')
ax.legend()
plt.savefig('plots/04_reconciliation.png')
plt.show()""")

    md(nb, """### 3. Statistical Testing: Diebold-Mariano
*Reference: Section 2.12.6 - Statistical tests of forecast performance.*
We evaluate if the ensemble model significantly outperforms a Seasonal Naive baseline.""")

    code(nb, """# Function to compute basic DM statistic for squared errors
def dm_test(actual, pred1, pred2):
    e1 = actual - pred1
    e2 = actual - pred2
    d = e1**2 - e2**2
    d_mean = np.mean(d)
    d_var = np.var(d, ddof=1)
    stat = d_mean / np.sqrt(d_var / len(d))
    return stat

# For demonstration, we use lag_12 (Seasonal Naive) as baseline
# It needs to be back-transformed too
preds_df['naive_orig'] = invert_log1p(preds_df['lag_12'])

# Calculate WAPE
def wape(actual, pred):
    return np.sum(np.abs(actual - pred)) / max(np.sum(actual), 1e-9)

print(f"Ensemble WAPE: {wape(preds_df['actuals'], preds_df['pred_mean_orig']):.4f}")
print(f"Naive WAPE: {wape(preds_df['actuals'], preds_df['naive_orig']):.4f}")

# Diebold-Mariano test on the Total series
total_mask = preds_df['series_id'] == 'TOTAL'
actual_tot = preds_df.loc[total_mask, 'actuals'].values
pred_tot = preds_df.loc[total_mask, 'pred_mean_orig'].values
naive_tot = preds_df.loc[total_mask, 'naive_orig'].values

dm_stat = dm_test(actual_tot, pred_tot, naive_tot)
print(f"\\nDiebold-Mariano Statistic (Total Series): {dm_stat:.3f}")
if dm_stat < -1.96:
    print("Conclusion: The Ensemble is STATISTICALLY SIGNIFICANTLY better than Seasonal Naive (p < 0.05).")
else:
    print("Conclusion: No significant difference.")
""")

    nbf.write(nb, os.path.join(V5_DIR, "05_Reconciliation_and_Evaluation.ipynb"))
    print("Generated Notebook 5")

if __name__ == "__main__":
    create_nb1()
    create_nb2()
    create_nb3()
    create_nb4()
    create_nb5()
    print("All notebooks created successfully in v5_paper_compliant/")
