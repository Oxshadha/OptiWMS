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
