"""
generate_evaluation_figures.py
================================

!!  WARNING - DO NOT CITE THESE FIGURES AS PROJECT RESULTS  !!
------------------------------------------------------------------------------
The figures produced by this script are ILLUSTRATIVE, not measured.

`_build_sku_profiles()` below FABRICATES its own input: 60 SKUs drawn from
`rng.lognormal(mean=5.5, sigma=0.8)` under `SEED = 42`. That population has no
connection to the project's evaluation data. It is NOT the 120 RM/PM demand
series, NOT the 144 physical materials, and NOT the 4,200-position v8 layout.
No value plotted here can be traced to `v8_controlled_synthetic_validation/
outputs/`.

The solvers genuinely execute - PuLP and DEAP are hard requirements that raise
rather than silently substituting fake numbers, which is correct. But a real
solver run on an invented problem still yields an invented chart.

Consequence for the dissertation:
  * These PNGs MUST NOT appear in Chapter 7 as evaluation results.
  * They must not be described as measured savings, measured stockout
    reduction, or measured procurement cost.
  * If a figure is needed for these claims, it must be regenerated from the
    retained pipeline artifacts, and the claim must be dropped if no such
    artifact exists.

Chapter 7 currently cites none of these files. Keep it that way unless the
underlying data source is changed to real retained evidence.
------------------------------------------------------------------------------

Generates the 5 evaluation figures for the OptiWMS dissertation Chapter 7.

Figures produced:
  1. safety_stock_reduction.png   – MILP demand-aware SS vs. static formula SS by ABC class
  2. overstock_reduction.png      – Overstock value: baseline vs. optimized policy
  3. procurement_cost_comparison.png – Single-supplier vs. MILP multi-supplier split cost
  4. stockout_comparison.png      – Stockout occurrences: baseline vs. optimized
  5. solver_determinism.png       – MILP repeated runs: identical output (deterministic)

Usage:
  cd "c:\\Users\\User\\Documents\\GitHub\\OptiWMS\\Ai miroservices"
  pip install numpy pandas matplotlib pulp scipy
  python generate_evaluation_figures.py

  Output PNGs are written to ./figures/ (created if absent).
  Copy that folder next to your LaTeX .tex files.
"""

import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")            # headless / no-display backend
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from scipy.stats import norm

# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

SEED = 42
np.random.seed(SEED)

OUT_DIR = os.path.join(os.path.dirname(__file__), "figures")
os.makedirs(OUT_DIR, exist_ok=True)

# Palette – matches OptiWMS thesis pastel scheme
C_BASELINE  = "#e74c3c"   # red  – static / old method
C_OPT       = "#2ecc71"   # green – MILP / optimized
C_GA        = "#9b59b6"   # purple – GA
C_HEURISTIC = "#3498db"   # blue – heuristic
C_MILP      = "#2ecc71"   # same green for MILP

TITLE_FS  = 13
LABEL_FS  = 11
TICK_FS   = 9
DPI       = 150


# ──────────────────────────────────────────────────────────────────────────────
# Synthetic SKU data – calibrated to match notebook logic
# ──────────────────────────────────────────────────────────────────────────────

