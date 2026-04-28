from __future__ import annotations

import asyncio
import json
from pathlib import Path

from starlette.requests import Request

from agent_studio.http.site_static import (
    resolve_site_from_host,
    serve_host_site,
)


def _make_request(path: str, *, host: str = "localhost") -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": f"/{path}",
        "root_path": "",
        "headers": [(b"accept", b"text/html"), (b"host", host.encode())],
        "query_string": b"",
        "path_params": {"path": path},
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive=receive)


def test_site_static_rejects_dot_segment_bypass(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr("agent_studio.settings.settings.workspace_root", str(tmp_path))
    monkeypatch.setattr("agent_studio.settings.settings.site_domain_suffixes", "localhost")
    private = tmp_path / "sites" / "private"
    private.mkdir(parents=True)
    (private / "secret.html").write_text("secret", encoding="utf-8")

    response = asyncio.run(
        serve_host_site(_make_request("public/../private/secret.html", host="public.localhost"))
    )

    assert response.status_code == 400


def test_site_resolves_from_orbstack_style_subdomain(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr("agent_studio.settings.settings.workspace_root", str(tmp_path))
    monkeypatch.setattr("agent_studio.settings.settings.site_domain_suffixes", "agent-studio.orb.local")
    monkeypatch.setattr("agent_studio.settings.settings.admin_hosts", "admin.agent-studio.orb.local")
    site = tmp_path / "sites" / "starter"
    site.mkdir(parents=True)
    (site / "index.html").write_text("starter", encoding="utf-8")

    assert resolve_site_from_host("starter.agent-studio.orb.local") == "starter"
    assert resolve_site_from_host("admin.agent-studio.orb.local") is None


def test_site_resolves_from_site_json_custom_domain(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr("agent_studio.settings.settings.workspace_root", str(tmp_path))
    site = tmp_path / "sites" / "my-site"
    site.mkdir(parents=True)
    (site / "site.json").write_text(
        json.dumps({"domains": ["my-site.com", "www.my-site.com"]}),
        encoding="utf-8",
    )

    assert resolve_site_from_host("my-site.com") == "my-site"
    assert resolve_site_from_host("www.my-site.com") == "my-site"


def test_host_static_serves_site_root(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr("agent_studio.settings.settings.workspace_root", str(tmp_path))
    monkeypatch.setattr("agent_studio.settings.settings.site_domain_suffixes", "agent-studio.orb.local")
    site = tmp_path / "sites" / "starter"
    site.mkdir(parents=True)
    (site / "index.html").write_text("starter", encoding="utf-8")

    response = asyncio.run(
        serve_host_site(_make_request("", host="starter.agent-studio.orb.local"))
    )

    assert response.status_code == 200
