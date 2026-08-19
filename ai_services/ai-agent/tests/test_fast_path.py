"""The fast path must be quick, and must decline anything it is not sure about.

It answers "why this one?" straight from stored evidence with no model call. That is
worth having only if it never hijacks a question the normal router would have handled
better -- so most of these tests are about what it refuses.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fast_path import (  # noqa: E402
    EXPLAINER_SOURCES,
    ROUTE_EXPLAINERS,
    looks_like_explanation_request,
    resolve,
)

FORECAST = {"route": "/admin/forecasts", "entityId": "RM-0001", "filters": {"horizon": 3}}


# ── What it recognises ───────────────────────────────────────────────────────

@pytest.mark.parametrize("question", [
    "why is this one so low?",
    "Why is demand high here?",
    "explain this forecast",
    "what is driving this?",
    "what caused this drop?",
    "what is this recommendation most sensitive to?",
    "why was this bin chosen?",
    "how did it decide this location?",
    "what is the reason for this change?",
    "justify this recommendation",
])
def test_explanation_requests_are_recognised(question):
    assert looks_like_explanation_request(question)


@pytest.mark.parametrize("question", [
    "show me stock levels",
    "generate a report for top movers",
    "hello",
    "which materials are below reorder point?",
    "list open transfers",
])
def test_ordinary_questions_are_not_hijacked(question):
    assert not looks_like_explanation_request(question)


@pytest.mark.parametrize("question", [
    "how do I use a forklift safely?",
    "why do I need a permit — what is the SOP?",
    "walk me through the dashboard",
    "show me how to create an order",
])
def test_procedure_and_tour_questions_defer(question):
    """These contain reason-words but belong to the SOP and TOUR paths. Answering
    them with a SHAP table would be confidently wrong."""
    assert not looks_like_explanation_request(question)


# ── What it resolves ─────────────────────────────────────────────────────────

def test_forecast_page_resolves_to_shap():
    out = resolve("why is this one low?", FORECAST)
    assert out["tool"] == "forecast_explanation"
    assert out["params"] == {"search": "RM-0001", "horizon": 3}
    assert "SHAP" in out["source"]


def test_policy_page_resolves_to_sensitivity():
    out = resolve("what is this sensitive to?",
                  {"route": "/admin/inventory-intelligence", "entityId": "RM-0007"})
    assert out["tool"] == "policy_sensitivity"


def test_slotting_page_resolves_to_the_solver_decomposition():
    out = resolve("why this bin?", {"route": "/admin/slotting-plans", "entityId": "RM-0012"})
    assert out["tool"] == "slotting_recommendation"


def test_horizon_is_only_applied_where_it_means_something():
    """A horizon filter is meaningful for a forecast and meaningless for slotting;
    passing it through would be an unexpected keyword argument."""
    out = resolve("why this bin?",
                  {"route": "/admin/slotting-plans", "entityId": "RM-1", "filters": {"horizon": 3}})
    assert "horizon" not in out["params"]


# ── Failing open ─────────────────────────────────────────────────────────────

def test_no_page_context_defers():
    assert resolve("why is this one low?", None) is None


def test_a_page_with_no_explainer_defers():
    assert resolve("why is this one low?",
                   {"route": "/admin/orders/inbound", "entityId": "PO-1"}) is None


def test_no_selected_entity_defers():
    """The page says which explainer, but not which decision. Guessing would answer
    about the wrong material."""
    assert resolve("why is this one low?", {"route": "/admin/forecasts"}) is None


def test_a_non_explanation_question_defers_even_on_an_explainer_page():
    assert resolve("show me stock levels", FORECAST) is None


def test_entity_label_is_accepted_when_id_is_absent():
    out = resolve("why?", {"route": "/admin/forecasts", "entityLabel": "RM-0009"})
    assert out["params"]["search"] == "RM-0009"


# ── Consistency ──────────────────────────────────────────────────────────────

def test_every_route_has_a_described_source():
    """An instant answer still has to say where it came from."""
    for tool in set(ROUTE_EXPLAINERS.values()):
        assert EXPLAINER_SOURCES.get(tool)


def test_every_explainer_is_a_registered_tool():
    import tools
    for tool in set(ROUTE_EXPLAINERS.values()):
        assert tool in tools.TOOL_REGISTRY, f"{tool} is routed to but not registered"
