# 🚀 Quick Start: Synthetic Data for OptiWMS

## ✅ What You Have

**24 months of realistic Sri Lankan warehouse data** has been generated and validated!

---

## 📊 At a Glance

| Metric | Value |
|--------|-------|
| 📅 **Time Period** | Jan 2023 - Dec 2024 (24 months) |
| 📦 **Materials** | 309 products (your actual portfolio) |
| 📈 **Demand Records** | 7,416 (monthly per material) |
| 🔄 **Stock Movements** | 7,470 (receipts, issues, adjustments) |
| 📋 **Orders** | 5,936 (purchase & sales) |
| 🇱🇰 **Sri Lankan Seasonality** | ✅ Festivals, monsoons, economics |
| ✅ **Validation Status** | ALL CHECKS PASSED |
| 🤖 **AI Training Ready** | 3/5 services (forecasting, inventory, anomaly) |

---

## 🗂️ Your Files

### Generated Data (Ready to Use)
```
backend/synthetic_data/
├── demand_history_2023_2024.csv       (605 KB, 7,416 records)
├── stock_movements_2023_2024.csv      (494 KB, 7,470 records)
├── inventory_snapshots_2023_2024.csv  (513 KB, 6,511 records)
├── orders_history_2023_2024.csv       (506 KB, 5,936 records)
├── generation_summary.json            (Statistics)
└── validation_results.json            (Quality report)
```

### Scripts (Reusable)
```
backend/scripts/
├── generate_data.sh                   (One-click regeneration)
├── synthetic_data_generator.py        (Main generator)
├── srilanka_seasonality.py            (Seasonality patterns)
├── data_validator.py                  (Quality checker)
└── README.md                          (Script documentation)
```

### Documentation
```
OptiWMS/
├── SYNTHETIC_DATA_GUIDE.md            (🔑 COMPREHENSIVE GUIDE - START HERE!)
├── SYNTHETIC_DATA_COMPLETE.md         (Completion summary)
└── QUICK_START_SYNTHETIC_DATA.md      (This file)
```

---

## 🎯 3 Steps to Start Using

### Step 1: View Sample Data (1 minute)

```bash
cd /Users/k.e.oshada/Documents/OptiWMS/backend/synthetic_data

# View demand history
head -20 demand_history_2023_2024.csv

# View generation stats
cat generation_summary.json

# View validation results
cat validation_results.json
```

**Expected Output:**
- ✅ Demand with seasonality (April peaks at 1.40x)
- ✅ Categories assigned (personal_care, baby_care, etc.)
- ✅ All validation checks passed

---

### Step 2: Import to Database (5 minutes)

#### Option A: Using psql (Recommended)

```bash
# 1. Start PostgreSQL (if not running)
cd /Users/k.e.oshada/Documents/OptiWMS/infra
docker-compose up -d db

# 2. Create tables (run once)
psql -h localhost -p 5434 -U postgres -d optiwms_db << 'EOF'
CREATE TABLE IF NOT EXISTS demand_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    material_code VARCHAR(50) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    demand INTEGER NOT NULL,
    seasonal_factor DECIMAL(10, 4),
    is_non_moving BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_demand_material_date ON demand_history(material_code, date);
CREATE INDEX idx_demand_category ON demand_history(category);
EOF

# 3. Import CSV
cd /Users/k.e.oshada/Documents/OptiWMS/backend/synthetic_data
psql -h localhost -p 5434 -U postgres -d optiwms_db -c "\COPY demand_history(date, year, month, material_code, description, category, demand, seasonal_factor, is_non_moving) FROM 'demand_history_2023_2024.csv' CSV HEADER;"
```

**Password:** `postgres`

#### Option B: Using pgAdmin (Visual)

1. Open pgAdmin: http://localhost:5050
2. Login: `admin@optiwms.com` / `admin123`
3. Connect to `optiwms_db`
4. Right-click table → Import/Export
5. Select CSV file
6. Map columns
7. Import

---

### Step 3: Train Your First AI Model (10 minutes)

#### Example: Demand Forecasting with Python

