
## What the assistant knows, and where that knowledge lives

The assistant has no memory of the codebase. Everything it can answer comes from
one of four sources, each maintained in a different place. When something is
missing from an answer, the fix is almost always in the source, not the prompt.

| Knowledge | Source | Rebuild with |
|---|---|---|
| Warehouse procedures (SOPs) | the `sops` table, seeded by `V97__seed_default_sops.sql` | `cd ai_services/ai-agent && python3 ingest.py` |
| Live operational data | 9 hand-written parameterised SQL tools in `tools.py` | n/a — edit `TOOL_REGISTRY` |
| Why a forecast is what it is | `forecast_shap_explanations`, via the `forecast_explanation` tool | `python3 scripts/seed_forecast_service_db.py --force` |
| Where things are on screen | `TOUR_CATALOG` in `agent.py` + `frontend/lib/tours/tourConfig.ts` | n/a |

Adding a SOP means inserting into `sops` and re-running `ingest.py`; nothing in
the agent changes. Adding a data capability means adding a tool to
`TOOL_REGISTRY` with a clear description — the router picks tools by description
alone, and never sees the database schema.

### The data path is guarded, and should stay that way

`select_tool()` lets the model choose *which* pre-written query runs and with
what parameters. It never writes SQL and never sees the schema. Free-form
text-to-SQL exists only as a last-resort fallback behind `is_safe_query()`.

When adding a capability, add a tool. Widening the fallback instead moves the
system from "the model picks a reviewed query" to "the model writes queries",
which is a different security posture.

### Charts must suit the data, and must be renderable

`enforce_chart_rules()` in `agent.py` corrects a chart form the data cannot
support: a pie of a continuous variable is binned into a histogram, a pie past
six slices or answering a ranking question becomes a bar, a line over unordered
categories becomes a bar. Each correction attaches a `rule` string explaining the
substitution.

Two constraints on any new rule:

1. **Emit only `line` or `bar`.** The frontend type guard in
   `services/aiService.ts` drops anything else *silently*, so an otherwise
   correct correction leaves the user with no chart and no explanation. A
   histogram is expressed as a bar chart of bins, not a new type.
2. **Transform the data, not just the label.** Renaming a spec to "histogram"
   without binning it produces a chart that is wrong in a new way.

`tests/test_chart_rules.py` enforces both.

### Page context

Each message carries what the user is looking at — route, selected entity,
filters — so "why is this one low?" resolves without a material code being
typed. Pages publish it with one `usePublishPageContext` call
(`frontend/lib/pageContext.ts`).

It is advisory only: the role gate in `api.py` runs first, and tools take
parameters rather than SQL. Page context can supply a subject; it can never
widen what a user is allowed to see. Anything the user names explicitly wins
over it.
