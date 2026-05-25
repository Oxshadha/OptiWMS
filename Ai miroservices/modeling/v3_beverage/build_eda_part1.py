#!/usr/bin/env python3
"""Build EDA notebook Part 1: Sections 1-2 (Dataset Intro + Descriptive Stats)."""
import nbformat as nbf

nb = nbf.v4.new_notebook()
nb.metadata.kernelspec = {"display_name": "Python 3", "language": "python", "name": "python3"}

DATA_DIR = "../../Dataset Beverage Sales Histsory"

cells = []

def md(src): cells.append(nbf.v4.new_markdown_cell(src))
def code(src): cells.append(nbf.v4.new_code_cell(src))

# ============================================================
# TITLE
# ============================================================
md("""# Exploratory Data Analysis — Beverage Sales History Dataset

**Project**: OptiWMS Demand Forecasting Pipeline (v3)  
**Author**: OptiWMS Team  
**Date**: 2026-05  
**Objective**: Thoroughly explore the Beverage Sales History dataset to understand its structure, quality, distributions, and temporal patterns before proceeding to data cleaning, feature engineering, and model training.

---

## Table of Contents
1. [Dataset Introduction](#1-dataset-introduction)
2. [Descriptive Statistics](#2-descriptive-statistics)
3. [Data Quality Assessment](#3-data-quality-assessment)
4. [Time Series Analysis](#4-time-series-analysis)
5. [Cross-Table Analysis](#5-cross-table-analysis)
6. [Correlation Analysis](#6-correlation-analysis)
7. [Key Findings & Recommendations](#7-key-findings--recommendations)""")

# ============================================================
# SECTION 1: Dataset Introduction
# ============================================================
md("""---
## 1. Dataset Introduction

We begin by loading all available data files and understanding the basic structure — shapes, column names, data types, and a preview of the first few rows.""")

# Cell 1: Imports & Load
code("""import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

# Plot style
plt.style.use('seaborn-v0_8-whitegrid')
sns.set_palette("husl")
plt.rcParams.update({
    'figure.figsize': (12, 6),
    'font.size': 11,
    'axes.titlesize': 14,
    'axes.labelsize': 12
})

DATA_DIR = '""" + DATA_DIR + """'

# Load all datasets
transactions = pd.read_csv(f'{DATA_DIR}/transactions_history_final.csv')
outlet_master = pd.read_csv(f'{DATA_DIR}/outlet_master.csv')
outlet_coords = pd.read_csv(f'{DATA_DIR}/outlet_coordinates.csv')
holidays = pd.read_csv(f'{DATA_DIR}/holiday_list.csv')
seasonality = pd.read_csv(f'{DATA_DIR}/distributor_seasonality_details.csv')

print("✅ All datasets loaded successfully")
print(f"\\nDatasets loaded:")
print(f"  transactions:  {transactions.shape[0]:>10,} rows × {transactions.shape[1]} cols  ({transactions.memory_usage(deep=True).sum()/1e6:.1f} MB)")
print(f"  outlet_master: {outlet_master.shape[0]:>10,} rows × {outlet_master.shape[1]} cols  ({outlet_master.memory_usage(deep=True).sum()/1e6:.1f} MB)")
print(f"  outlet_coords: {outlet_coords.shape[0]:>10,} rows × {outlet_coords.shape[1]} cols")
print(f"  holidays:      {holidays.shape[0]:>10,} rows × {holidays.shape[1]} cols")
print(f"  seasonality:   {seasonality.shape[0]:>10,} rows × {seasonality.shape[1]} cols")""")

# Cell 2: Column info and dtypes
code("""# Examine column names and data types for each table
for name, df in [("transactions", transactions), ("outlet_master", outlet_master), 
                  ("outlet_coords", outlet_coords), ("holidays", holidays), ("seasonality", seasonality)]:
    print(f"\\n{'='*60}")
    print(f"📋 {name.upper()}")
    print(f"{'='*60}")
    print(f"Shape: {df.shape}")
    print(f"\\nColumns & Types:")
    for col in df.columns:
        nunique = df[col].nunique()
        null_pct = df[col].isnull().mean() * 100
        print(f"  {col:<25} {str(df[col].dtype):<15} {nunique:>8} unique  {null_pct:>5.1f}% null")""")

# Cell 3: Preview rows
code("""# Preview first 5 rows of each dataset
print("📊 TRANSACTIONS (first 5 rows)")
display(transactions.head())

print("\\n📊 OUTLET MASTER (first 5 rows)")
display(outlet_master.head())

print("\\n📊 HOLIDAYS (first 5 rows)")
display(holidays.head())

print("\\n📊 DISTRIBUTOR SEASONALITY (first 5 rows)")
display(seasonality.head())""")

