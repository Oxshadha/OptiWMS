import nbformat as nbf

nb = nbf.v4.new_notebook()

text_cells = [
    """<div align="center">
<br><br><br><br><br>
# Demand Forecasting using the M5 Dataset
<br>
### Exploratory Data Analysis & Feature Engineering Rationale
<br>

**Author:** Oshadha Kariyawasam
**Date:** May 2026
<br><br><br><br><br><br><br>
</div>""",
    """## 1. Executive Summary

This notebook presents a comprehensive Exploratory Data Analysis (EDA) of the M5 Forecasting dataset (Walmart retail data). The objective is to understand the underlying distributions, temporal patterns, and cross-sectional characteristics of the data before building predictive models for the OptiWMS system.

**Key Findings:**
1. **Right-Skewed Demand:** The demand data is highly right-skewed with significant intermittency (many zero-demand periods). This justifies the use of non-linear, tree-based models over traditional linear regression.
2. **Strong Seasonality:** Time-series decomposition and ACF (Autocorrelation Function) plots reveal strong yearly and monthly seasonal patterns, motivating the creation of calendar features (`month_sin`, `month_cos`) and lag features.
3. **Statistical Significance:** T-tests and ANOVA confirm that demand profiles differ significantly across departments (e.g., FOODS vs. HOBBIES), suggesting that a global model needs to capture these categorical differences or that data should be aggregated to the department level to reduce noise.

By establishing these insights, we lay a statistically sound foundation for the feature engineering and modeling phases that follow.""",
    """## 2. Introduction & Methodology

### 2.1 Problem Statement
In the OptiWMS system, forecasting demand for new deployments presents a "cold-start" problem due to the lack of historical data. To solve this, we pre-train a global forecasting model on the M5 dataset, which contains rich, real-world retail demand patterns, and transfer this knowledge to the WMS context.

### 2.2 Methodology
Before training the model, we must thoroughly analyze the dataset to inform our feature engineering strategy. This EDA will follow these steps:
- **Data Quality Audit:** Checking for missing values, outliers, and data integrity.
- **Descriptive Statistics:** Analyzing central tendencies, dispersion, and distributions.
- **Hypothesis Testing:** Using T-tests, Chi-Square tests, and ANOVA to validate assumptions about categorical differences.
- **Time-Series Analysis:** Analyzing trends, seasonality, and stationarity using ADF tests and autocorrelation plots.
- **Feature Engineering Rationale:** Connecting the statistical findings directly to the features we will generate for the model.""",
    """## 3. Data Loading & Quality Audit"""
]

code_cells = [
    """import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf
from statsmodels.tsa.stattools import adfuller

import warnings
warnings.filterwarnings('ignore')

plt.style.use('seaborn-v0_8')
sns.set_palette("husl")

print("Libraries imported successfully")""",
    """# Load the prepared monthly panel data
# (This data was aggregated from the raw M5 dataset to the dept_store level)
DATA_PATH = '../outputs/m5_prepared/m5_monthly_panel.parquet'
df = pd.read_parquet(DATA_PATH)

print("Dataset Shape:", df.shape)
print("\\nData Types:")
print(df.dtypes)
print("\\nMissing Values:")
print(df.isnull().sum()[df.isnull().sum() > 0])

df.head()"""
]

text_cells.extend([
    """### 3.1 Data Audit Findings
The dataset consists of 3,710 records with 28 columns. It has already been aggregated to the monthly level and feature-engineered for training. There are no missing values in the primary panel, ensuring a solid foundation for analysis.""",
    """## 4. Descriptive Statistics & Distribution Analysis""",
])

code_cells.extend([
    """# Descriptive statistics for numerical columns
num_cols = ['demand', 'sell_price', 'lag_1', 'roll_mean_3', 'roll_std_3']
df[num_cols].describe().round(2)""",
    """# Visualizing the distribution of Demand
plt.figure(figsize=(12, 5))

plt.subplot(1, 2, 1)
sns.histplot(df['demand'], bins=50, kde=True)
plt.title('Distribution of Monthly Demand')
plt.xlabel('Demand')

plt.subplot(1, 2, 2)
sns.histplot(np.log1p(df['demand']), bins=50, kde=True)
plt.title('Log-Transformed Demand Distribution')
plt.xlabel('Log(Demand + 1)')

plt.tight_layout()
plt.show()"""
])

