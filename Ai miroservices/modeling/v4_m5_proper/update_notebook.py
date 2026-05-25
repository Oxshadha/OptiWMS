import nbformat as nbf
import sys

nb_path = "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/v4_m5_proper/03_model_comparison_m5.ipynb"
with open(nb_path, "r", encoding="utf-8") as f:
    nb = nbf.read(f, as_version=4)

new_cell_source = """\
# --- MODEL GENERALIZATION: TRAIN vs VAL vs TEST ---
gen_results = []
for name, model in ml.items():
    if name == 'CatBoost':
        p_tr = np.clip(model.predict(X_tr), 0, None)
        p_va = np.clip(model.predict(X_va), 0, None)
        p_te = np.clip(model.predict(X_te), 0, None)
    elif name == 'Random Forest':
        p_tr = np.clip(model.predict(X_tr), 0, None)
        p_va = np.clip(model.predict(X_va), 0, None)
        p_te = np.clip(model.predict(X_te), 0, None)
    elif name == 'LightGBM':
        p_tr = np.clip(model.predict(X_tr), 0, None)
        p_va = np.clip(model.predict(X_va), 0, None)
        p_te = np.clip(model.predict(X_te), 0, None)
    else:
        p_tr = np.clip(model.predict(X_tr), 0, None)
        p_va = np.clip(model.predict(X_va), 0, None)
        p_te = np.clip(model.predict(X_te), 0, None)
        
    m_tr = metrics(y_tr, p_tr, y_tr)
    m_va = metrics(y_va, p_va, y_tr)
    m_te = metrics(y_te, p_te, y_tr)
    
    gen_results.append({
        'Model': name,
        'Train MAPE': m_tr['MAPE'],
        'Val MAPE': m_va['MAPE'],
        'Test MAPE': m_te['MAPE'],
        'Train WAPE': m_tr['WAPE'],
        'Val WAPE': m_va['WAPE'],
        'Test WAPE': m_te['WAPE']
    })

gen_df = pd.DataFrame(gen_results).set_index('Model')
display(gen_df)

fig, axes = plt.subplots(1, 2, figsize=(16, 5))
gen_df[['Train MAPE', 'Val MAPE', 'Test MAPE']].plot(kind='bar', ax=axes[0], color=['#2ecc71', '#f1c40f', '#e74c3c'])
axes[0].set_title('Generalization: MAPE by Split')
axes[0].set_ylabel('MAPE (%)')
axes[0].tick_params(axis='x', rotation=45)

gen_df[['Train WAPE', 'Val WAPE', 'Test WAPE']].plot(kind='bar', ax=axes[1], color=['#2ecc71', '#f1c40f', '#e74c3c'])
axes[1].set_title('Generalization: WAPE by Split')
axes[1].set_ylabel('WAPE')
axes[1].tick_params(axis='x', rotation=45)

plt.tight_layout()
plt.show()
"""

new_cell = nbf.v4.new_code_cell(new_cell_source)
nb.cells.append(new_cell)

with open(nb_path, "w", encoding="utf-8") as f:
    nbf.write(nb, f)

print("Appended generalization cell to notebook.")