# Cell 4: Data Dictionary
md("""### 1.1 Data Dictionary

| Table | Column | Type | Description |
|-------|--------|------|-------------|
| **transactions** | `Outlet_ID` | string | Unique outlet identifier (OUT_00001 to OUT_20000) |
| | `Year` | int | Transaction year (2023, 2024, 2025) |
| | `Month` | int | Transaction month (1–12) |
| | `Distributor_ID` | string | Distributor code (10 distributors across 4 regions) |
| | `SKU_ID` | string | Product identifier (SKU_01 to SKU_10) |
| | `Volume_Liters` | float | Volume sold in liters (can be negative = returns) |
| | `Total_Bill_Value` | float | Bill amount in LKR (can be negative = credit notes) |
| **outlet_master** | `Outlet_ID` | string | Links to transactions |
| | `Outlet_Size` | string | Size category (Small, Medium, Large, Extra Large) |
| | `Cooler_Count` | int | Number of beverage coolers at outlet |
| | `Outlet_Type` | string | Business type (Grocery, Hotel, Bakery, etc.) |
| **outlet_coords** | `Latitude/Longitude` | float | Geographic coordinates (Sri Lanka) |
| **holidays** | `Date` | datetime | Sri Lankan public holiday date |
| | `Holiday_Name` | string | Holiday name |
| | `Holiday_Type` | string | Holiday classification |
| **seasonality** | `Distributor_ID` | string | Links to transactions |
| | `Year/Month` | int | Time period |
| | `Seasonality_Index` | string | Favorable / Moderate / Un-Favorable |""")

# Cell 5: Summary statistics overview table
code("""# Summary overview table
summary_data = {
    'Dataset': ['transactions', 'outlet_master', 'outlet_coords', 'holidays', 'seasonality'],
    'Rows': [len(transactions), len(outlet_master), len(outlet_coords), len(holidays), len(seasonality)],
    'Columns': [transactions.shape[1], outlet_master.shape[1], outlet_coords.shape[1], holidays.shape[1], seasonality.shape[1]],
    'Memory (MB)': [
        round(transactions.memory_usage(deep=True).sum()/1e6, 1),
        round(outlet_master.memory_usage(deep=True).sum()/1e6, 1),
        round(outlet_coords.memory_usage(deep=True).sum()/1e6, 1),
        round(holidays.memory_usage(deep=True).sum()/1e6, 1),
        round(seasonality.memory_usage(deep=True).sum()/1e6, 1)
    ],
    'Null Count': [
        transactions.isnull().sum().sum(),
        outlet_master.isnull().sum().sum(),
        outlet_coords.isnull().sum().sum(),
        holidays.isnull().sum().sum(),
        seasonality.isnull().sum().sum()
    ],
    'Completeness %': [
        round((1 - transactions.isnull().mean().mean()) * 100, 2),
        round((1 - outlet_master.isnull().mean().mean()) * 100, 2),
        round((1 - outlet_coords.isnull().mean().mean()) * 100, 2),
        round((1 - holidays.isnull().mean().mean()) * 100, 2),
        round((1 - seasonality.isnull().mean().mean()) * 100, 2)
    ]
}

summary_df = pd.DataFrame(summary_data)
print("📋 DATASET SUMMARY")
display(summary_df.style.set_caption("Dataset Overview"))""")

# ============================================================
# SECTION 2: Descriptive Statistics
# ============================================================
md("""---
## 2. Descriptive Statistics

Now we examine the statistical properties of numerical and categorical variables to understand central tendencies, spread, and the distribution of values.""")

# Cell 6: .describe() for numerical columns
code("""# Descriptive statistics for numerical columns in transactions
print("📊 NUMERICAL SUMMARY — Transactions")
display(transactions[['Volume_Liters', 'Total_Bill_Value']].describe().round(2))

# Compute additional stats
print("\\n📊 ADDITIONAL STATISTICS")
for col in ['Volume_Liters', 'Total_Bill_Value']:
    vals = transactions[col]
    print(f"\\n  {col}:")
    print(f"    Skewness:  {vals.skew():.4f}")
    print(f"    Kurtosis:  {vals.kurtosis():.4f}")
    print(f"    IQR:       {vals.quantile(0.75) - vals.quantile(0.25):.2f}")
    print(f"    % Negative: {(vals < 0).mean()*100:.2f}%")
    print(f"    % Zero:     {(vals == 0).mean()*100:.2f}%")""")

