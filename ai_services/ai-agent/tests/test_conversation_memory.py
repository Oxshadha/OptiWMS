"""Earlier turns must resolve references the current message leaves open."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agent import format_turns, recent_turns  # noqa: E402


def test_no_session_means_no_history():
    """A first message, or an anonymous one, must not fail -- just carry nothing."""
    assert recent_turns(None) == []
    assert recent_turns("") == []


def test_an_unreadable_session_degrades_quietly():
    """History is an aid, not a dependency: a database blip must not fail the turn."""
    assert recent_turns("00000000-0000-0000-0000-000000000000") == []


def test_empty_history_is_stated_rather_than_left_blank():
    """An empty string here would read to the model as a truncated prompt."""
    assert "no earlier messages" in format_turns([])


def test_turns_render_oldest_first_with_speakers():
    rendered = format_turns([
        ("user", "why is demand low for RM-0001"),
        ("assistant", "Planned production requirement is the largest driver."),
        ("user", "and RM-0002?"),
    ])
    lines = rendered.splitlines()
    assert lines[0].startswith("user:")
    assert lines[1].startswith("assistant:")
    assert lines[0].endswith("RM-0001")           # oldest first
    assert "RM-0002" in lines[2]
