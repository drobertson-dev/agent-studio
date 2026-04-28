from __future__ import annotations

from pathlib import Path
from typing import Any

from langchain.tools import ToolRuntime
from langchain_core.tools import tool

from agent_studio.configuration import RuntimeContext
from agent_studio.http.site_static import public_urls_for_site
from agent_studio.settings import settings


def _workspace_path(*parts: str) -> Path:
    return Path(settings.workspace_root).joinpath(*parts)


def _relative_files(root: Path) -> list[str]:
    if not root.exists():
        return []
    return sorted(
        f"/{path.relative_to(root).as_posix()}"
        for path in root.rglob("*")
        if path.is_file() and not any(part.startswith(".") for part in path.relative_to(root).parts)
    )


@tool
def runtime_status(runtime: ToolRuntime[RuntimeContext]) -> dict[str, Any]:
    """Return core Agent Studio runtime paths, URLs, and active context."""

    context = getattr(runtime, "context", None)
    workspace_root = Path(settings.workspace_root)
    return {
        "service_name": settings.service_name,
        "workspace_root": str(workspace_root),
        "sites_root": str(workspace_root / "sites"),
        "api_root": str(workspace_root / "api"),
        "artifacts_root": "/artifacts",
        "memories_root": "/memories",
        "site_url_pattern": "https://<site-name>.<site-domain-suffix>/",
        "site_domain_suffixes": settings.site_domain_suffixes,
        "admin_hosts": settings.admin_hosts,
        "runtime_api_url_pattern": "/runtime-api/<route>",
        "internal_api_url_pattern": "/api/<route>",
        "database_configured": bool(settings.database_uri),
        "thread_id": getattr(context, "thread_id", None) if context is not None else None,
        "project_slug": getattr(context, "project_slug", None) if context is not None else None,
    }


@tool
def list_studio_routes() -> dict[str, list[str]]:
    """List currently published static sites and dynamic runtime API scripts."""

    sites_root = _workspace_path("sites")
    api_root = _workspace_path("api")
    sites: list[str] = []
    if sites_root.exists():
        for path in sorted(sites_root.iterdir()):
            if path.is_dir() and not path.name.startswith("."):
                sites.append(path.name)

    api_scripts = _relative_files(api_root)
    return {
        "sites": sites,
        "site_public_urls": [url for site in sites for url in public_urls_for_site(site)],
        "api_scripts": api_scripts,
        "runtime_api_routes": [
            f"/runtime-api{script[:-3] if script.endswith('.py') else script}"
            for script in api_scripts
            if script.endswith(".py")
        ],
    }
