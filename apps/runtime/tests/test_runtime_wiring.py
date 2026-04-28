from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException

from agent_studio.server import (
    _history_response,
    _save_values_if_present,
    _thread_response,
)
from agent_studio.tools import list_studio_routes, runtime_status


def test_runtime_tools_are_registered() -> None:
    assert runtime_status.name == "runtime_status"
    assert list_studio_routes.name == "list_studio_routes"
    assert runtime_status.args == {}


def test_prompt_describes_builder_host_surface() -> None:
    prompt = Path("src/agent_studio/app/PROMPT.md").read_text(encoding="utf-8")

    assert "WordPress for the AI age" in prompt
    assert "/workspace/sites/<site-name>/" in prompt
    assert "host-based publishing" in prompt
    assert "/workspace/api/" in prompt
    assert "/runtime-api/<route>" in prompt
    assert "Vue 3 from a CDN" in prompt
    assert "Builder Host Mode" in prompt
    assert "Agent App Mode" in prompt
    assert "Waymark" not in prompt
    assert "BetStamp" not in prompt


def test_runtime_does_not_include_gcp_or_firebase_routes() -> None:
    source_root = Path("src/agent_studio")
    source = "\n".join(path.read_text(encoding="utf-8") for path in source_root.rglob("*.py"))

    assert "firebase" not in source.lower()
    assert "gcloud" not in source.lower()
    assert "google_cloud" not in source.lower()


def test_open_source_runtime_shapes_thread_and_history_responses() -> None:
    row = {
        "thread_id": "thread-1",
        "created_at": "2026-04-23T12:00:00+00:00",
        "updated_at": "2026-04-23T12:01:00+00:00",
        "metadata": {"graph_id": "agent"},
        "status": "idle",
        "values": {
            "messages": [
                {
                    "id": "message-1",
                    "type": "human",
                    "content": "Build me a landing page and contact API.",
                }
            ]
        },
        "checkpoint_id": "checkpoint-1",
    }

    thread = _thread_response(row)
    history = _history_response(row)

    assert thread["thread_id"] == "thread-1"
    assert thread["extracted"]["preview"] == "Build me a landing page and contact API."
    assert history[0]["values"]["messages"][0]["type"] == "human"
    assert history[0]["checkpoint"]["thread_id"] == "thread-1"


def test_stream_save_skips_deleted_thread(monkeypatch) -> None:
    def missing_thread(*_, **__) -> dict:
        raise HTTPException(status_code=404, detail="Thread not found")

    monkeypatch.setattr("agent_studio.server._save_values", missing_thread)

    assert _save_values_if_present("deleted-thread", {"messages": []}, "idle") is None
