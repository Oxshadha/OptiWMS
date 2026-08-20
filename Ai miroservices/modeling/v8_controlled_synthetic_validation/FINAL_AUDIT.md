# OptiWMS Final Report — Audit

Scope: `final_report-3.pdf` (121 pp) checked against the OptiWMS repository,
the v8 retained artifacts, the Spring policy service, and the slotting solver.

Verdict: **the numbers are sound; the equations are not.** Every quantitative
claim I could trace resolves to a retained artifact. But Chapter 5 and Chapter 6
print equations that do not match the code that produced the results, and in one
case no implementation agrees with the printed formula.

---

## 1. Confirmed aligned

| Claim | Source of truth | Result |
|---|---|---|
| All Ch7 forecasting statistics (35 values) | `outputs/*.csv`, `outputs/evaluator/*` | exact |
| Ch7 slotting values (3,257 / 4,200 / 943 / 14 gates / OPTIMAL) | `deployment_decision.json`, `storage_slotting_validation.csv` | exact |
| Ch7 routing values (0.205 ms, 0.351 ms, 265.23, CIs, 365/1,076/6,768/32,988, p=1.76e-15) | `warehouse_routing_evaluation/outputs/*` | exact |
| Ch7 Eq 7.2 coefficients 0.55 / 0.25 / 0.20 | `pipeline/generate_data.py:133` | exact |
| Ch7 Eq 7.3 BOM explosion `(1+scrap)/yield` | `pipeline/generate_data.py:155` | exact |
| Seeds 20260711 / 20260728 | `generate_data.py:12`, `routing_algorithm_decision.json` | exact |
| Circular block bootstrap: block 3, 5,000 resamples, HAC maxlags 3 | `operational_forecast.py:183-192` | exact |
| **Eq 6.5** MOQ / order-multiple rounding | `inventory_policy_simulation.csv` | **120/120 rows** |
| **Eq 6.6** `Max = Min + Q` | `inventory_policy_simulation.csv` | **120/120 rows** |
| Slotting two-stage MILP → min-cost-flow structure | `plan_optimizer.py:623` (`_ortools_optimize_plan`) | matches |
| Eq 5.4 (≤1 per position), Eq 5.6 (binary) | `physical_layout.csv.gz`: capacity = 1 for all 4,200 storage positions | holds for this population |

---

## 2. Mathematical contradictions

### A. Eq 6.3 `Min_i = ROP_i` — contradicted by every implementation

Three sources, three different answers:

| | Formula for `Min` |
|---|---|
| **Report, Eq 6.3** | `Min = ROP = μ̂_L + SS` |
| **Retained pipeline** (`pipeline/diagnostics.py:192`) | `proposed_min = reorder_point + safety_stock` |
| **Production Java service** (`InventoryPolicyRecommendationService.java:521`) | `proposedMin = max(safetyStock, floor)` → `Min = SS` |

Numerically confirmed on the retained data (RM-0001):
`safety_stock 75.001786 + reorder_point 292.844932 = proposed_min 367.846718`.
Tested across all rows: `proposed_min == reorder_point` in **0/120**;
`proposed_min == safety_stock` in **0/120**.

This is the most serious finding. An evaluator who reads Eq 6.3 and opens
`inventory_policy_simulation.csv` will find they disagree.

**Note on reconciliation:** the CSV column named `reorder_point` holds
`p90 × lead_months`, which under the report's own Eq 6.2 is *not* a reorder point
(it carries no safety stock). The report's `ROP` is in fact the CSV's
`proposed_min`. The equations can be made consistent, but only by renaming.

### B. Two policy implementations exist and disagree

The report prints one equation block as though there were one implementation.
There are two, and they differ in every quantity except the rounding rule:

| Quantity | Report | `diagnostics.py` (writes the retained CSV) | Java service (runs the 1,000-trial Monte Carlo) |
|---|---|---|---|
| `SS` | `z_α · σ̂_L` | `(p90 − p50)⁺ · √L` | `z · √(L·σ_d² + σ_L²·d̄²)` |
| `ROP` | `μ̂_L + SS` | `p90 · L` | `μ_L + SS` |
| `Min` | `ROP` | `ROP + SS` | `max(SS, floor)` |
| Target | `T_i` | `2 × p50` | `ROP + cycleStock(EOQ)` |
| `Max` | `Min + Q` | `Min + Q` ✓ | `min(target, expiryCap).max(ROP)` |

