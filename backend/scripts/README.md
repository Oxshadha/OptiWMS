# Synthetic Data Generation for OptiWMS
## Sri Lankan Warehouse Context

This toolkit generates **24 months of realistic synthetic data** based on your actual CSV files, incorporating Sri Lankan market seasonality, festivals, monsoons, and economic patterns.

---

## 📋 Files Overview

| File | Purpose |
|------|---------|
| `srilanka_seasonality.py` | Sri Lankan seasonality patterns, festivals, monsoons |
| `synthetic_data_generator.py` | Main data generation script |
| `data_validator.py` | Data quality validation |
| `requirements.txt` | Python dependencies |

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend/scripts
pip install -r requirements.txt
```

### 2. Generate Synthetic Data

```bash
python synthetic_data_generator.py
```

This will:
- Load your CSV files from `frontend/Database Documents/`
- Generate 24 months of data (2023-2024)
- Save output to `backend/synthetic_data/`

### 3. Validate Generated Data

```bash
python data_validator.py
```

This validates:
- No negative values
- Seasonality patterns present
- Sri Lankan peaks (April, December)
- Data consistency

---

## 📊 Generated Output

### Files Created

| File | Records | Description |
|------|---------|-------------|
| `demand_history_2023_2024.csv` | ~7,500 | Monthly demand for 311 materials × 24 months |
| `stock_movements_2023_2024.csv` | ~50,000 | Receipts, issues, adjustments |
| `inventory_snapshots_2023_2024.csv` | ~7,500 | Monthly stock levels |
| `orders_history_2023_2024.csv` | ~15,000 | Purchase orders and sales orders |
| `generation_summary.json` | - | Statistics and summary |
| `validation_results.json` | - | Validation report |

---

## 🇱🇰 Sri Lankan Seasonality Features

### Festival Seasons (High Demand)

| Festival | Month | Impact | Description |
|----------|-------|--------|-------------|
| **Sinhala New Year** | April | +40% | Highest peak |
| **Vesak** | May | +15% | Religious festival |
| **Esala** | July | +10% | Cultural celebration |
| **Deepavali** | October | +15% | Festival season |
| **Christmas/New Year** | December | +30% | Year-end peak |

### Monsoon Impact

| Monsoon | Months | Products Affected |
|---------|--------|-------------------|
| **Southwest** | May-Sep | Personal care (+12%), Household (+15%) |
| **Northeast** | Dec-Feb | Slight logistics impact (-5%) |

### Economic Factors

| Year | Pattern | Impact |
|------|---------|--------|
| 2022 | Crisis period | -15% demand |
| 2023 | Recovery | -8% demand |
| 2024 | Growth | +5% demand |

---

## 📁 Data Structure

### Demand History

```csv
date,year,month,material_code,description,category,demand,seasonal_factor,is_non_moving
2023-01-01,2023,1,100036,CAUSTIC SODA,raw_materials,84250,0.95,False
2023-02-01,2023,2,100036,CAUSTIC SODA,raw_materials,78120,0.88,False
2023-03-01,2023,3,100036,CAUSTIC SODA,raw_materials,102050,1.15,False
2023-04-01,2023,4,100036,CAUSTIC SODA,raw_materials,124200,1.40,False
```

### Stock Movements

```csv
date,material_code,description,movement_type,quantity,reference_type,stock_after
2023-01-05,100036,CAUSTIC SODA,receipt,200000,purchase_order,200000
2023-01-15,100036,CAUSTIC SODA,issue,84250,sales_order,115750
2023-01-20,100036,CAUSTIC SODA,adjustment,250,cycle_count,116000
```

### Inventory Snapshots

```csv
date,year_month,material_code,description,stock_level,warehouse_id,location_code
2023-01-31,2023-01,100036,CAUSTIC SODA,116000,WH-001,ST-WH001-01-001-1-A
2023-02-28,2023-02,100036,CAUSTIC SODA,145000,WH-001,ST-WH001-01-001-1-A
```

### Orders History

```csv
order_id,order_type,order_date,material_code,description,quantity,status,supplier_id
PO-2023-00001,inbound,2023-01-05,100036,CAUSTIC SODA,200000,completed,SUP-036
SO-2023-00002,outbound,2023-01-15,100036,CAUSTIC SODA,84250,completed,CUST-012
```

---

## 🎯 Categories

Materials are automatically categorized:

| Category | Keywords | Growth Rate |
|----------|----------|-------------|
| `personal_care` | soap, cologne, shampoo, oil | 2.5% |
| `baby_care` | napkin, diaper, nappy, baby | 3.5% |
| `household` | detergent, cleaner, washing | 2.0% |
| `cosmetics` | talcum, powder, perfume | 3.0% |
| `packaging` | pouch, sheet, woven, paper | 2.8% |
| `raw_materials` | (default) | 2.2% |

---

## 🔧 Customization

### Change Date Range

Edit `synthetic_data_generator.py`:

```python
# Line 219
start_date = datetime(2023, 1, 1)  # Change start date
months = 24  # Change number of months
```

### Adjust Seasonality

Edit `srilanka_seasonality.py`:

```python
# Modify multipliers
SRI_LANKAN_BASE_SEASONALITY = {
    1: 0.95,   # January
    4: 1.50,   # April (increase for higher peak)
    12: 1.40,  # December
}
```

### Change Growth Rates

Edit `srilanka_seasonality.py`:

```python
CATEGORY_SEASONALITY = {
    'personal_care': {
        'growth_rate': 0.030,  # Change from 2.5% to 3.0%
    }
}
```

---

## ✅ Validation Checks

The validator checks:

1. **No negative values** — Demand, stock, quantities
2. **Seasonality present** — April and December peaks
3. **Date range correct** — 24 months of data
4. **All materials included** — 311 materials present
5. **Categories assigned** — All materials categorized
6. **Movement types valid** — Receipt, issue, adjustment
7. **Stock levels reasonable** — No extreme values
8. **Growth trend present** — Positive growth over time

---

## 🔍 Troubleshooting

### Error: "No module named 'pandas'"

```bash
pip install pandas numpy
```

### Error: "Cannot find CSV files"

Check that your CSV files are in:
```
frontend/Database Documents/
  - Item code and descriptions.csv
  - Active stock.csv
  - Non Moving items.csv
  - Raw matrilas not store in pallets.csv