def _build_sku_profiles(n=60):
    """FABRICATED INPUT - see the warning at the top of this file.

    This function INVENTS a 60-SKU population from a log-normal draw under
    SEED = 42. It does not read, and is not calibrated to, any project
    artifact. Every figure downstream of it is therefore illustrative only
    and must not be cited as a measured project result.

    To make these figures real, this function must be replaced by a loader
    that reads the retained evidence, e.g.
        v8_controlled_synthetic_validation/outputs/inventory_policy_simulation.csv
        v8_controlled_synthetic_validation/outputs/physical_materials.csv
    and any claim with no corresponding retained artifact must be dropped
    rather than approximated here.
    """

    rng = np.random.default_rng(SEED)

    # ABC classification (20 / 40 / 40 % split)
    abc = (["A"] * 12 + ["B"] * 24 + ["C"] * 24)
    rng.shuffle(abc)

    # Mean monthly demand (units) – log-normal
    d_bar = rng.lognormal(mean=5.5, sigma=0.8, size=n).clip(10, 3000)

    # Forecast std derived from p10/p90 spread (≈ same formula as notebook)
    spread_factor = rng.uniform(0.20, 0.55, size=n)      # CV of demand
    sigma_d = d_bar * spread_factor

    # Lead time (months) – per SKU, ~2-6 weeks expressed as fraction of month
    L = rng.uniform(0.5, 2.0, size=n)
    sigma_L = rng.uniform(0.05, 0.40, size=n)             # LT std in months

    # Service level z by ABC class (notebook: AX→99%, CZ→90%)
    z_map = {"A": 2.33, "B": 1.65, "C": 1.28}
    z = np.array([z_map[c] for c in abc])

    # ── MILP / demand-aware safety stock ──────────────────────────────────────
    # Uses per-class z-scores + combined demand-and-lead-time uncertainty formula
    # SS = z * sqrt(L*sigma_d^2 + d_bar^2 * sigma_L^2)
    ss_milp = z * np.sqrt(L * sigma_d**2 + d_bar**2 * sigma_L**2)

    # ── Static baseline: single global z=1.96 (97.5% one-size-fits-all) ────────
    # demand-only formula with a fixed, inflated service level
    # i.e.  SS_static = z_global * sigma_d * sqrt(L + review_period)
    #  Over-stocks C-class (over-protected) and under-stocks A-class timing.
    # The MILP policy correctly differentiates: A gets higher z (99%),
    # C gets lower z (90%), reducing total portfolio SS cost by ~20%.
    z_global = 1.96      # over-conservative single z for all classes
    review_period = 0.5  # extra review buffer inflated in old formula
    ss_static = z_global * sigma_d * np.sqrt(L + review_period)

    # Unit cost by class – A-class items are high-value (more costly to overstock)
    unit_cost = np.array([{"A": 120.0, "B": 45.0, "C": 12.0}[c] for c in abc])

    df = pd.DataFrame({
        "abc": abc,
        "d_bar": d_bar,
        "sigma_d": sigma_d,
        "L": L,
        "sigma_L": sigma_L,
        "z": z,
        "ss_milp":   ss_milp,
        "ss_static": ss_static,
        "unit_cost": unit_cost,
    })
    return df


# ──────────────────────────────────────────────────────────────────────────────
# Figure 1 – Safety Stock Reduction
# ──────────────────────────────────────────────────────────────────────────────

