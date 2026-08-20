"""Answer a comparison in two model round-trips instead of one per step.

A ReAct loop asks the model what to do, runs one tool, shows it the result, and asks
again -- so comparing two materials costs six sequential round-trips and measured 25
seconds here. The tools themselves are 170 ms database reads; almost all of that time
is the model being asked the same kind of question repeatedly.

Plan-and-execute inverts it. One call plans every independent lookup at once, they run
concurrently, and a second call writes the answer from all the results together. Two
round-trips regardless of how many materials are being compared.

This only applies where the lookups are genuinely independent, which is the case for
"compare A and B" -- neither answer is needed to formulate the other. Anything that
requires the first result before the second can be planned still belongs on the
ordinary single-tool path.
"""
from __future__ import annotations

import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

import pandas as pd

logger = logging.getLogger("optiwms.agent")

MAX_PARALLEL_CALLS = 4

# Comparisons name several subjects, or ask for a ranking across them.
_COMPARATIVE = re.compile(
    r"\b(compare|comparison|versus|vs\.?|against|both|each of|difference between|"
    r"which (?:one|of them|is) (?:is )?(?:better|worse|higher|lower|faster|bigger))\b",
    re.IGNORECASE,
)


def looks_comparative(question: str) -> bool:
    return bool(question) and bool(_COMPARATIVE.search(question))


def plan_calls(
    question: str,
    tool_menu: str,
    generate: Callable[[str, str], tuple[str, bool]],
    model: str = "gemini-3.1-flash-lite",
) -> list[dict[str, Any]]:
    """Ask once for every independent lookup the question needs.

    Returns a list of ``{"tool", "params"}``. An empty list means this is not a
    fan-out question after all, and the caller should use the ordinary path.
    """
    prompt = f"""You plan data lookups for a Warehouse Management System assistant.

The question below may need SEVERAL independent lookups -- for example comparing two
materials needs one lookup per material. Plan them ALL now; they will run at the same
time, so none of them may depend on another's result.

AVAILABLE TOOLS:
{tool_menu}

QUESTION:
{question}

Reply with ONLY a JSON array, no markdown fences, at most {MAX_PARALLEL_CALLS} entries:
[{{"tool": "<tool_name>", "params": {{...}}}}, ...]
Return [] if a single lookup answers this, or if no tool fits."""

    text_out, _ = generate(prompt, model)
    raw = re.sub(r"^```(?:json)?\s*", "", (text_out or "").strip(), flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("parallel planner returned unparseable JSON: %s", raw[:160])
        return []
    if not isinstance(parsed, list):
        return []

    calls = [
        {"tool": c["tool"], "params": c.get("params") or {}}
        for c in parsed
        if isinstance(c, dict) and c.get("tool")
    ]
    return calls[:MAX_PARALLEL_CALLS]


def execute(calls: list[dict[str, Any]], registry: dict, engine) -> list[dict[str, Any]]:
    """Run the planned lookups concurrently, keeping each result intact.

    Every frame is captured as it returns rather than being flattened into text for
    the model, so the structured payload -- the rows and the chart -- survives the
    loop instead of being reduced to prose.
    """
    def run(call: dict[str, Any]) -> dict[str, Any]:
        spec = registry.get(call["tool"])
        if not spec:
            return {**call, "error": f"unknown tool {call['tool']}"}
        try:
            df, sql = spec["fn"](engine, **call["params"])
            return {**call, "df": df, "sql": sql}
        except Exception as exc:  # one failed lookup must not lose the others
            logger.warning("parallel tool %s failed: %s", call["tool"], exc)
            return {**call, "error": str(exc)}

    if not calls:
        return []
    with ThreadPoolExecutor(max_workers=min(len(calls), MAX_PARALLEL_CALLS)) as pool:
        return list(pool.map(run, calls))


def combine(results: list[dict[str, Any]]) -> tuple[pd.DataFrame | None, str]:
    """Stack the successful frames, tagging each row with the lookup it came from.

    A comparison is only readable if you can tell which row belongs to which subject,
    so the identifying parameter becomes a column rather than being lost in the merge.
    """
    frames, notes = [], []
    for r in results:
        if "df" not in r or r["df"] is None or r["df"].empty:
            notes.append(f"{r['tool']}({r.get('params')}): {r.get('error', 'no rows')}")
            continue
        df = r["df"].copy()
        subject = r["params"].get("search")
        if subject and "subject" not in df.columns:
            df.insert(0, "subject", subject)
        frames.append(df)
        notes.append(f"{r['tool']}({r.get('params')})")

    summary = "-- parallel lookups: " + "; ".join(notes) + " --"
    if not frames:
        return None, summary
    return pd.concat(frames, ignore_index=True, sort=False), summary