```

### Warning: "April is not a peak month"

This means seasonality might need adjustment. Check `srilanka_seasonality.py` and ensure April has a high multiplier (1.40).

### Error: "Negative stock levels"

This indicates the ROP logic needs tuning. Adjust buffer days or MOQ in the generator.

---

## 📈 Next Steps

### 1. Import to Database

After generation, import the CSV files to your PostgreSQL database:

```bash
# Using your import API
curl -X POST http://localhost:8080/api/integration/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@../synthetic_data/demand_history_2023_2024.csv"
```

### 2. Train AI Models

Use the generated data to train:
- Demand forecasting models
- Inventory optimization algorithms
- Anomaly detection systems
- Optimal storage (genetic algorithms)

### 3. Validate with Real Data

As you collect real operational data:
- Compare with synthetic patterns
- Retrain models with real data
- Fine-tune seasonality parameters

---

## 📚 References

- [HENAS Pallet Project](../../../Resources/Pallet Project.pdf)
- [Standard Stock Requirement Model](../../../Resources/Training Report (2).pdf)
- Sri Lankan festival calendar
- FMCG industry patterns in Sri Lanka

---

## 🤝 Support

For questions or issues:
1. Check the validation report: `validation_results.json`
2. Review generation summary: `generation_summary.json`
3. Consult the seasonality patterns: `srilanka_seasonality.py`

---

## 📄 License

Part of OptiWMS - Warehouse Management System