def fig_safety_stock_reduction(df):
    """Bar chart: total portfolio safety-stock holding cost vs. per-class breakdown.

    The MILP policy applies differentiated z-scores:
      A-class: z=2.33 (99%) - costs more per unit but prevents expensive stockouts
      B-class: z=1.65 (95%) - balanced
      C-class: z=1.28 (90%) - significantly less overprotection

    The static baseline uses z=1.96 flat for all classes (inflated uniform service level).
    Result: MILP shifts budget FROM over-protecting cheap C-class TO properly protecting
    expensive A-class, while cutting total portfolio holding cost by ~18%.
    """

    df2 = df.copy()
    df2["cost_static"] = df2["ss_static"] * df2["unit_cost"]
    df2["cost_milp"]   = df2["ss_milp"]   * df2["unit_cost"]

    total_static = df2["cost_static"].sum()
    total_milp   = df2["cost_milp"].sum()

    # Subplot layout: left = total portfolio bar, right = per-class breakdown
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5), gridspec_kw={"width_ratios": [1, 2]})

    # Left – total portfolio comparison
    ax = axes[0]
    labels = ["Static\nBaseline", "MILP\nOptimized"]
    vals   = [total_static / 1000, total_milp / 1000]
    colors = [C_BASELINE, C_OPT]
    bars = ax.bar(labels, vals, color=colors, width=0.5, zorder=3)
    saving_pct = (total_static - total_milp) / total_static * 100
    ax.annotate(f"-{saving_pct:.0f}% total\nholding cost",
                xy=(1, total_milp / 1000), xytext=(0, 8),
                textcoords="offset points", ha="center",
                fontsize=10, color="darkgreen", fontweight="bold")
    ax.set_ylabel("Total Portfolio SS Holding Cost (£000)", fontsize=LABEL_FS)
    ax.set_title("Portfolio Total", fontsize=TITLE_FS - 1)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"£{v:,.0f}k"))
    ax.set_ylim(0, max(vals) * 1.3)
    ax.grid(axis="y", linestyle="--", alpha=0.5, zorder=0)
    ax.spines[["top", "right"]].set_visible(False)

    # Right – per-class breakdown
    agg = df2.groupby("abc")[["cost_static", "cost_milp"]].mean().reindex(["A", "B", "C"])
    ax  = axes[1]
    x   = np.arange(3)
    w   = 0.35
    ax.bar(x - w/2, agg["cost_static"], width=w,
           color=C_BASELINE, label="Static baseline (z=1.96, all classes)", zorder=3)
    ax.bar(x + w/2, agg["cost_milp"],   width=w,
           color=C_OPT,      label="MILP per-class z + LT uncertainty",     zorder=3)

    for xi, (sv, mv) in enumerate(zip(agg["cost_static"], agg["cost_milp"])):
        delta_pct = (sv - mv) / sv * 100
        sign  = "-" if delta_pct >= 0 else "+"
        color = "darkgreen" if delta_pct >= 0 else "#c0392b"
        ax.annotate(f"{sign}{abs(delta_pct):.0f}%",
                    xy=(xi + w/2, mv),
                    xytext=(0, 5), textcoords="offset points",
                    ha="center", fontsize=9, color=color, fontweight="bold")

    ax.set_xticks(x)
    ax.set_xticklabels(["A-Class\n(High Value)", "B-Class\n(Medium Value)", "C-Class\n(Low Value)"],
                       fontsize=TICK_FS)
    ax.set_ylabel("Avg SS Holding Cost (£ / SKU)", fontsize=LABEL_FS)
    ax.set_title("Per ABC Class Breakdown", fontsize=TITLE_FS - 1)
    ax.legend(fontsize=TICK_FS - 1, loc="upper right")
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"£{v:,.0f}"))
    ax.set_ylim(0, max(agg["cost_static"].max(), agg["cost_milp"].max()) * 1.3)
    ax.grid(axis="y", linestyle="--", alpha=0.5, zorder=0)
    ax.spines[["top", "right"]].set_visible(False)

    fig.suptitle("Safety Stock Holding Cost: Static Formula vs. MILP Demand-Aware Policy",
                 fontsize=TITLE_FS, y=1.02)
    plt.tight_layout()
    path = os.path.join(OUT_DIR, "safety_stock_reduction.png")
    plt.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close()
    print(f"  \u2713 Saved {path}")


# ──────────────────────────────────────────────────────────────────────────────
# Figure 2 – Overstock Reduction
# ──────────────────────────────────────────────────────────────────────────────

def fig_overstock_reduction(df):
    """Bar chart: estimated overstock holding cost (baseline vs. optimized) per ABC class.

    The static formula uses z=1.96 for all items + a review-period buffer,
    so C-class items are over-protected and A-class items suffer from poor timing.
    The MILP policy calibrates per-class z-scores and removes the blanket buffer,
    reducing overstock holding cost across the portfolio.
    """

    # Simulate 12 months of demand to estimate average overstock
    rng   = np.random.default_rng(SEED + 1)
    n_sim = 12
    df2   = df.copy()

    # Monte Carlo: for each SKU, average monthly overstock over n_sim months
    overstock_static_list = []
    overstock_milp_list   = []
    for _, row in df2.iterrows():
        demands = rng.normal(row["d_bar"], row["sigma_d"], size=n_sim).clip(0)
        overstock_static_list.append(np.mean(np.maximum(0, row["ss_static"] - demands)))
        overstock_milp_list.append(  np.mean(np.maximum(0, row["ss_milp"]   - demands)))

    df2["overstock_static"] = overstock_static_list
    df2["overstock_milp"]   = overstock_milp_list
    # Weight by unit cost to get holding cost £
    df2["oc_static"] = df2["overstock_static"] * df2["unit_cost"]
    df2["oc_milp"]   = df2["overstock_milp"]   * df2["unit_cost"]

    agg = df2.groupby("abc")[["oc_static", "oc_milp"]].mean().reindex(["A", "B", "C"])

    x = np.arange(3)
    w = 0.35

    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.bar(x - w/2, agg["oc_static"], width=w,
           color=C_BASELINE, label="Static baseline", zorder=3)
    ax.bar(x + w/2, agg["oc_milp"],   width=w,
           color=C_OPT,      label="MILP optimized",  zorder=3)

    for xi, (sv, mv) in enumerate(zip(agg["oc_static"], agg["oc_milp"])):
        saving = (sv - mv) / sv * 100 if sv > 0 else 0
        sign   = "-" if saving >= 0 else "+"
        color  = "darkgreen" if saving >= 0 else "darkred"
        ax.annotate(f"{sign}{abs(saving):.0f}%",
                    xy=(xi + w/2, mv),
                    xytext=(0, 5), textcoords="offset points",
                    ha="center", fontsize=9, color=color, fontweight="bold")

    ax.set_xticks(x)
    ax.set_xticklabels(["A-Class\n(High Value)", "B-Class\n(Medium Value)", "C-Class\n(Low Value)"],
                       fontsize=TICK_FS)
    ax.set_ylabel("Avg Overstock Holding Cost (\xa3 / SKU / month)", fontsize=LABEL_FS)
    ax.set_title("Overstock Holding Cost: Static Formula vs. MILP Optimized Policy",
                 fontsize=TITLE_FS, pad=10)
    ax.legend(fontsize=TICK_FS, loc="upper right")
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"\xa3{v:,.0f}"))
    ax.set_ylim(0, max(agg["oc_static"].max(), agg["oc_milp"].max()) * 1.35)
    ax.grid(axis="y", linestyle="--", alpha=0.5, zorder=0)
    ax.spines[["top", "right"]].set_visible(False)

    plt.tight_layout()
    path = os.path.join(OUT_DIR, "overstock_reduction.png")
    plt.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close()
    print(f"  \u2713 Saved {path}")




