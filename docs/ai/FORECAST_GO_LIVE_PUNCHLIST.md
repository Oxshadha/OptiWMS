# Forecast Go-Live Punch List (Final Blockers)

Last updated: 2026-04-19  
Scope: Final items required before production go-live sign-off.

Rule:
- Do not mark go-live until every item below is completed with evidence.

## 1) 24h Soak Gate Pass
- Status: `BLOCKED`
- Owner: Platform/Backend + MLOps
- Required result:
  - `GET /artifacts/production-readiness?...&soak_hours=24` returns `ready=true`
  - `soak_window_no_critical` check passes with value `0`
- Evidence commands:
```bash
curl "http://localhost:8091/artifacts/production-readiness?dataset=B&model_name=CATBOOST&split=test&inference_window=200&soak_hours=24"
curl "http://localhost:8091/artifacts/operational-health/history?limit=200"
```
- Evidence to attach:
  - JSON response showing `ready=true`
  - operational-health history extract for the same 24h window

## 2) Replace Demo BOM with Real BOM Master
- Status: `BLOCKED`
- Owner: Planning/Ops + Backend
- Required result:
  - real BOM headers/components loaded for active FG SKUs
  - no dependency on demo starter mappings for production planning
- Evidence commands:
```bash
curl "http://localhost:8090/api/planning/bom/headers"
curl "http://localhost:8090/api/planning/bom/headers/<HEADER_ID>/components"
curl "http://localhost:8091/raw-material-requirements?dataset=B&model=CATBOOST"
```
- Evidence to attach:
  - sample BOM records from production-like data
  - RM requirement rows generated from real BOM for latest published run

## 3) Complete DS Training Pipeline (Fair and Reproducible)
- Status: `BLOCKED`
- Owner: Data Science
- Required result:
  - canonical feature pipeline fixed (no ad-hoc feature drift)
  - fair benchmark on same split protocol across candidates
  - champion + fallback selected with reproducible artifacts
- Evidence to attach:
  - dataset lineage (`dataset_version`, time windows, transformation notes)
  - model comparison report (same split/fair protocol)
  - artifact paths for champion/fallback with metadata

## 4) Final Champion Promotion (Gate-Controlled)
- Status: `PARTIAL`
- Owner: Platform/Backend
- Required result:
  - model promoted only through gate-controlled promotion endpoint
  - promotion evidence references acceptance + soak pass
- Evidence commands:
```bash
curl "http://localhost:8091/artifacts/acceptance-gate?dataset=B&model_name=CATBOOST&split=test&inference_window=200"
curl "http://localhost:8091/artifacts/production-readiness?dataset=B&model_name=CATBOOST&split=test&inference_window=200&soak_hours=24"
curl -X POST "http://localhost:8091/model-registry/promote" -H "Content-Type: application/json" -d '{"entry_id":1,"split":"test","inference_window":200}'
curl "http://localhost:8091/model-registry?dataset=B"
```

## 5) Production Sign-Off Pack
- Status: `BLOCKED`
- Owner: DS + Backend + Product/Ops
- Required result:
  - signed go/no-go record with traceable evidence
- Mandatory sign-offs:
  - Data Science sign-off
  - Platform/Backend sign-off
  - Product/Operations sign-off
- Evidence bundle (single folder):
  - acceptance-gate JSON
  - production-readiness JSON (`soak_hours=24`)
  - latest published run evidence
  - model registry champion entry
  - BOM validation sample

## 6) Optional (Strongly Recommended Before External Evaluation)
- Status: `RECOMMENDED`
- Owner: Platform + Product
- Items:
  - alert routing (Slack/Email/Pager) for `critical` health
  - SLO dashboard for latency/fallback/error
  - weekly drift review routine with ticketing

## Go-Live Decision Template
- `GO`: All items 1-5 complete with attached evidence.
- `NO-GO`: Any blocker incomplete or evidence missing.

