import nbformat as nbf

nb_path = "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/v4_m5_proper/03_model_comparison_m5.ipynb"
with open(nb_path, "r", encoding="utf-8") as f:
    nb = nbf.read(f, as_version=4)

new_markdown_source = """\
## Champion Selection Reasoning
**Decision: Deploy Random Forest**
While LightGBM technically achieved a slightly better WAPE (0.0699 vs 0.0717), **Random Forest** has been explicitly selected as the production champion due to critical supply chain priorities:
1. **Lowest RMSE (1888.0)**: Random Forest minimizes massive error spikes. In a warehouse, one massive prediction spike can lead to a catastrophic stockout or huge overstock, making RMSE the most critical safety metric.
2. **Lower Bias (49.9 vs 82.2)**: LightGBM has a strong tendency to over-forecast/under-forecast compared to Random Forest.
"""

# Insert the markdown cell before the deploy cell, and update the deploy cell
for i, cell in enumerate(nb.cells):
    if cell.cell_type == "code" and "deploy = best_ml" in cell.source:
        # Update the code cell
        cell.source = cell.source.replace("deploy = best_ml", "deploy = 'Random Forest'")
        # Insert markdown before it
        md_cell = nbf.v4.new_markdown_cell(new_markdown_source)
        nb.cells.insert(i, md_cell)
        break

with open(nb_path, "w", encoding="utf-8") as f:
    nbf.write(nb, f)

print("✅ Updated notebook to select Random Forest and added reasoning.")