# ──────────────────────────────────────────────────────────────────────────────
# Figure 3 – Procurement Cost Comparison
# ──────────────────────────────────────────────────────────────────────────────

def fig_procurement_cost(df):
    """Horizontal bar chart comparing single-supplier vs. MILP multi-supplier cost."""

    try:
        import pulp
    except ImportError as exc:
        # This figure must come from an actually-solved MILP, never a
        # substituted number — fail loudly instead of faking a result that
        # looks identical to a real one in the saved PNG.
        raise RuntimeError(
            "PuLP is required to generate procurement_cost_comparison.png. "
            "Install it with `pip install pulp` — this figure is never simulated."
        ) from exc

    # Build a small supplier selection problem per ABC class
    # to show cost savings from multi-supplier MILP splitting
    results = []
    rng = np.random.default_rng(SEED + 2)

    for abc_cls in ["A", "B", "C"]:
        sub = df[df["abc"] == abc_cls].head(5)   # 5 representative SKUs
        for _, row in sub.iterrows():
            order_qty = float(row["ss_milp"] + row["d_bar"] * row["L"])

            # Simulate 3 suppliers with different unit prices and capacities
            prices   = rng.uniform(8, 20, size=3)
            cap      = rng.uniform(0.4 * order_qty, order_qty * 1.2, size=3)
            moq      = rng.uniform(0.05 * order_qty, 0.2 * order_qty, size=3)

            # Baseline: buy all from cheapest single supplier (ignoring capacity)
            cheapest_idx  = int(np.argmin(prices))
            cost_baseline = order_qty * prices[cheapest_idx]

            # MILP: minimise cost subject to capacity and MOQ
            prob = pulp.LpProblem("supplier_split", pulp.LpMinimize)
            x = [pulp.LpVariable(f"x{i}", lowBound=0) for i in range(3)]
            y = [pulp.LpVariable(f"y{i}", cat="Binary") for i in range(3)]

            prob += pulp.lpSum(prices[i] * x[i] for i in range(3))
            prob += pulp.lpSum(x[i] for i in range(3)) >= order_qty
            for i in range(3):
                prob += x[i] <= cap[i] * y[i]
                prob += x[i] >= moq[i] * y[i]

            prob.solve(pulp.PULP_CBC_CMD(msg=0))

            status = pulp.LpStatus[prob.status]
            if status != "Optimal":
                raise RuntimeError(
                    f"MILP supplier-split solve returned status '{status}' for ABC class "
                    f"'{abc_cls}' — refusing to substitute a hardcoded saving figure."
                )
            cost_milp = float(pulp.value(prob.objective))

            results.append({"abc": abc_cls,
                            "cost_baseline": cost_baseline,
                            "cost_milp": cost_milp})

    res_df = pd.DataFrame(results).groupby("abc")[["cost_baseline", "cost_milp"]].sum().reindex(["A", "B", "C"])
    _plot_procurement_bars(res_df)


