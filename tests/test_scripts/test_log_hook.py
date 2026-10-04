"""Prompt-only AI logging must not turn lifecycle hooks into fake user prompts."""

import pytest

from scripts import log_hook


@pytest.mark.parametrize(
    ("tool", "event"),
    [
        ("codex", "Stop"),
        ("cursor", "stop"),
        ("gemini", "AfterModel"),
        ("gemini", "SessionEnd"),
        ("copilot", "sessionEnd"),
    ],
)
def test_lifecycle_events_are_not_logged(tool: str, event: str) -> None:
    assert log_hook.normalize({"hook_event_name": event}, tool) is None


def test_empty_prompt_is_not_logged(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(log_hook, "git", lambda _command: "P-043.git")

    assert log_hook.normalize({"hook_event_name": "UserPromptSubmit", "prompt": "   "}, "codex") is None


def test_user_prompt_keeps_auto_log_format(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(log_hook, "git", lambda _command: "P-043.git")

    entry = log_hook.normalize(
        {"hook_event_name": "UserPromptSubmit", "prompt": "Giá VF 8?", "session_id": "session-1"},
        "codex",
    )

    assert entry is not None
    assert entry["event"] == "UserPromptSubmit"
    assert entry["prompt"] == "Giá VF 8?"
    assert entry["session_id"] == "session-1"
