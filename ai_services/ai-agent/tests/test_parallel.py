"""Fan-out planning for comparison questions.

The planner itself needs a model, so these cover the deterministic parts: which
questions qualify, that results are combined without losing which subject a row
belongs to, and that one failed lookup does not discard the others.
"""
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import parallel  # noqa: E402


@pytest.mark.parametrize("question", [
    "compare RM-0001 and RM-0002 drivers",
    "RM-0001 vs RM-0002",
    "what is the difference between these two materials?",
    "show both of them",
    "which one is better?",
])
def test_comparisons_are_recognised(question):
    assert parallel.looks_comparative(question)


@pytest.mark.parametrize("question", [
    "why is RM-0001 low",
    "show me stock levels",
    "which materials are below reorder point?",
])
def test_single_subject_questions_stay_on_the_normal_path(question):
    assert not parallel.looks_comparative(question)


def test_plan_is_capped():
    """An unbounded plan would fan out into as many queries as the model imagined."""
    many = "[" + ",".join('{"tool":"forecast","params":{}}' for _ in range(12)) + "]"
    calls = parallel.plan_calls("compare everything", "menu", lambda p, m: (many, False))
    assert len(calls) == parallel.MAX_PARALLEL_CALLS


def test_unparseable_plan_falls_through_rather_than_raising():
    assert parallel.plan_calls("compare", "menu", lambda p, m: ("not json", False)) == []


def test_a_single_planned_call_is_left_to_the_normal_path():
    calls = parallel.plan_calls("compare", "menu", lambda p, m: ("[]", False))
    assert calls == []


def _registry(frames):
    return {
        name: {"fn": (lambda df: (lambda engine, **kw: (df, "-- tool --")))(df)}
        for name, df in frames.items()
    }


def test_results_keep_the_subject_they_belong_to():
    """Without this a comparison is two stacks of numbers with no way to tell which
    material each row describes."""
    reg = _registry({"t": pd.DataFrame([{"driver": "lag_1", "effect": -10}])})
    results = parallel.execute(
        [{"tool": "t", "params": {"search": "RM-0001"}},
         {"tool": "t", "params": {"search": "RM-0002"}}], reg, engine=None)
    combined, summary = parallel.combine(results)
    assert list(combined["subject"]) == ["RM-0001", "RM-0002"]
    assert "t(" in summary


def test_one_failed_lookup_does_not_lose_the_others():
    reg = {
        "good": {"fn": lambda engine, **kw: (pd.DataFrame([{"a": 1}]), "-- good --")},
        "bad": {"fn": lambda engine, **kw: (_ for _ in ()).throw(RuntimeError("boom"))},
    }
    results = parallel.execute(
        [{"tool": "good", "params": {"search": "A"}},
         {"tool": "bad", "params": {"search": "B"}}], reg, engine=None)
    combined, summary = parallel.combine(results)
    assert combined is not None and len(combined) == 1
    assert "boom" in summary


def test_an_unknown_tool_is_reported_not_raised():
    results = parallel.execute([{"tool": "nope", "params": {}}], {}, engine=None)
    assert "unknown tool" in results[0]["error"]


def test_all_lookups_failing_yields_no_frame():
    combined, summary = parallel.combine([{"tool": "t", "params": {}, "error": "x"}])
    assert combined is None
    assert "x" in summary
