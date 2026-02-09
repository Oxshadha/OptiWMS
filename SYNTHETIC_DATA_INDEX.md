# 📚 Synthetic Data - Navigation Index

## 🎯 Start Here

### For Quick Start (5 minutes)
👉 **[QUICK_START_SYNTHETIC_DATA.md](QUICK_START_SYNTHETIC_DATA.md)**
- 3-step quick start
- View data samples
- Import to database
- Train first model

### For Comprehensive Guide (30 minutes)
👉 **[SYNTHETIC_DATA_GUIDE.md](SYNTHETIC_DATA_GUIDE.md)**
- Complete data structure
- AI model training examples
- Database schemas
- Use cases and best practices

### For Summary & Status
👉 **[SYNTHETIC_DATA_COMPLETE.md](SYNTHETIC_DATA_COMPLETE.md)**
- What was created
- Validation results
- AI readiness assessment
- Next steps

---

## 📁 File Locations

### Generated Data (Ready to Use)
```
backend/synthetic_data/
├── demand_history_2023_2024.csv       → 7,416 records
├── stock_movements_2023_2024.csv      → 7,470 records
├── inventory_snapshots_2023_2024.csv  → 6,511 records
├── orders_history_2023_2024.csv       → 5,936 records
├── generation_summary.json            → Statistics
└── validation_results.json            → Quality report
```

### Scripts (Regenerate Data)
```
backend/scripts/
├── generate_data.sh                   → 🚀 One-click run
├── synthetic_data_generator.py        → Main generator
├── srilanka_seasonality.py            → Seasonality patterns
├── data_validator.py                  → Validator
└── README.md                          → Script docs
```

---

## 🔍 Quick Reference

### Command to Regenerate Data
```bash
cd /Users/k.e.oshada/Documents/OptiWMS/backend/scripts
./generate_data.sh
```

### Command to Validate Data
```bash
cd /Users/k.e.oshada/Documents/OptiWMS/backend/scripts
python3 data_validator.py ../synthetic_data
```

### View Sample Data
```bash
cd /Users/k.e.oshada/Documents/OptiWMS/backend/synthetic_data
head -20 demand_history_2023_2024.csv
cat generation_summary.json
```

---

## 📊 What You Have

| Metric | Value |
|--------|-------|
| **Time Period** | Jan 2023 - Dec 2024 (24 months) |
| **Materials** | 309 products |
| **Demand Records** | 7,416 |
| **Stock Movements** | 7,470 |
| **Orders** | 5,936 |
| **File Size** | ~2.1 MB total |
| **Validation** | ✅ ALL CHECKS PASSED |

---

## 🎯 AI Training Status

| AI Service | Status | Data Available |
|------------|--------|----------------|
| Demand Forecasting | ✅ READY | 24 months × 309 materials |
| Inventory Min/Max | ✅ READY | Stock levels + movements |
| Anomaly Detection | ✅ READY | 7,470 transactions |
| Optimal Storage (GA) | ⚠️ PARTIAL | Needs dimensions |
| Picking Paths | ⚠️ PARTIAL | Needs multi-item orders |

---

## 🇱🇰 Sri Lankan Features

✅ Sinhala New Year (April) - 1.40x peak  
✅ Vesak (May) - 1.15x increase  
✅ Deepavali (October) - 1.15x increase  
✅ Christmas (December) - 1.32x peak  
✅ Monsoon patterns (Southwest & Northeast)  
✅ Economic recovery (2023-2024)  

---

## 🆘 Need Help?

| Question | Answer |
|----------|--------|
| How to view data? | `head -20 backend/synthetic_data/*.csv` |
| How to regenerate? | `cd backend/scripts && ./generate_data.sh` |
| How to import? | See **SYNTHETIC_DATA_GUIDE.md** Step 2 |
| How to train AI? | See **QUICK_START_SYNTHETIC_DATA.md** Step 3 |
| Data quality? | `cat backend/synthetic_data/validation_results.json` |
| Statistics? | `cat backend/synthetic_data/generation_summary.json` |

---

## 📖 Documentation Map

```
OptiWMS/
├── SYNTHETIC_DATA_INDEX.md           ← YOU ARE HERE (navigation)
├── QUICK_START_SYNTHETIC_DATA.md     ← Quick start (5 min)
├── SYNTHETIC_DATA_GUIDE.md           ← Comprehensive guide (30 min)
├── SYNTHETIC_DATA_COMPLETE.md        ← Summary & status
│
├── backend/
│   ├── scripts/
│   │   ├── README.md                 ← Script documentation
│   │   ├── generate_data.sh          ← Run this to regenerate
│   │   ├── synthetic_data_generator.py
│   │   ├── srilanka_seasonality.py
│   │   ├── data_validator.py
│   │   └── requirements.txt
│   │
│   └── synthetic_data/
│       ├── demand_history_2023_2024.csv       ← 📊 Use this for forecasting
│       ├── stock_movements_2023_2024.csv      ← 📦 Use this for anomaly detection
│       ├── inventory_snapshots_2023_2024.csv  ← 📸 Use this for optimization
│       ├── orders_history_2023_2024.csv       ← 📋 Use this for supplier analysis
│       ├── generation_summary.json
│       └── validation_results.json
```

---

## ⚡ Quick Actions

### I want to...

**...see what was generated**
```bash
cat backend/synthetic_data/generation_summary.json
```

**...verify data quality**
```bash
cat backend/synthetic_data/validation_results.json
```

**...view sample data**
```bash
head -20 backend/synthetic_data/demand_history_2023_2024.csv
```

**...regenerate with 36 months**
```bash
cd backend/scripts
./generate_data.sh --months 36 --output ../synthetic_data_36m
```

**...import to database**
→ See **SYNTHETIC_DATA_GUIDE.md** - Step 2 (detailed SQL)

**...train an AI model**
→ See **QUICK_START_SYNTHETIC_DATA.md** - Step 3 (Python example)

---

## 🎉 Success Criteria

- [x] ✅ 24 months of data generated
- [x] ✅ 309 materials included
- [x] ✅ Sri Lankan seasonality applied
- [x] ✅ All validation checks passed
- [x] ✅ Documentation complete
- [ ] ⬜ Data imported to database (your next step)
- [ ] ⬜ First AI model trained

---

## 📞 Support

| Issue | Solution |
|-------|----------|
| Script errors | Check `backend/scripts/README.md` |
| Data quality issues | Run `python3 data_validator.py` |
| Import problems | See SQL schemas in `SYNTHETIC_DATA_GUIDE.md` |
| AI training help | See examples in `QUICK_START_SYNTHETIC_DATA.md` |

---

**Generated:** January 9, 2026  
**Status:** ✅ COMPLETE & READY TO USE  

**🚀 Recommended First Step:** Read [QUICK_START_SYNTHETIC_DATA.md](QUICK_START_SYNTHETIC_DATA.md)
