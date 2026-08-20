# Working on the OptiWMS Warehouse Assistant

This is the contributor guide for the agentic layer. It explains where the
agent's knowledge comes from, how to add a capability without weakening the
guard rails, and which past decisions were measured rather than assumed — so
the next person does not re-litigate them from scratch.

The architecture diagram and the rationale table live in the
[README](README.md#agentic-architecture). This file is the working guide.

| | |
|---|---|
| Service | `ai_services/ai-agent` (FastAPI, port 8094) |
| Entry point | `api.py` — auth, rate limit, audit |
| Brain | `agent.py` — routing, modes, charts, memory |
| Tools | `tools.py` — `TOOL_REGISTRY`, 10 reviewed queries |
| Tests | `ai_services/ai-agent/tests` (`pytest`) |

## What the assistant knows, and where that knowledge lives

The assistant has no memory of the codebase. Everything it can answer comes from
one of four sources, each maintained in a different place. When something is
missing from an answer, the fix is almost always in the source, not the prompt.

| Knowledge | Source | Rebuild with |
|---|---|---|
| Warehouse procedures (SOPs) | the `sops` table, seeded by `V97__seed_default_sops.sql` | `cd ai_services/ai-agent && python3 ingest.py` |
| Live operational data | 10 hand-written parameterised SQL tools in `tools.py` | n/a — edit `TOOL_REGISTRY` |
| Why a forecast is what it is | `forecast_shap_explanations`, via the `forecast_explanation` tool | `python3 scripts/seed_forecast_service_db.py --force` |
| Where things are on screen | `TOUR_CATALOG` in `agent.py` + `frontend/lib/tours/tourConfig.ts` | n/a |

Adding a SOP means inserting into `sops` and re-running `ingest.py`; nothing in
the agent changes.

## Adding a capability

**Adding a data capability means adding a tool.** The router picks tools by
description alone, so a good description is the whole integration.

1. Write the query function in `tools.py`. It takes an `Engine` plus typed
   parameters and returns `(DataFrame, sql_string)`. Keep the SQL fixed and
   parameterised — bind values, never interpolate them.
2. Register it in `TOOL_REGISTRY` with a description written for the router,
   not for a human reader. Say what question it answers and in what units.
   "Current stock levels for materials matching a SKU code, material code, or
   name" routes correctly; "stock helper" does not.
3. Declare every parameter the model may set, and give the ones that can be
   inferred a sane default. Omitted parameters are normal — the router is told
   to skip what it cannot infer.
4. Add a test. `tests/test_sql_guard.py` is the pattern for query-shape
   assertions; `tests/test_page_context.py` covers parameter resolution.

### The data path is guarded, and should stay that way

`select_tool()` lets the model choose *which* pre-written query runs and with
what parameters. It never writes SQL and never sees the schema. Free-form
text-to-SQL exists only as a last-resort fallback behind `is_safe_query()`,
`enforce_row_limit()`, and an ADMIN/MANAGER role gate.

When adding a capability, add a tool. Widening the fallback instead moves the
system from "the model picks a reviewed query" to "the model writes queries",
which is a different security posture — and one the role gate and row cap were
not designed to be the only defence for.

Two rules that are easy to break by accident:

- **Never let a tool mutate.** No mutating action exists in the contract, which
  is what makes the assistant safe to expose to workers. A tool that writes
  turns an advisory surface into an execution surface.
- **Never take a warehouse scope from the request body.** Scope comes from the
  caller's JWT assignments, validated against Spring. Page context can suggest
  a *subject*; it can never widen what a user is allowed to see.

## Charts must suit the data, and must be renderable

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

## Page context

Each message carries what the user is looking at — route, selected entity,
filters — so "why is this one low?" resolves without a material code being
typed. Pages publish it with one `usePublishPageContext` call
(`frontend/lib/pageContext.ts`).

It is advisory only: the role gate in `api.py` runs first, and tools take
parameters rather than SQL. Page context can supply a subject; it can never
widen what a user is allowed to see. Anything the user names explicitly wins
over it.

## Tours depend on DOM contracts

Tours are driven by `driver.js` against stable `data-tour-target="..."`
attributes. They are the one place where the agent reaches into frontend
structure, which makes them the one place a routine refactor can silently break
an agent capability.

When editing frontend components, **preserve every existing
`data-tour-target`**, and add one to any new navigation link, primary action
button or important form input. See
[`ai_services/ai-agent/AGENTS.md`](ai_services/ai-agent/AGENTS.md) for the full
rule.

## Routing costs, and why the fast path exists

Two behaviours here look like premature optimisation and are not:

- **`route_and_select()` merges classification and tool choice into one model
  call.** They were two sequential calls over largely the same context, about
  4.4 s combined, where one call answers both in about 1.2 s. The classification
  decides whether a tool is needed at all, so nothing is wasted when the answer
  turns out to be SOP, TOUR or CHAT. On any parse failure it falls back to the
  older two-call path rather than guessing.
- **`classify_keyword_only()` runs before any model call.** Greetings and
  explicit tour phrasings are decided on keywords alone. Before this existed,
  the classifier had only SOP, DATA and TOUR to choose from, so "hi" was forced
  into one of them and launched a dashboard tour.

If you add a mode, add its keyword fast path at the same time, or the router
will pay a model call to recognise "thanks".

## LangGraph ReAct loop — evaluated, not adopted

A colleague's branch replaces the single-shot tool dispatch with
`langgraph.prebuilt.create_react_agent`. It was prototyped over this branch's
ten-tool registry (not her two) and measured rather than argued about.

**What it gains.** Genuine multi-step questions. Asked to *compare the forecast
drivers for RM-0001 and RM-0002 and say which is falling faster*, the loop made
four tool calls, reasoned across them, and produced a comparison the single-shot
dispatch cannot — it picks exactly one tool and stops.

**What it costs.**

| | single-shot | ReAct loop |
|---|---|---|
| Latency, one question | ~2–4 s | **25 s** |
| Model calls | 2 | one per loop iteration |
| Final message | plain string | list of content blocks, needs unwrapping |

**Why it is not adopted yet.** Twenty-five seconds is not a usable interactive
latency, and the tool results reach the model as text — so `sql`, `data` and
`chart` survive only via a side channel that captures each tool's DataFrame as it
runs. That works (the prototype recovered a valid chart spec), but it is real
plumbing added for a question type nobody has asked for yet.

**If it is revisited**, the two things to solve first are latency (a faster
routing model, or the loop only when a single tool demonstrably cannot answer)
and unwrapping the content-block response into the existing `DataResponse`
contract. The side-channel capture pattern from the prototype is the right shape
for preserving structure; it does not need redesigning.

`langgraph` is installed in the local environment but deliberately absent from
`requirements.txt`, since nothing in the service imports it.

## Before opening a pull request

```bash
cd ai_services/ai-agent && python3 -m pytest -q
```

Check that you have not:

- added a tool that writes, or a fallback that widens;
- introduced a chart type the frontend guard will drop;
- committed a `.env` file — the image build context is this directory, and
  `.dockerignore` uses `.env*` for exactly that reason;
- left a new mode without a keyword fast path.