```python
import pandas as pd
from prophet import Prophet
import matplotlib.pyplot as plt

# 1. Load demand data
demand_df = pd.read_csv('backend/synthetic_data/demand_history_2023_2024.csv')

# 2. Select a high-volume material
material_code = '100036'  # CAUSTIC SODA
material_demand = demand_df[demand_df['material_code'] == material_code].copy()

# 3. Prepare for Prophet
material_demand['date'] = pd.to_datetime(material_demand['date'])
prophet_df = material_demand[['date', 'demand']].rename(
    columns={'date': 'ds', 'demand': 'y'}
)

# 4. Train model
model = Prophet(yearly_seasonality=True)
model.fit(prophet_df)

# 5. Forecast next 6 months
future = model.make_future_dataframe(periods=6, freq='M')
forecast = model.predict(future)

# 6. View results
print("Forecast for next 6 months:")
print(forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(6))

# 7. Plot
model.plot(forecast)
plt.title(f'Demand Forecast: {material_code}')
plt.show()
```

**Install Prophet:**
```bash
pip install prophet matplotlib
```

---

## 🇱🇰 Sri Lankan Seasonality Verified

Your data includes realistic patterns:

| Feature | Status | Evidence |
|---------|--------|----------|
| **April Peak** (Sinhala NY) | ✅ | 1.40x multiplier confirmed |
| **December Peak** (Christmas) | ✅ | 1.32x multiplier confirmed |
| **February Low** | ✅ | 0.88x multiplier confirmed |
| **Monsoon Impact** | ✅ | May-Sep higher for personal care |
| **Economic Recovery** | ✅ | 2023-2024 growth trend included |

---

## 📈 What Can You Do Now?

### Immediate (Today)

✅ **View the data** - Verify it looks realistic  
✅ **Import to database** - Make it queryable  
✅ **Train first model** - Demand forecasting  

### This Week

✅ **Train inventory optimizer** - Calculate min/max levels  
✅ **Setup anomaly detection** - Identify unusual patterns  
✅ **Create dashboards** - Visualize trends  

### Next 2-4 Weeks

✅ **Enhance for GA** - Add material dimensions  
✅ **Generate multi-item orders** - For picking path optimization  
✅ **Start collecting real data** - Compare with synthetic  

---

## 🆘 Common Questions

### Q: How do I regenerate with different parameters?

```bash
cd /Users/k.e.oshada/Documents/OptiWMS/backend/scripts

# Generate 36 months instead of 24
./generate_data.sh --months 36 --output ../synthetic_data_36m
```

### Q: How do I verify data quality?

```bash
cd /Users/k.e.oshada/Documents/OptiWMS/backend/scripts
python3 data_validator.py ../synthetic_data
```

All checks should pass ✅

### Q: Is this data realistic?

**Yes!** It's based on:
- ✅ Your actual product portfolio (309 materials)
- ✅ Your CSV supply plans (Jul-Nov 2018-2019)
- ✅ Sri Lankan market patterns (festivals, monsoons)
- ✅ Industry-standard variance and growth rates

### Q: Can I use this for production?

**For AI training:** ✅ YES (initial models)  
**For live operations:** ❌ NO (use real data)  

**Recommended:** Use synthetic for training, then switch to real data after 3-6 months of collection.

### Q: What if I need help?

📖 **See:** `SYNTHETIC_DATA_GUIDE.md` (comprehensive 15-page guide)  
📖 **See:** `backend/scripts/README.md` (script documentation)  

---

## 🎉 Success Checklist

- [x] ✅ Data generated (7,416 demand records)
- [x] ✅ Data validated (all checks passed)
- [x] ✅ Sri Lankan seasonality applied
- [x] ✅ Documentation created
- [ ] ⬜ Import to database (your next step)
- [ ] ⬜ Train first AI model (demand forecasting)
- [ ] ⬜ View in pgAdmin
- [ ] ⬜ Start collecting real data

---

## 🔗 Key Files to Read

1. **START HERE:** `SYNTHETIC_DATA_GUIDE.md` (comprehensive guide)
2. **Data location:** `backend/synthetic_data/*.csv`
3. **Statistics:** `backend/synthetic_data/generation_summary.json`
4. **Scripts:** `backend/scripts/generate_data.sh`

---

## 💡 Pro Tips

1. **Start with top 10 materials** by volume for initial model training
2. **Use category-level models** (e.g., all "personal_care" together)
3. **Compare synthetic vs real** after 3 months of real data collection
4. **Retrain models quarterly** as real data accumulates
5. **Keep synthetic data** for regression testing and volume testing

---

**Generated:** January 9, 2026  
**Status:** ✅ READY TO USE  
**Next Step:** Import to database and train your first model!

For detailed instructions, see **`SYNTHETIC_DATA_GUIDE.md`** 📖