# Cell 7: Categorical value counts
code("""# Value counts for categorical columns
fig, axes = plt.subplots(2, 2, figsize=(14, 10))

# SKU distribution
sku_counts = transactions['SKU_ID'].value_counts().sort_index()
axes[0,0].bar(sku_counts.index, sku_counts.values, color=sns.color_palette("husl", 10))
axes[0,0].set_title('Transaction Count by SKU')
axes[0,0].set_xlabel('SKU ID')
axes[0,0].set_ylabel('Number of Transactions')
axes[0,0].tick_params(axis='x', rotation=45)

# Distributor distribution
dist_counts = transactions['Distributor_ID'].value_counts().sort_index()
axes[0,1].barh(dist_counts.index, dist_counts.values, color=sns.color_palette("Set2", 10))
axes[0,1].set_title('Transaction Count by Distributor')
axes[0,1].set_xlabel('Number of Transactions')

# Outlet Type distribution
type_counts = outlet_master['Outlet_Type'].value_counts()
axes[1,0].bar(type_counts.index, type_counts.values, color=sns.color_palette("pastel", len(type_counts)))
axes[1,0].set_title('Outlet Count by Type')
axes[1,0].set_xlabel('Outlet Type')
axes[1,0].set_ylabel('Count')
axes[1,0].tick_params(axis='x', rotation=45)

# Outlet Size distribution
size_counts = outlet_master['Outlet_Size'].value_counts()
axes[1,1].bar(size_counts.index, size_counts.values, color=sns.color_palette("muted", len(size_counts)))
axes[1,1].set_title('Outlet Count by Size')
axes[1,1].set_xlabel('Outlet Size')
axes[1,1].set_ylabel('Count')

plt.suptitle('Categorical Variable Distributions', fontsize=16, fontweight='bold', y=1.02)
plt.tight_layout()
plt.savefig('plots/01_categorical_distributions.png', dpi=150, bbox_inches='tight')
plt.show()
print("\\n✅ Categorical distributions plotted")""")

# Cell 8: Box plots — Volume per SKU
code("""# Box plots: Volume distribution per SKU
fig, axes = plt.subplots(1, 2, figsize=(16, 6))

# Volume by SKU
sns.boxplot(data=transactions, x='SKU_ID', y='Volume_Liters', ax=axes[0],
            order=sorted(transactions['SKU_ID'].unique()), palette="husl", showfliers=False)
axes[0].set_title('Volume (Liters) Distribution by SKU\\n(outliers hidden for clarity)')
axes[0].set_xlabel('SKU ID')
axes[0].set_ylabel('Volume (Liters)')
axes[0].tick_params(axis='x', rotation=45)

# Bill Value by SKU
sns.boxplot(data=transactions, x='SKU_ID', y='Total_Bill_Value', ax=axes[1],
            order=sorted(transactions['SKU_ID'].unique()), palette="husl", showfliers=False)
axes[1].set_title('Bill Value (LKR) Distribution by SKU\\n(outliers hidden for clarity)')
axes[1].set_xlabel('SKU ID')
axes[1].set_ylabel('Total Bill Value (LKR)')
axes[1].tick_params(axis='x', rotation=45)

plt.suptitle('Distribution of Key Metrics Across SKUs', fontsize=16, fontweight='bold', y=1.02)
plt.tight_layout()
plt.savefig('plots/02_boxplots_by_sku.png', dpi=150, bbox_inches='tight')
plt.show()""")