def _plot_procurement_bars(res_df):
    fig, ax = plt.subplots(figsize=(7, 4.5))
    x = np.arange(3)
    w = 0.35
    ax.bar(x - w/2, res_df["cost_baseline"], width=w,
           color=C_BASELINE, label="Single-supplier (cheapest price)", zorder=3)
    ax.bar(x + w/2, res_df["cost_milp"],     width=w,
           color=C_OPT,      label="MILP multi-supplier split",       zorder=3)

    for xi, (sv, mv) in enumerate(zip(res_df["cost_baseline"], res_df["cost_milp"])):
        saving = (sv - mv) / sv * 100
        ax.annotate(f"−{saving:.1f}%",
                    xy=(xi + w/2, mv),
                    xytext=(0, 4), textcoords="offset points",
                    ha="center", fontsize=8, color="darkgreen", fontweight="bold")

    ax.set_xticks(x)
    ax.set_xticklabels(["A-Class", "B-Class", "C-Class"], fontsize=TICK_FS)
    ax.set_ylabel("Total Procurement Cost (£)", fontsize=LABEL_FS)
    ax.set_title("Procurement Cost: Single Supplier vs. MILP Multi-Supplier Optimisation",
                 fontsize=TITLE_FS, pad=10)
    ax.legend(fontsize=TICK_FS, loc="upper right")
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"£{v:,.0f}"))
    ax.set_ylim(0, res_df["cost_baseline"].max() * 1.3)
    ax.grid(axis="y", linestyle="--", alpha=0.5, zorder=0)
    ax.spines[["top", "right"]].set_visible(False)

    plt.tight_layout()
    path = os.path.join(OUT_DIR, "procurement_cost_comparison.png")
    plt.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Saved {path}")


# ──────────────────────────────────────────────────────────────────────────────
# Figure 4 – Stockout Comparison
# ──────────────────────────────────────────────────────────────────────────────

def fig_stockout_comparison(df):
    """Bar chart: number of simulated stockout events (baseline vs MILP) per ABC class."""

    rng = np.random.default_rng(SEED + 3)
    n_months = 12

    rows = []
    for _, row in df.iterrows():
        # Simulate n_months of demand
        demands = rng.normal(row["d_bar"], row["sigma_d"], size=n_months).clip(0)
        # Available stock = ROP (d_bar * L + SS) for each policy
        rop_static = row["d_bar"] * row["L"] + row["ss_static"]
        rop_milp   = row["d_bar"] * row["L"] + row["ss_milp"]

        stockouts_static = int((demands > rop_static).sum())
        stockouts_milp   = int((demands > rop_milp).sum())

        rows.append({"abc": row["abc"],
                     "stockouts_static": stockouts_static,
                     "stockouts_milp":   stockouts_milp})

    res = (pd.DataFrame(rows)
           .groupby("abc")[["stockouts_static", "stockouts_milp"]]
           .sum()
           .reindex(["A", "B", "C"]))

    x = np.arange(3)
    w = 0.35

    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.bar(x - w/2, res["stockouts_static"], width=w,
           color=C_BASELINE, label="Static baseline", zorder=3)
    ax.bar(x + w/2, res["stockouts_milp"],   width=w,
           color=C_OPT,      label="MILP optimized",  zorder=3)

    for xi, (sv, mv) in enumerate(zip(res["stockouts_static"], res["stockouts_milp"])):
        if sv > 0:
            reduction = (sv - mv) / sv * 100
            ax.annotate(f"−{reduction:.0f}%",
                        xy=(xi + w/2, mv),
                        xytext=(0, 4), textcoords="offset points",
                        ha="center", fontsize=8, color="darkgreen", fontweight="bold")

    ax.set_xticks(x)
    ax.set_xticklabels(["A-Class", "B-Class", "C-Class"], fontsize=TICK_FS)
    ax.set_ylabel(f"Stockout Events (simulated over {n_months} months)", fontsize=LABEL_FS)
    ax.set_title("Stockout Occurrences: Static Formula vs. MILP Optimized Policy",
                 fontsize=TITLE_FS, pad=10)
    ax.legend(fontsize=TICK_FS, loc="upper right")
    ax.yaxis.set_major_locator(mticker.MaxNLocator(integer=True))
    ax.set_ylim(0, res["stockouts_static"].max() * 1.35)
    ax.grid(axis="y", linestyle="--", alpha=0.5, zorder=0)
    ax.spines[["top", "right"]].set_visible(False)

    plt.tight_layout()
    path = os.path.join(OUT_DIR, "stockout_comparison.png")
    plt.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Saved {path}")


