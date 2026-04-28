from __future__ import annotations

import asyncio
from pathlib import Path

from starlette.requests import Request

from agent_studio.http.runtime_api import (
    dispatch_api_request,
    load_api_module,
    resolve_api_script,
)


def _make_request(method: str, path: str) -> Request:
    scope = {
        "type": "http",
        "method": method,
        "path": f"/runtime-api/{path}" if path else "/runtime-api",
        "headers": [],
        "query_string": b"",
        "path_params": {"path": path},
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive=receive)


def test_resolve_api_script_finds_python_file(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr("agent_studio.settings.settings.workspace_root", str(tmp_path))
    script = tmp_path / "api" / "contacts.py"
    script.parent.mkdir(parents=True, exist_ok=True)
    script.write_text("def get(request):\n    return {'ok': True}\n", encoding="utf-8")

    resolved = resolve_api_script("contacts")

    assert resolved == script.resolve()


def test_load_api_module_reloads_on_file_change(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr("agent_studio.settings.settings.workspace_root", str(tmp_path))
    script = tmp_path / "api" / "contacts.py"
    script.parent.mkdir(parents=True, exist_ok=True)
    script.write_text("VALUE = 1\n", encoding="utf-8")

    first = load_api_module(script)
    script.write_text("VALUE = 2\n", encoding="utf-8")

    second = load_api_module(script)

    assert first.VALUE == 1
    assert second.VALUE == 2
    assert first is not second


def test_dispatch_api_request_returns_handler_response(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr("agent_studio.settings.settings.workspace_root", str(tmp_path))
    script = tmp_path / "api" / "contacts.py"
    script.parent.mkdir(parents=True, exist_ok=True)
    script.write_text("def post(request):\n    return {'created': True}\n", encoding="utf-8")

    response = asyncio.run(dispatch_api_request(_make_request("POST", "contacts")))

    assert response.status_code == 200
    assert response.body == b'{"created":true}'
