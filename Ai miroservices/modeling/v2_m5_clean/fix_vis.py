import nbformat

path = '00_m5_eda_and_analysis.ipynb'
with open(path, 'r', encoding='utf-8') as f:
    nb = nbformat.read(f, as_version=4)

for cell in nb.cells:
    if cell.cell_type == 'code':
        if "store_demand = df.groupby('store_id')['demand'].sum().sort_values(ascending=False)" in cell.source:
            cell.source = """fig, axes = plt.subplots(1, 2, figsize=(16, 6))

# Demand by Series (Top 10)
series_demand = df.groupby('series_id')['demand'].sum().sort_values(ascending=False).head(10)
sns.barplot(x=series_demand.values, y=series_demand.index, ax=axes[0], palette="viridis")
axes[0].set_title('Total Demand by Series (Top 10)')

# Demand by Category
cat_demand = df.groupby('category')['demand'].sum().sort_values(ascending=False)
sns.barplot(x=cat_demand.values, y=cat_demand.index, ax=axes[1], palette="magma")
axes[1].set_title('Total Demand by Category')

plt.tight_layout()
plt.show()"""
        
        elif "cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()" in cell.source:
            cell.source = """# Separate numerical and categorical columns
num_cols = df.select_dtypes(include=['int64', 'float64', 'int32', 'float32']).columns.tolist()
cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()

# 'month' is datetime, let's remove it from num/cat if it accidentally falls in
if 'month' in num_cols: num_cols.remove('month')
if 'month' in cat_cols: cat_cols.remove('month')

print(f"Numerical Columns ({len(num_cols)}): {num_cols}")
print(f"\\nCategorical Columns ({len(cat_cols)}): {cat_cols}")"""

with open(path, 'w', encoding='utf-8') as f:
    nbformat.write(nb, f)
print("Notebook visualization fixed.")
