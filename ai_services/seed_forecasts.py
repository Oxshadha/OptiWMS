import sqlite3
from datetime import datetime

# 1. Connect to the database file (SQLite will automatically create it if it doesn't exist)
db_path = "./forecast_service.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print(f"🔄 Initializing database table at: {db_path}")

# 2. Create the forecast table matching your gateway's expected schema
cursor.execute('''
    CREATE TABLE IF NOT EXISTS forecast_predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT NOT NULL,
        category TEXT,
        horizon INTEGER NOT NULL,
        period TEXT,
        p10 REAL,
        p50 REAL,
        p90 REAL,
        unit TEXT DEFAULT 'units',
        confidence_level REAL,
        run_id INTEGER,
        created_at TEXT
    )
''')

# 3. Define some high-fidelity mock warehouse SKUs and categories
mock_items = [
    ("SKU-300001", "Soap", 450),
    ("SKU-300002", "Detergent", 120),
    ("SKU-300003", "Shampoo", 280),
    ("SKU-300004", "Sanitizer", 600),
    ("SKU-300005", "Toothpaste", 310),
]

# 4. Generate forecast entries for horizons H+1 through H+6
run_id = 1
timestamp = datetime.utcnow().isoformat()
insert_count = 0

for sku, category, base_demand in mock_items:
    for horizon in [1, 2, 3, 4, 5, 6]:
        # Create a slight seasonal trend fluctuation for realism
        seasonal_modifier = 1.1 if horizon in [3, 6] else 0.95
        p50 = round(base_demand * seasonal_modifier)
        p10 = round(p50 * 0.85)  # Lower estimation bound
        p90 = round(p50 * 1.15)  # Upper estimation bound
        
        period = f"H+{horizon}"
        
        cursor.execute('''
            INSERT INTO forecast_predictions 
            (sku, category, horizon, period, p10, p50, p90, unit, confidence_level, run_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'units', 0.88, ?, ?)
        ''', (sku, category, horizon, period, p10, p50, p90, run_id, timestamp))
        insert_count += 1

# 5. Commit change logs and close active pipes
conn.commit()
conn.close()

print(f"✅ Seeding complete! Inserted {insert_count} mock rows across {len(mock_items)} SKUs.")
print("🚀 You can now re-run your Swagger GET endpoint or refresh the Next.js UI dashboard!")