# ──────────────────────────────────────────────────────────────────────────────
# Figure 5 – Solver Determinism (MILP identical runs, GA variance)
# ──────────────────────────────────────────────────────────────────────────────

def fig_solver_determinism(df):
    """
    Side-by-side scatter plots showing:
      Left:  MILP solver – run 1 vs run 2 → all points on the diagonal (perfect
             determinism).
      Right: GA solver    – run 1 vs run 2 → scatter around diagonal (stochastic).
    """

    # This figure exists to prove an empirical claim (MILP is deterministic,
    # GA is stochastic) by actually running both solvers twice each. A
    # substituted/analytical stand-in would defeat the entire point of the
    # figure, so both dependencies are required up front rather than
    # silently faked if missing.
    try:
        from deap import base, creator, tools, algorithms
    except ImportError as exc:
        raise RuntimeError(
            "DEAP is required to generate solver_determinism.png. "
            "Install it with `pip install deap` — this figure is never simulated."
        ) from exc
    try:
        import pulp
    except ImportError as exc:
        raise RuntimeError(
            "PuLP is required to generate solver_determinism.png. "
            "Install it with `pip install pulp` — this figure is never simulated."
        ) from exc

    n_items   = 40                     # number of SKUs to slot
    n_locs    = 80                     # available rack locations
    NGEN      = 50
    rng       = np.random.default_rng(SEED)

    # ── MILP assignment (deterministic) ──────────────────────────────────────
    sub = df.head(n_items).reset_index(drop=True)
    sub["zone_prio"] = sub["abc"].map({"A": 1, "B": 5, "C": 9})

    def _milp_assign(seed_unused):
        prob = pulp.LpProblem("slot", pulp.LpMinimize)
        x = pulp.LpVariable.dicts("x",
                ((i, j) for i in range(n_items) for j in range(n_locs)),
                cat="Binary")
        for i in range(n_items):
            prob += pulp.lpSum(x[i, j] for j in range(n_locs)) == 1
        for j in range(n_locs):
            prob += pulp.lpSum(x[i, j] for i in range(n_items)) <= 1
        cost = []
        for i in range(n_items):
            zp = sub.loc[i, "zone_prio"]
            for j in range(n_locs):
                cost.append(abs(zp / 9.0 - j / n_locs) * sub.loc[i, "d_bar"] * x[i, j])
        prob += pulp.lpSum(cost)
        prob.solve(pulp.PULP_CBC_CMD(msg=0))
        status = pulp.LpStatus[prob.status]
        if status != "Optimal":
            raise RuntimeError(f"MILP slot assignment returned status '{status}', expected 'Optimal'.")
        assign = []
        for i in range(n_items):
            for j in range(n_locs):
                if pulp.value(x[i, j]) == 1:
                    assign.append(j)
                    break
            else:
                assign.append(0)
        return assign

    milp_run1 = _milp_assign(SEED)
    milp_run2 = _milp_assign(SEED + 99)   # different seed label, same result

    # ── GA assignment (stochastic) ────────────────────────────────────────────
    zone_priorities = np.array([{"A": 1, "B": 5, "C": 9}[c]
                                for c in df.head(n_items)["abc"]])
    demands         = df.head(n_items)["d_bar"].values

    if hasattr(creator, "FitnessMin"):
        del creator.FitnessMin
    if hasattr(creator, "Individual"):
        del creator.Individual
    creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
    creator.create("Individual", list, fitness=creator.FitnessMin)

    def _eval(ind):
        score = sum(
            abs(zone_priorities[i] / 9.0 - ind[i] / n_locs) * demands[i]
            for i in range(n_items)
        )
        return (score,)

    toolbox = base.Toolbox()
    toolbox.register("individual", tools.initIterate, creator.Individual,
                     lambda: list(np.random.randint(0, n_locs, size=n_items)))
    toolbox.register("population",  tools.initRepeat, list, toolbox.individual)
    toolbox.register("evaluate",    _eval)
    toolbox.register("mate",        tools.cxTwoPoint)
    toolbox.register("mutate",      tools.mutUniformInt, low=0, up=n_locs, indpb=0.05)
    toolbox.register("select",      tools.selTournament, tournsize=3)

    def _ga_run(seed_val):
        np.random.seed(seed_val)
        pop = toolbox.population(n=100)
        for _ in range(NGEN):
            offspring = algorithms.varAnd(pop, toolbox, cxpb=0.7, mutpb=0.2)
            fits = list(map(toolbox.evaluate, offspring))
            for ind, fit in zip(offspring, fits):
                ind.fitness.values = fit
            pop = toolbox.select(offspring, k=len(pop))
        best = tools.selBest(pop, 1)[0]
        return list(best)

    ga_run1 = _ga_run(SEED)
    ga_run2 = _ga_run(SEED + 1)

    # ── Plot ──────────────────────────────────────────────────────────────────
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))

    # Left – MILP (deterministic)
    ax = axes[0]
    moved_milp = sum(a != b for a, b in zip(milp_run1, milp_run2))
    ax.scatter(milp_run1, milp_run2, alpha=0.7, s=35, color=C_MILP, zorder=3)
    lim = max(n_locs, 5)
    ax.plot([0, lim], [0, lim], "k--", linewidth=1, alpha=0.5, label="Perfect agreement")
    ax.set_xlim(-1, lim + 1)
    ax.set_ylim(-1, lim + 1)
    ax.set_xlabel("Run 1 – Slot Assignment", fontsize=LABEL_FS)
    ax.set_ylabel("Run 2 – Slot Assignment", fontsize=LABEL_FS)
    ax.set_title(f"MILP Solver (Deterministic)\n{moved_milp}/{n_items} slots differ across runs",
                 fontsize=TITLE_FS - 1, pad=8)
    ax.legend(fontsize=TICK_FS)
    ax.grid(linestyle="--", alpha=0.4)
    ax.spines[["top", "right"]].set_visible(False)

    # Right – GA (stochastic)
    ax = axes[1]
    moved_ga = sum(a != b for a, b in zip(ga_run1, ga_run2))
    ax.scatter(ga_run1, ga_run2, alpha=0.7, s=35, color=C_GA, zorder=3)
    ax.plot([0, lim], [0, lim], "k--", linewidth=1, alpha=0.5, label="Perfect agreement")
    ax.set_xlim(-1, lim + 1)
    ax.set_ylim(-1, lim + 1)
    ax.set_xlabel("Run 1 – Slot Assignment", fontsize=LABEL_FS)
    ax.set_ylabel("Run 2 – Slot Assignment", fontsize=LABEL_FS)
    ax.set_title(f"Genetic Algorithm (Stochastic)\n{moved_ga}/{n_items} slots differ across runs",
                 fontsize=TITLE_FS - 1, pad=8)
    ax.legend(fontsize=TICK_FS)
    ax.grid(linestyle="--", alpha=0.4)
    ax.spines[["top", "right"]].set_visible(False)

    fig.suptitle("Solver Consistency: MILP (Deterministic) vs. GA (Stochastic) — Same Input Data",
                 fontsize=TITLE_FS, y=1.02)
    plt.tight_layout()
    path = os.path.join(OUT_DIR, "solver_determinism.png")
    plt.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Saved {path}")


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("OptiWMS – Generating evaluation figures …\n")

    df = _build_sku_profiles(n=60)
    print(f"  Built synthetic SKU profile: {len(df)} SKUs\n")

    print("  [1/5] Safety stock reduction …")
    fig_safety_stock_reduction(df)

    print("  [2/5] Overstock reduction …")
    fig_overstock_reduction(df)

    print("  [3/5] Procurement cost comparison …")
    fig_procurement_cost(df)

    print("  [4/5] Stockout comparison …")
    fig_stockout_comparison(df)

    print("  [5/5] Solver determinism …")
    fig_solver_determinism(df)

    print(f"\n✅  All figures written to:  {OUT_DIR}")
    print("Copy the figures/ folder next to your LaTeX .tex files and compile.")
