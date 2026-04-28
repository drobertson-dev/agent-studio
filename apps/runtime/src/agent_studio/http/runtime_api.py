from __future__ import annotations

import hashlib
import inspect
import logging
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from threading import Lock
from types import ModuleType
from typing import Any

from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse, Response

from agent_studio.settings import settings

logger = logging.getLogger(__name__)

_HTTP_METHODS = ("DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT")
_HTTP_METHOD_NAMES = tuple(method.lower() for method in _HTTP_METHODS)
_MODULE_CACHE_LOCK = Lock()


@dataclass
class _CachedModule:
    content_hash: str
    module: ModuleType


_MODULE_CACHE: dict[Path, _CachedModule] = {}


def api_root() -> Path:
    return Path(settings.workspace_root) / "api"


def _normalize_api_path(path: str) -> tuple[str, ...]:
    cleaned = path.strip("/")
    if not cleaned:
        return ()

    parts = tuple(part for part in PurePosixPath(f"/{cleaned}").parts if part not in ("", "/"))
    if any(part in {".", ".."} for part in parts):
        raise ValueError("Invalid API path.")
    return parts


def resolve_api_script(path: str) -> Path | None:
    root = api_root().resolve()
    parts = _normalize_api_path(path)
    if not parts:
        candidates = [root / "index.py"]
    else:
        base = root.joinpath(*parts)
        candidates = [base.with_suffix(".py"), base / "index.py"]

    for candidate in candidates:
        try:
            resolved = candidate.resolve(strict=True)
        except FileNotFoundError:
            continue
        if resolved.is_file() and resolved.is_relative_to(root):
            return resolved
    return None


def _module_name(script_path: Path) -> str:
    digest = hashlib.sha256(str(script_path).encode("utf-8")).hexdigest()[:16]
    return f"agent_studio_dynamic_api_{digest}"


def load_api_module(script_path: Path) -> ModuleType:
    source = script_path.read_text(encoding="utf-8")
    content_hash = hashlib.sha256(source.encode("utf-8")).hexdigest()

    with _MODULE_CACHE_LOCK:
        cached = _MODULE_CACHE.get(script_path)
        if cached is not None and cached.content_hash == content_hash:
            return cached.module

    module = ModuleType(_module_name(script_path))
    module.__file__ = str(script_path)
    code = compile(source, str(script_path), "exec")
    exec(code, module.__dict__)

    with _MODULE_CACHE_LOCK:
        _MODULE_CACHE[script_path] = _CachedModule(content_hash=content_hash, module=module)
    return module


def _allowed_methods(module: ModuleType) -> list[str]:
    methods = [name.upper() for name in _HTTP_METHOD_NAMES if callable(getattr(module, name, None))]
    if callable(getattr(module, "handle", None)):
        return list(_HTTP_METHODS)
    return methods


def _resolve_handler(module: ModuleType, method: str):
    lowered = method.lower()
    handler = getattr(module, lowered, None)
    if handler is None and lowered == "head":
        handler = getattr(module, "get", None)
    if handler is None:
        handler = getattr(module, "handle", None)
    return handler


def _coerce_response(result: Any) -> Response:
    if isinstance(result, Response):
        return result
    if result is None:
        return Response(status_code=204)

    if isinstance(result, tuple):
        if len(result) == 2:
            body, status_code = result
            headers = None
        elif len(result) == 3:
            body, status_code, headers = result
        else:
            raise TypeError("API handlers may return (body, status) or (body, status, headers).")
        response = _coerce_response(body)
        response.status_code = status_code
        if headers:
            response.headers.update(headers)
        return response

    if isinstance(result, (dict, list, int, float, bool)):
        return JSONResponse(result)
    if isinstance(result, bytes):
        return Response(content=result, media_type="application/octet-stream")
    return PlainTextResponse(str(result))


async def dispatch_api_request(request: Request) -> Response:
    route_path = request.path_params.get("path", "")
    try:
        script_path = resolve_api_script(route_path)
    except ValueError as exc:
        return PlainTextResponse(str(exc), status_code=400)

    if script_path is None:
        return PlainTextResponse("API route not found.", status_code=404)

    try:
        module = load_api_module(script_path)
    except Exception as exc:  # pragma: no cover - runtime integration
        logger.exception("Failed to load API script %s", script_path)
        return PlainTextResponse(f"Failed to load API script: {exc}", status_code=500)

    allowed_methods = _allowed_methods(module)
    handler = _resolve_handler(module, request.method)

    if request.method == "OPTIONS" and handler is None:
        headers = {"Allow": ", ".join(allowed_methods)} if allowed_methods else {}
        return Response(status_code=204, headers=headers)

    if handler is None:
        headers = {"Allow": ", ".join(allowed_methods)} if allowed_methods else {}
        return PlainTextResponse("Method not allowed.", status_code=405, headers=headers)

    try:
        result = handler(request)
        if inspect.isawaitable(result):
            result = await result
        return _coerce_response(result)
    except Exception as exc:  # pragma: no cover - runtime integration
        logger.exception("API handler failed for %s", script_path)
        return PlainTextResponse(f"API handler error: {exc}", status_code=500)