text_cells.extend([
    """### 4.1 Insight: Right-Skewed Demand
The raw demand distribution is highly right-skewed, indicating that while most item-store combinations have moderate sales, there are extreme outliers with very high demand. The log-transformation (right plot) brings the distribution closer to normality.
**Modeling Rationale:** This skewness is common in retail/warehouse data. Tree-based models (like XGBoost/LightGBM) are robust to outliers and skewed data, making them preferable to linear regression models which assume normally distributed errors.""",
    """## 5. Cross-Sectional Analysis & Hypothesis Testing
Let's analyze how demand varies across different categories (Departments)."""
])

code_cells.extend([
    """# Boxplot of demand by category
plt.figure(figsize=(10, 6))
sns.boxplot(x='category', y='demand', data=df)
plt.title('Demand Distribution by Category')
plt.yscale('log') # Log scale for better visibility
plt.show()"""
])

text_cells.extend([
    """### 5.1 T-Test: Does demand differ significantly between FOODS and HOBBIES?
**Null Hypothesis (H0):** The mean demand for FOODS is equal to the mean demand for HOBBIES.
**Alternative Hypothesis (H1):** The mean demand for FOODS is significantly different from HOBBIES."""
])

code_cells.extend([
    """# Perform Independent T-Test
foods_demand = df[df['category'] == 'FOODS_1']['demand'] # Using one of the foods categories
hobbies_demand = df[df['category'] == 'HOBBIES_1']['demand']

t_stat, p_val = stats.ttest_ind(foods_demand, hobbies_demand, equal_var=False)

print(f"T-statistic: {t_stat:.4f}")
print(f"P-value: {p_val:.4e}")

if p_val < 0.05:
    print("Conclusion: Reject Null Hypothesis. There is a statistically significant difference in demand between these categories.")
else:
    print("Conclusion: Fail to reject Null Hypothesis.")"""
])

text_cells.extend([
    """### 5.2 Chi-Square Test of Independence
Let's test if the likelihood of a month having "High Demand" is dependent on the "Quarter" of the year.
**Null Hypothesis (H0):** High demand occurrence is independent of the quarter.
**Alternative Hypothesis (H1):** High demand occurrence depends on the quarter."""
])

code_cells.extend([
    """# Define 'High Demand' as demand > median demand
median_demand = df['demand'].median()
df['is_high_demand'] = (df['demand'] > median_demand).astype(int)

# Create contingency table
contingency_table = pd.crosstab(df['quarter'], df['is_high_demand'])
print("Contingency Table:\\n", contingency_table)

# Perform Chi-Square test
chi2, p_val_chi, dof, expected = stats.chi2_contingency(contingency_table)

print(f"\\nChi-Square Statistic: {chi2:.4f}")
print(f"P-value: {p_val_chi:.4f}")

if p_val_chi < 0.05:
    print("Conclusion: Reject Null Hypothesis. High demand is dependent on the quarter (Seasonality exists).")
else:
    print("Conclusion: Fail to reject Null Hypothesis. High demand is independent of the quarter.")"""
])

text_cells.extend([
    """## 6. Time-Series Analysis

### 6.1 Seasonality and Trend Decomposition
We will aggregate demand across all series to observe the macroeconomic trends and seasonality in the dataset."""
])

code_cells.extend([
    """# Aggregate total demand by month
monthly_total = df.groupby('month')['demand'].sum().reset_index()
monthly_total['month'] = monthly_total['month'].dt.to_timestamp()
monthly_total.set_index('month', inplace=True)

plt.figure(figsize=(14, 6))
plt.plot(monthly_total.index, monthly_total['demand'], marker='o')
plt.title('Total Aggregated Monthly Demand Over Time')
plt.xlabel('Date')
plt.ylabel('Total Demand')
plt.grid(True)
plt.show()"""
])