Chapter 7 §7.7.6 credits the Java service with the 1,000-trial simulation, while
Figure 7.6 and Table 7.7 are plotted from the `diagnostics.py` output. Both are
legitimate, but the report should say which equations describe which.

### C. Eq 6.1 hides the lead-time variance term

The Java service computes
`SS = z · √(L·σ_d² + σ_L²·d̄²)` — combined demand *and* lead-time uncertainty,
using the real supplier field `leadTimeStdDays`. The report's `σ̂_L` gives no
indication that lead-time variability is modelled at all. Chapter 7 §7.7.6 states
that "lead time only scales it", which is correct for the Java version but cannot
be derived from Eq 6.1 as printed.

### D. EOQ and the expiry cap are absent from the report

The Java service computes a classical economic order quantity
`EOQ = √(2·D·S/H)` (`annualDemand`, `orderingCostPerOrder`, `holdingCostPerUnit`)
and an `expiryLimitedMaxStock` shelf-life cap that can override `proposedMax`.
Neither appears in Chapter 5, Chapter 6, Chapter 7, or the abbreviations list.
Eq 6.4 presents order sizing as a plain gap-to-target.

### E. Slotting Eq 5.1 omits two of four cost terms

Actual stage-1 objective (`plan_optimizer.py:744`):

```
min Σ (travel + access + vertical + 25·moving) · x_ip
    travel = distance(p) × critical_weight × flow_weight
    access = |accessibility_rating(p) − target(fms_class)| × critical_weight
    vertical = (level(p) − 1) × (8·freq + 5·demand + 4·space)
```

Eq 5.1 prints only `d_ip^pick·x + d_ip^reserve·y + C_move`. Missing: the
accessibility-affinity cost, the vertical/level cost, and the criticality and
flow multipliers that scale distance. The reserve arc cost in stage 2 likewise
carries a level term the report does not show.

### F. The relocation cap is a hard constraint the report never states

`plan_optimizer.py` adds `Σ moving ≤ relocation_cap` and has an explicit
`INFEASIBLE` branch when the cap falls below the forced-move lower bound.
Eq 5.2–5.6 omit it, so the report cannot explain why a solve might return
INFEASIBLE — a question an evaluator is likely to ask.

---

## 3. Are the equations realistic?

Yes, with one qualification. Eq 6.1–6.6 are the standard textbook
`(s, S)` / min-max formulation and are appropriate for the problem. Eq 5.1–5.8
are a correct MILP + min-cost-flow formulation of storage assignment. Eq 7.1–7.3
match the generator exactly.

The qualification is that Chapters 5 and 6 present **simplified teaching versions**
of the models while the code runs richer ones. That is a legitimate choice for a
report, but it is not currently declared. The fix is either to print the full
objective and constraint set, or to add one sentence per equation block saying
the printed form omits secondary cost terms and stating where the complete
formulation lives.

---

## 4. Editorial items still outstanding

| Item | Location | Status |
|---|---|---|
| "References" listed three times, all → p.90 | TOC (`chapter9.tex`) | not yet fixed |
| "insert the submitted GitHub address before hand-in" | Appendix B (`chapter10.tex`) | not yet fixed |
| "SRS document link" dead placeholder | Appendix B | not yet fixed |
| Ch7 table captions 7.1–7.9 in Title Case | `chapter7.tex` | cosmetic |

Already applied and confirmed present in `final_report-3.pdf`: Abstract
seasonal-naive baseline, Ch8 §8.4 contradiction removed, Ch8 Table 8.1 baseline
added, Ch6 50/87 reconciliation, "Senuka K.E.O.L." consistent, "second-year"
removed.

---

## 5. Recommended priority

1. **Eq 6.3** — reconcile `Min`, or rename the CSV column. Highest exposure.
2. **Declare which implementation each equation block describes** (§B).
3. Add the lead-time variance term to Eq 6.1, and state EOQ + expiry cap (§C, §D).
4. Add the omitted objective terms and the relocation cap to Ch5 (§E, §F).
5. Clear the four editorial items.

Items 1–4 are viva-exposed: they are the questions a examiner asks after reading
the equations and then opening the code.
