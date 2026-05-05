import nbformat

path = '00_m5_eda_and_analysis.ipynb'
with open(path, 'r', encoding='utf-8') as f:
    nb = nbformat.read(f, as_version=4)

for cell in nb.cells:
    if cell.cell_type == 'code':
        if "monthly_total['month'].dt.to_timestamp()" in cell.source:
            cell.source = cell.source.replace("monthly_total['month'] = monthly_total['month'].dt.to_timestamp()", "monthly_total['month'] = pd.to_datetime(monthly_total['month'])")

with open(path, 'w', encoding='utf-8') as f:
    nbformat.write(nb, f)
print("Notebook fixed.")