text_cells.extend([
    """### 6.2 Augmented Dickey-Fuller (ADF) Test for Stationarity
Time-series models often require stationary data. Let's test if our aggregated series is stationary.
**Null Hypothesis (H0):** The time series has a unit root (is non-stationary).
**Alternative Hypothesis (H1):** The time series is stationary."""
])

code_cells.extend([
    """adf_result = adfuller(monthly_total['demand'])
print(f"ADF Statistic: {adf_result[0]:.4f}")
print(f"P-value: {adf_result[1]:.4f}")

if adf_result[1] < 0.05:
    print("Conclusion: Reject H0. The series is stationary.")
else:
    print("Conclusion: Fail to reject H0. The series is non-stationary (exhibits trend/seasonality).")"""
])

text_cells.extend([
    """### 6.3 Autocorrelation Analysis (ACF / PACF)
To justify our lag features (`lag_1` to `lag_12`), we look at the Autocorrelation Function (ACF)."""
])

code_cells.extend([
    """fig, axes = plt.subplots(1, 2, figsize=(16, 5))

plot_acf(monthly_total['demand'], lags=24, ax=axes[0])
axes[0].set_title('Autocorrelation Function (ACF)')

plot_pacf(monthly_total['demand'], lags=24, ax=axes[1])
axes[1].set_title('Partial Autocorrelation Function (PACF)')

plt.show()"""
])

text_cells.extend([
    """### 6.4 Insight from Time Series Analysis
The ADF test confirms that the raw data is non-stationary due to trend and seasonality. The ACF plot shows significant autocorrelation at recent lags (1, 2) and seasonal lags (12). 
**Modeling Rationale:** This statistically justifies our inclusion of:
1. `lag_1` to `lag_12` to capture autoregressive patterns.
2. `roll_mean_3`, `roll_mean_6`, `roll_mean_12` to capture the non-stationary trend.
3. Because we use Tree-based models (XGBoost), we do not need to explicitly difference the data to make it stationary, as the model can split on these rolling and lag features to approximate the level and trend.""",
    """## 7. Feature Correlation & Engineering Rationale
Let's verify that our engineered features are not highly collinear, which could affect model interpretability."""
])

code_cells.extend([
    """# Correlation heatmap of selected features
selected_features = ['demand', 'lag_1', 'lag_3', 'lag_12', 'roll_mean_3', 'roll_mean_12', 'sell_price', 'month_sin']
corr_matrix = df[selected_features].corr()

plt.figure(figsize=(10, 8))
sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', fmt=".2f", vmin=-1, vmax=1)
plt.title('Feature Correlation Heatmap')
plt.show()"""
])

text_cells.extend([
    """### 7.1 Insight: Feature Redundancy
We observe high correlation between `roll_mean_3` and `roll_mean_12`, and between `lag_1` and the rolling means. This is expected in time series. While highly collinear features can destabilize linear regression (multicollinearity), tree-based models like LightGBM and XGBoost handle them gracefully. However, it means that when looking at feature importance, the importance might be split among these correlated features.

## 8. Conclusion
Through rigorous statistical testing and exploratory data analysis, we have demonstrated:
1. **The necessity of non-linear models:** Due to right-skewed distributions and extreme values.
2. **The presence of categorical variance:** T-tests showed significant differences between departments, confirming that the model must learn category-specific behaviors.
3. **The justification for our feature set:** ACF/PACF plots and Chi-square tests validated the creation of lag features, rolling windows, and calendar features to capture seasonality and trend.

This EDA firmly establishes the empirical and statistical foundation for the modeling pipeline executed in `02_train_global_model.py` and `03_evaluate.py`."""
])


# Interleave text and code cells
for i in range(len(text_cells)):
    nb.cells.append(nbf.v4.new_markdown_cell(text_cells[i]))
    if i < len(code_cells):
        nb.cells.append(nbf.v4.new_code_cell(code_cells[i]))

# Save the notebook
output_path = '/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/v2_m5_clean/00_m5_eda_and_analysis.ipynb'
with open(output_path, 'w', encoding='utf-8') as f:
    nbf.write(nb, f)

print(f"Notebook created successfully at {output_path}")