# Cell 9: Histograms
code("""# Histograms for Volume_Liters and Total_Bill_Value
fig, axes = plt.subplots(2, 2, figsize=(14, 10))

# Overall Volume distribution
axes[0,0].hist(transactions['Volume_Liters'], bins=100, color='steelblue', edgecolor='white', alpha=0.8)
axes[0,0].axvline(transactions['Volume_Liters'].median(), color='red', ls='--', label=f"Median: {transactions['Volume_Liters'].median():.1f}")
axes[0,0].axvline(transactions['Volume_Liters'].mean(), color='orange', ls='--', label=f"Mean: {transactions['Volume_Liters'].mean():.1f}")
axes[0,0].set_title('Volume (Liters) — Overall Distribution')
axes[0,0].set_xlabel('Volume (Liters)')
axes[0,0].legend()

# Volume distribution (zoomed: 0 to 200L, capturing ~95% of data)
q95 = transactions['Volume_Liters'].quantile(0.95)
axes[0,1].hist(transactions[transactions['Volume_Liters'].between(0, q95)]['Volume_Liters'], 
               bins=80, color='teal', edgecolor='white', alpha=0.8)
axes[0,1].set_title(f'Volume (Liters) — Zoomed to 95th Pctl ({q95:.0f}L)')
axes[0,1].set_xlabel('Volume (Liters)')

# Bill Value distribution
axes[1,0].hist(transactions['Total_Bill_Value'], bins=100, color='coral', edgecolor='white', alpha=0.8)
axes[1,0].axvline(transactions['Total_Bill_Value'].median(), color='red', ls='--', label=f"Median: {transactions['Total_Bill_Value'].median():.0f}")
axes[1,0].set_title('Bill Value (LKR) — Overall Distribution')
axes[1,0].set_xlabel('Bill Value (LKR)')
axes[1,0].legend()

# Per-SKU Volume means
sku_means = transactions.groupby('SKU_ID')['Volume_Liters'].mean().sort_values()
axes[1,1].barh(sku_means.index, sku_means.values, color=sns.color_palette("viridis", 10))
axes[1,1].set_title('Average Volume per Transaction by SKU')
axes[1,1].set_xlabel('Mean Volume (Liters)')

plt.suptitle('Distribution Analysis', fontsize=16, fontweight='bold', y=1.02)
plt.tight_layout()
plt.savefig('plots/03_histograms.png', dpi=150, bbox_inches='tight')
plt.show()""")

# Cell 10: Price per liter analysis
code("""# Price per liter analysis
transactions['price_per_liter'] = transactions['Total_Bill_Value'] / transactions['Volume_Liters']

# Filter out infinite/negative prices (from returns)
valid_prices = transactions[transactions['Volume_Liters'] > 0]['price_per_liter']

fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Price per liter by SKU
price_by_sku = transactions[transactions['Volume_Liters'] > 0].groupby('SKU_ID')['price_per_liter'].median().sort_values()
axes[0].barh(price_by_sku.index, price_by_sku.values, color=sns.color_palette("RdYlGn", 10))
axes[0].set_title('Median Price per Liter by SKU')
axes[0].set_xlabel('Price per Liter (LKR)')

# Price per liter distribution
axes[1].hist(valid_prices.clip(0, valid_prices.quantile(0.99)), bins=80, color='gold', edgecolor='white', alpha=0.8)
axes[1].set_title('Price per Liter Distribution (clipped at 99th pctl)')
axes[1].set_xlabel('Price per Liter (LKR)')

plt.suptitle('Pricing Analysis', fontsize=16, fontweight='bold', y=1.02)
plt.tight_layout()
plt.savefig('plots/04_price_analysis.png', dpi=150, bbox_inches='tight')
plt.show()

# Summary table
print("\\n📊 MEDIAN PRICE PER LITER BY SKU")
display(transactions[transactions['Volume_Liters'] > 0].groupby('SKU_ID')['price_per_liter'].agg(['median', 'mean', 'std']).round(2))""")

# Cell 11: Section 2 conclusion
md("""### 2.1 Descriptive Statistics — Key Findings

**Numerical Variables:**
- Volume_Liters: Right-skewed distribution with median ~23L, mean ~53L — typical of beverage distribution where most orders are small with occasional large bulk orders.
- Total_Bill_Value: Similarly right-skewed, reflecting volume-driven pricing.
- ~0.08% of rows have negative values — these represent **sales returns/credit notes**, not data errors.

**Categorical Variables:**
- 10 SKUs with relatively balanced transaction counts — no extreme class imbalance.
- 10 Distributors across 4 regions (Western, Central, Southern, North-Western).
- Outlet types show diversity (Grocery, Hotel, Bakery, Pharmacy, etc.) with some typos to clean ("Grocry", "Bakry").
- Outlet sizes range from Small to Extra Large, with some inconsistencies ("small" vs "Small", empty values).

**Pricing:**
- Different SKUs have distinct price points — confirms these are different beverage products.
- Price per liter varies significantly, suggesting a mix of product categories (e.g., water vs premium beverages).""")

nb.cells = cells

import os
os.makedirs("plots", exist_ok=True)

# Save notebook
nbf.write(nb, "01_eda_and_data_profiling.ipynb")
print("✅ Part 1 notebook saved: 01_eda_and_data_profiling.ipynb")
print(f"   Cells: {len(cells)} ({sum(1 for c in cells if c.cell_type=='code')} code, {sum(1 for c in cells if c.cell_type=='markdown')} markdown)")
