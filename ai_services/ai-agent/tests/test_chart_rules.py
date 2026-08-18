"""The assistant must pick a chart that suits the data, and must actually emit it.

Two failure modes are covered: choosing a chart form the data cannot support
(a pie of a continuous variable), and choosing a correct form the client cannot
render, which silently drops the chart so the user sees nothing at all.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agent import (  # noqa: E402
    classify_series,
    enforce_chart_rules,
    is_comparison_question,
)

# The frontend type guard (services/aiService.ts) accepts only these.
RENDERABLE = {"line", "bar"}


def _spec(chart_type, labels, values=None, **extra):
    values = values if values is not None else [1] * len(labels)
    return {
        "type": chart_type, "title": "t", "xKey": "k", "yKey": "v",
        "data": [{"k": l, "v": v} for l, v in zip(labels, values)], **extra,
    }


@pytest.mark.parametrize("values,expected", [
    (["north", "south"], "qualitative"),
    ([1, 2, 3, 2, 1], "discrete"),
    ([1.5, 2.25, 88.1, 4.7, 19.3, 55.2, 71.9, 3.3, 12.6, 44.8, 61.2, 77.4, 90.1], "continuous"),
])
def test_classify_series(values, expected):
    assert classify_series(values) == expected


@pytest.mark.parametrize("question", [
    "compare inbound versus outbound", "which SKU is highest", "rank the top movers",
])
def test_comparison_questions_are_detected(question):
    assert is_comparison_question(question)


def test_pie_of_a_continuous_variable_becomes_a_binned_histogram():
    weights = [12.0, 15.5, 17.2, 19.9, 22.4, 25.1, 28.8, 31.3, 35.7, 40.2, 44.6, 51.1]
    out = enforce_chart_rules(_spec("pie", weights), "distribution of pallet weights")
    assert out["chart_subtype"] == "histogram"
    assert out["type"] in RENDERABLE
    # Binned, not merely relabelled: every observation lands in exactly one bin.
    assert sum(row["count"] for row in out["data"]) == len(weights)
    assert out["rule"]


def test_a_bar_per_distinct_continuous_value_is_binned():
    values = [float(v) for v in range(100, 100 + 40, 3)]
    out = enforce_chart_rules(_spec("bar", values), "spread of order sizes")
    assert out["chart_subtype"] == "histogram"
    assert sum(row["count"] for row in out["data"]) == len(values)


def test_too_many_slices_becomes_a_bar():
    out = enforce_chart_rules(_spec("pie", [f"sku{i}" for i in range(9)]), "share by sku")
    assert out["type"] == "bar"


def test_pie_is_refused_for_a_ranking_question():
    out = enforce_chart_rules(_spec("pie", ["a", "b", "c"]), "which warehouse is highest")
    assert out["type"] == "bar"


def test_a_small_share_breakdown_stays_a_pie():
    out = enforce_chart_rules(_spec("pie", ["ambient", "chilled", "frozen"]), "share by zone")
    assert out["type"] == "pie"


def test_line_over_unordered_categories_becomes_a_bar():
    out = enforce_chart_rules(_spec("line", ["forklift", "PPT", "stacker"]), "count by equipment")
    assert out["type"] == "bar"


def test_a_time_series_is_left_alone():
    out = enforce_chart_rules(_spec("line", ["2026-01", "2026-02", "2026-03"], ordinal=True), "trend")
    assert out["type"] == "line"


def test_every_corrected_chart_is_renderable_by_the_client():
    """A correction that the client drops is worse than no correction: the user
    is shown nothing and told nothing."""
    cases = [
        _spec("pie", [1.5, 9.2, 18.7, 27.3, 36.9, 45.1, 54.8, 63.2, 72.6, 81.4, 90.3, 99.7]),
        _spec("bar", [float(v) for v in range(50, 90, 2)]),
        _spec("pie", [f"c{i}" for i in range(12)]),
        _spec("line", ["red", "green", "blue"]),
    ]
    for spec in cases:
        out = enforce_chart_rules(spec, "show me this")
        assert out is None or out["type"] in RENDERABLE, f"unrenderable: {out['type']}"


def test_no_chart_survives_an_empty_result():
    assert enforce_chart_rules(None, "anything") is None
