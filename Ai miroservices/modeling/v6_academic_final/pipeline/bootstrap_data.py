"""Generate bootstrap FG monthly panel when Scenario C CSV is unavailable."""

from __future__ import annotations

import numpy as np
import pandas as pd

SEED = 42
N_SKUS = 103
N_MONTHS = 36
CATEGORIES = ["Personal Care", "Home Care", "Baby Care", "Oral Care", "Skin Care"]


def generate_bootstrap_fg_monthly(seed: int = SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    months = pd.period_range("2023-01", periods=N_MONTHS, freq="M").to_timestamp()
    rows: list[dict] = []

    for i in range(N_SKUS):
        fg_code = f"FG-{i + 1:04d}"
        category = CATEGORIES[i % len(CATEGORIES)]
        base = float(rng.integers(2_000, 80_000))
        trend = float(rng.uniform(-0.01, 0.02))
        for j, month in enumerate(months):
            seasonal = 1.0 + 0.15 * np.sin(2 * np.pi * (j + 1) / 12.0)
            promo = 1.0 + (0.25 if month.month in (4, 5, 12) and rng.random() < 0.35 else 0.0)
            noise = float(rng.normal(0, base * 0.08))
            demand = max(0.0, base * (1.0 + trend * j) * seasonal * promo + noise)
            rows.append(
                {
                    "fg_code": fg_code,
                    "fg_name": f"Product {i + 1}",
                    "fg_category": category,
                    "month": month,
                    "demand_units": round(demand),
                    "on_hand_inventory": round(demand * float(rng.uniform(1.2, 2.5))),
                    "lead_time_days": int(rng.integers(7, 21)),
                    "supplier_otif": round(float(rng.uniform(0.85, 0.99)), 3),
                    "promotion_flag": int(promo > 1.0),
                    "holiday_flag": int(month.month in (4, 5, 12)),
                    "price_per_unit": round(float(rng.uniform(80, 450)), 2),
                }
            )

    return pd.DataFrame(rows)
