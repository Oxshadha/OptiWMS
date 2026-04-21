# Data Realism Augmentation Plan (FG + RM, Sri Lanka Context)

## 1) Objective

Build a realistic forecasting dataset for enterprise use, not synthetic noise.

Required outcomes:

- Preserve real structure from your source (`Active stock` sheet).
- Add statistically valid variability and seasonality.
- Capture finished-good (FG) demand and raw-material (RM) demand with lead-lag linkage.
- Keep full reproducibility and auditability.

---

## 2) Data Sources To Use

### 2.1 Internal available sources (primary)

- Real source workbook:
  - `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/Forecast model train data optiwms/RM ROP and Pallet requirement  4- SEP.xlsx`
- Internal extracted/cleaned outputs:
  - `Ai miroservices/modeling/outputs/real_source/active_stock_summary.json`
  - `Ai miroservices/modeling/outputs/cleaned/*`
- Existing synthetic tracks:
  - Dataset `P` (portable)
  - Dataset `W` (WMS-style)

### 2.2 External context data (optional but recommended)

- Calendar and holiday/event flags relevant to Sri Lanka.
- Import/procurement friction proxies (lead-time shocks, supplier reliability regime).
- Commodity/packaging proxy indices for RM pressure scenarios.

Rule:
- External data must be versioned with source URL/date and transformation log.

---

## 3) Core Modeling Assumptions To Add

### 3.1 FG demand realism

- Multi-regime behavior:
  - base demand regime
  - promo-driven uplift regime
  - stockout-suppressed observed demand regime
- Seasonality:
  - annual + month-end/weekly operational effects (if cadence supports)
- Category heterogeneity:
  - soap vs facewash vs slower lines must have different volatility, promo response, and intermittency.

### 3.2 RM demand realism (derived, not random)

RM demand must be generated from FG demand through a BOM + process model:

- `RM_required_t = sum(FG_forecast_(t+L_fg_rm) * BOM_coeff * yield_factor)`
- include:
  - procurement lead time `L_fg_rm` (lag between FG demand signal and RM pull)
  - MOQ/lot-size rounding
  - scrap/yield variance
  - safety stock policy effects

This enforces your key business logic: if FG demand rises in April, RM pressure rises earlier based on lead time.

---

## 4) Statistical Generation / Augmentation Method (No Blind LLM Synthesis)

Use a hybrid statistical pipeline:

1. Distribution fitting by segment
- Fit per-segment distributions on real seed data (lognormal/gamma/zero-inflated where needed).
- Fit separately by product family + velocity class.

2. Time-series component decomposition
- Decompose into level/trend/seasonal/residual.
- Resample residuals using block bootstrap (not IID shuffle) to preserve autocorrelation.

3. Cross-feature dependency preservation
- Use copula or rank-correlation matching to preserve relationships among:
  - demand, price/discount, promotion, stockout days, lead time, OTIF.

4. Regime simulation
- Controlled scenario generation for:
  - promotion waves
  - stockout episodes
  - supplier delays
- Keep scenario priors explicit (probability table in metadata).

5. Hierarchical consistency enforcement
- Reconcile item -> family -> total (bottom-up or MinT style).
- Ensure no impossible negative or contradictory totals.

---

## 5) Realism Quality Gates (Must Pass)

Each synthetic release must pass all gates before training:

1. Univariate similarity checks
- PSI / KS / Wasserstein by key variables.

2. Temporal structure checks
- ACF/PACF similarity
- seasonal strength similarity
- intermittency profile similarity.

3. Cross-feature dependency checks
- Correlation matrix delta threshold
- conditional behavior checks (promo uplift, stockout suppression).

4. FG↔RM causal lag checks
- Cross-correlation peak at expected lag window.
- RM spikes without FG driver should be explainable (procurement or policy events only).

5. Operational sanity constraints
- inventory balance equation consistency
- no impossible lead-time or negative stock transitions.

---

## 6) Fair Model Evaluation Protocol (Mandatory)

To avoid biased claims:

- Same train/val/test windows for all models.
- Same horizon set.
- Same evaluation points (equal-ground table).
- Same metric set and tie-break order.
- Separate reporting:
  - in-domain benchmark (P strict)
  - unseen transfer benchmark (M5).

Current truth to keep:

- `P` strict winner: `ARIMA` (current data behavior)
- M5 transfer winner: `XGBOOST + recent_level_auto_capped`

Both should be reported without forcing one narrative.

---

## 7) What To Implement Next (Execution Plan)

### Phase A: Data foundation

1. Build canonical product master from `Active stock`.
2. Define FG families + RM BOM mapping table.
3. Define lead-time priors by RM family (min/median/max).

### Phase B: Statistical generator v2

1. Add regime-aware FG generator.
2. Add BOM-driven RM generator with lag.
3. Add stockout censoring + observed-demand correction fields.
4. Save full generation metadata (seed, priors, drift settings).

### Phase C: Validation and release

1. Run realism quality gates and publish a realism report.
2. Freeze dataset version if gates pass (`P_v2`).
3. Re-run strict fair-play model comparison.
4. Re-run M5 transfer validation.

### Phase D: Promotion to microservice candidate

1. Pick model by strict protocol + transfer proof.
2. Export artifacts and registry.
3. Run production checklist gates (latency, fallback, drift monitors, rollback).

---

## 8) Deliverables To Add

- `outputs/reports/data_realism_report.csv`
- `outputs/reports/fg_rm_lag_validation.csv`
- `outputs/reports/p_v2_generation_metadata.json`
- `outputs/reports/p_v2_strict_model_comparison.csv`
- updated `CURRENT_STATUS.md` with both in-domain and transfer results.

---

## 9) Decision Rule For “Production-Ready” Claim

Only claim production-ready when all are true:

- realism gates passed on latest dataset version,
- strict equal-ground comparison documented,
- unseen transfer beats baseline with stable horizon profile,
- operational safeguards and rollback path are implemented.

If one fails, claim only “pilot-ready prototype”.
