"""Answer the canonical "why this one?" questions without asking a model anything.

The three explainers -- SHAP attributions, the MILP objective decomposition, the
seeded policy sensitivity -- are already computed and stored by the engines that made
the decisions. Reading one back takes about 170 ms. Deciding *which* one to read used
to take two LLM round-trips and roughly four seconds, purely to rediscover something
the page the user is standing on already determines.

So when the page names an entity and the question is recognisably a request for an
explanation, the tool is chosen here, deterministically, and the numbers reach the
screen before any model is involved. That ordering is the point: the attribution is
demonstrably computed by the algorithm rather than written by the assistant.

This must fail *open*. Anything not confidently recognised returns None and takes the
normal path, because a wrong instant answer is far worse than a correct slow one.
"""
from __future__ import annotations

import re

# Asking for a reason, in the ways people actually phrase it. Deliberately narrow:
# widening this trades a little latency for the risk of hijacking a question the
# router would have handled better.
_EXPLAIN_INTENT = re.compile(
    r"\b("
    r"why|"
    r"explain|explanation|"
    r"driver|drivers|driving|"
    r"sensitiv\w*|"
    r"what.{0,12}\b(caus\w*|drove|drive[sn]?)|"
    r"reason|rationale|justif\w*|"
    r"how did .{0,20}(decide|choose|pick)|"
    r"what.{0,12}\bbehind\b"
    r")\b",
    re.IGNORECASE,
)

# Questions that merely contain "why" but are not about a stored decision. Checked
# first, so "why do I need a permit" does not get answered with a SHAP table.
_NOT_A_DECISION = re.compile(
    r"\b(how do i|how to|where is the|show me how|walk me through|tutorial|"
    r"sop|procedure|safety|forklift|generate a report|report for)\b",
    re.IGNORECASE,
)

# The page determines which decision is on screen, so it determines the explainer.
ROUTE_EXPLAINERS: dict[str, str] = {
    "/admin/forecasts": "forecast_explanation",
    "/admin/replenishment/forecast-space": "policy_sensitivity",
    "/admin/inventory-intelligence": "policy_sensitivity",
    "/admin/slotting-plans": "slotting_recommendation",
    "/admin/ai-slotting": "slotting_recommendation",
}

# What each explainer answers, shown to the user so an instant reply still says where
# it came from rather than appearing from nowhere.
EXPLAINER_SOURCES: dict[str, str] = {
    "forecast_explanation":
        "SHAP attributions computed at forecast publish time (TreeExplainer, exact).",
    "policy_sensitivity":
        "One-factor-at-a-time sensitivity from the seeded lead-time demand simulation.",
    "slotting_recommendation":
        "The solver's own objective decomposition against the runner-up location.",
}


def looks_like_explanation_request(question: str) -> bool:
    """Whether this asks why a stored decision came out the way it did."""
    if not question:
        return False
    if _NOT_A_DECISION.search(question):
        return False
    return bool(_EXPLAIN_INTENT.search(question))


def resolve(question: str, page_context: dict | None) -> dict | None:
    """The tool and parameters to run, or None to fall through to normal routing.

    Requires both halves: a question asking for a reason, and a page that pins down
    which decision is being asked about. Either alone is ambiguous.
    """
    if not page_context or not looks_like_explanation_request(question):
        return None

    tool = ROUTE_EXPLAINERS.get(page_context.get("route") or "")
    if not tool:
        return None

    subject = page_context.get("entityId") or page_context.get("entityLabel")
    if not subject:
        return None

    params: dict[str, object] = {"search": subject}
    horizon = (page_context.get("filters") or {}).get("horizon")
    if tool == "forecast_explanation" and isinstance(horizon, (int, float)):
        params["horizon"] = int(horizon)

    return {"tool": tool, "params": params, "source": EXPLAINER_SOURCES.get(tool, "")}
