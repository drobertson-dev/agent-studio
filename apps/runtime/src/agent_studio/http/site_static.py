from __future__ import annotations

import json
import re
from pathlib import PurePosixPath

from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import PlainTextResponse, Response
from starlette.staticfiles import StaticFiles

from agent_studio.settings import settings

_STATIC_CACHE: tuple[str, StaticFiles] | None = None
_SAFE_SITE_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")


def _csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip().lower() for part in value.split(",") if part.strip()]


def _sites_root() -> str:
    return f"{settings.workspace_root}/sites"


def _site_static() -> StaticFiles:
    global _STATIC_CACHE
    root = _sites_root()
    if _STATIC_CACHE is None or _STATIC_CACHE[0] != root:
        _STATIC_CACHE = (root, StaticFiles(directory=root, html=True, check_dir=False))
    return _STATIC_CACHE[1]


def _normalize_host(host: str | None) -> str:
    if not host:
        return ""
    host = host.strip().lower()
    if host.startswith("["):
        return host.split("]", 1)[0].lstrip("[")
    return host.rsplit(":", 1)[0] if ":" in host else host


def _host_from_request(request: Request) -> str:
    return _normalize_host(request.headers.get("host"))


def _is_safe_site_name(site: str) -> bool:
    return bool(_SAFE_SITE_RE.fullmatch(site))


def _site_exists(site: str) -> bool:
    return _is_safe_site_name(site) and (PurePosixPath(site).name == site)


def _site_config_domains(site: str) -> list[str]:
    if not _site_exists(site):
        return []

    from pathlib import Path

    config_path = Path(settings.workspace_root) / "sites" / site / "site.json"
    if not config_path.exists():
        return []

    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    domains: list[str] = []
    for key in ("domain", "primary_domain"):
        value = config.get(key)
        if isinstance(value, str):
            domains.append(value)
    for key in ("domains", "hostnames", "hosts"):
        value = config.get(key)
        if isinstance(value, list):
            domains.extend(item for item in value if isinstance(item, str))
    return [_normalize_host(domain) for domain in domains if _normalize_host(domain)]


def _all_site_names() -> list[str]:
    from pathlib import Path

    sites_root = Path(settings.workspace_root) / "sites"
    if not sites_root.exists():
        return []
    return sorted(path.name for path in sites_root.iterdir() if path.is_dir() and _is_safe_site_name(path.name))


def _custom_domain_site(host: str) -> str | None:
    for site in _all_site_names():
        if host in _site_config_domains(site):
            return site
    return None


def _suffix_site(host: str) -> str | None:
    for suffix in _csv(settings.site_domain_suffixes):
        suffix = suffix.removeprefix(".")
        if not suffix:
            continue
        if host == suffix:
            return settings.default_site if settings.default_site and _is_safe_site_name(settings.default_site) else None
        if host.endswith(f".{suffix}"):
            site = host[: -len(suffix) - 1].split(".")[-1]
            if _is_safe_site_name(site):
                return site
    return None


def resolve_site_from_host(host: str | None) -> str | None:
    """Resolve a public hostname to a workspace site name."""

    normalized = _normalize_host(host)
    if not normalized:
        return None

    if normalized in _csv(settings.admin_hosts) or normalized.startswith("admin."):
        return None

    if settings.default_site and normalized in _csv(settings.default_site_hosts):
        return settings.default_site if _is_safe_site_name(settings.default_site) else None

    return _custom_domain_site(normalized) or _suffix_site(normalized)


def public_urls_for_site(site: str) -> list[str]:
    urls: list[str] = []
    urls.extend(f"https://{domain}" for domain in _site_config_domains(site))

    for suffix in _csv(settings.site_domain_suffixes):
        suffix = suffix.removeprefix(".")
        if suffix and _is_safe_site_name(site):
            urls.append(f"https://{site}.{suffix}")

    return [*dict.fromkeys(urls)]


def _safe_site_path(path: str) -> tuple[str | None, str, str]:
    parts = [part for part in PurePosixPath("/" + path.strip("/")).parts if part not in ("", "/")]
    if any(part in {".", ".."} for part in parts):
        raise ValueError("Invalid site path.")
    if not parts:
        return None, "", ""

    site = parts[0]
    relative_parts = parts[1:]
    relative_path = "/".join(relative_parts)
    if path.endswith("/") and relative_path:
        relative_path = f"{relative_path}/"

    safe_raw_path = "/".join(parts)
    if path.endswith("/") and safe_raw_path:
        safe_raw_path = f"{safe_raw_path}/"
    return site, relative_path, safe_raw_path


async def serve_host_site(request: Request) -> Response:
    site = resolve_site_from_host(_host_from_request(request))
    if site is None:
        return PlainTextResponse("No site mapped to this host.", status_code=404)

    raw_path = request.path_params.get("path", "")
    try:
        _site, relative_path, _safe_raw_path = _safe_site_path(f"{site}/{raw_path}")
    except ValueError as exc:
        return PlainTextResponse(str(exc), status_code=400)

    static_path = site
    if relative_path:
        static_path = f"{site}/{relative_path}"
    elif raw_path.endswith("/"):
        static_path = f"{site}/"

    try:
        return await _site_static().get_response(static_path, request.scope)
    except HTTPException as exc:
        return PlainTextResponse("Site route not found.", status_code=exc.status_code)
