# Real Data Import Guide (Materials + Inventory Planning)

This guide imports real data from:

`/Users/k.e.oshada/Documents/OptiWMS/Resources/Data and Sloting plan/RM ROP and Pallet requirement  4- SEP.xlsx`

## 1) Generate import CSV files

```bash
cd "/Users/k.e.oshada/Documents/OptiWMS/Resources/Data and Sloting plan"
python3 convert_slotting_xlsx.py
```

Outputs:

- `materials_import.csv`
- `inventory_planning_import.csv`

## 2) Import product catalog (materials)

Use the existing endpoint:

- `POST /api/master/materials/import` (multipart file `file`)

Upload `materials_import.csv`.

## 3) Import inventory planning fields

Use the existing endpoint:

- `POST /api/master/materials/inventory/import` (multipart file `file`)

Upload `inventory_planning_import.csv`.

## Notes

- This process updates:
  - materials master (`material_code`, `description`, type/unit/storage mapping)
  - inventory planning values (`ROP`, `buffer`, `lead time`, `MOQ`, etc.)
- Source workbook does not provide reliable bin-level on-hand stock per location.
  - `quantity` is left empty by default in generated planning CSV.
  - If you have a trusted physical stock file, import that separately.
