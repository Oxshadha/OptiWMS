"""Page context resolves a subject the user left implicit -- and nothing more."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agent import apply_page_context_defaults, describe_page_context  # noqa: E402

CTX = {
    "route": "/admin/forecasts", "entityType": "material",
    "entityId": "RM-0001", "entityLabel": "RM-0001", "filters": {"horizon": 3},
}


def _sel(**params):
    return {"tool": "forecast_explanation", "params": dict(params)}


def test_description_reads_as_a_sentence():
    described = describe_page_context(CTX)
    assert "demand forecast dashboard" in described
    assert "RM-0001" in described and "horizon=3" in described


def test_no_context_describes_as_empty():
    assert describe_page_context(None) == ""
    assert describe_page_context({}) == ""


def test_an_unstated_subject_is_filled_from_the_page():
    out = apply_page_context_defaults(_sel(), CTX)
    assert out["params"]["search"] == "RM-0001"
    assert out["params"]["horizon"] == 3


@pytest.mark.parametrize("echoed", ["this", "this SKU", "that material", "selected", "IT"])
def test_a_pronoun_echoed_back_is_treated_as_absent(echoed):
    """The model sometimes returns the pronoun as a parameter value. It is not
    searchable, so it must not be passed through as if it were a material code."""
    out = apply_page_context_defaults(_sel(search=echoed), CTX)
    assert out["params"]["search"] == "RM-0001"


def test_an_explicitly_named_subject_always_wins():
    out = apply_page_context_defaults(_sel(search="RM-0099"), CTX)
    assert out["params"]["search"] == "RM-0099"


def test_an_explicit_horizon_is_not_overwritten():
    out = apply_page_context_defaults(_sel(search="RM-0001", horizon=12), CTX)
    assert out["params"]["horizon"] == 12


def test_context_is_ignored_when_no_tool_was_chosen():
    out = apply_page_context_defaults({"tool": None, "params": {}}, CTX)
    assert not out["params"]


def test_a_tool_without_a_search_parameter_is_left_alone():
    """reorder_alerts takes no subject; injecting one would be a made-up filter."""
    out = apply_page_context_defaults({"tool": "reorder_alerts", "params": {}}, CTX)
    assert "search" not in out["params"]


# ── Page-aware suggestions ───────────────────────────────────────────────────
from agent import suggestions_for  # noqa: E402


def test_suggestions_name_the_selected_entity():
    prompts = suggestions_for({"route": "/admin/forecasts", "entityLabel": "RM-0001"})
    assert any("RM-0001" in p["text"] for p in prompts)


def test_each_suggestion_carries_its_own_title():
    """Reusing a generic card title over a page-specific prompt produced captions
    like "Stock Levels" above "Why is demand high?"."""
    for p in suggestions_for({"route": "/admin/forecasts"}):
        assert p["title"] and p["text"]
        assert len(p["title"]) < len(p["text"])


def test_suggestions_read_cleanly_without_an_entity():
    for p in suggestions_for({"route": "/admin/forecasts"}):
        assert "  " not in p["text"]
        assert not p["text"].rstrip("?").endswith("for")


def test_each_decision_page_offers_its_own_explanation_prompt():
    """The three XAI screens must each invite the question they can answer."""
    forecast = suggestions_for({"route": "/admin/forecasts"})
    policy = suggestions_for({"route": "/admin/inventory-intelligence"})
    slotting = suggestions_for({"route": "/admin/slotting-plans"})
    assert any("driving" in p["text"].lower() for p in forecast)
    assert any("sensitive" in p["text"].lower() for p in policy)
    assert any("location" in p["text"].lower() for p in slotting)
    assert forecast != policy != slotting


def test_an_unknown_route_still_gets_useful_prompts():
    assert len(suggestions_for({"route": "/admin/something-new"})) == 3


def test_workers_are_offered_procedures_not_analytics():
    prompts = suggestions_for({"route": "/worker/tasks"}, role="worker")
    assert any("forklift" in p["text"].lower() for p in prompts)
