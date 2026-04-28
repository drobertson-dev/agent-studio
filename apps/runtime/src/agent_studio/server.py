from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import psycopg
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field
from starlette.responses import Response

from agent_studio.http.runtime_api import dispatch_api_request
from agent_studio.http.site_static import serve_host_site
from agent_studio.persistent_store import normalize_database_uri
from agent_studio.settings import settings

_HTTP_METHODS = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]


class CreateThreadRequest(BaseModel):
    assistant_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SearchThreadsRequest(BaseModel):
    metadata: dict[str, Any] | None = None
    limit: int = Field(default=100, ge=1, le=500)
    offset: int = Field(default=0, ge=0)
    select: list[str] | None = None
    extract: dict[str, str] | None = None


class RunStreamRequest(BaseModel):
    thread_id: str | None = None
    assistant_id: str = "agent"
    payload: dict[str, Any] = Field(default_factory=dict)


def _database_uri() -> str:
    return normalize_database_uri(settings.database_uri)


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _connect() -> psycopg.Connection:
    return psycopg.connect(_database_uri(), row_factory=dict_row)


def _workspace_root() -> Path:
    return Path(settings.workspace_root)


def _init_workspace() -> None:
    root = _workspace_root()
    (root / "sites").mkdir(parents=True, exist_ok=True)
    (root / "api").mkdir(parents=True, exist_ok=True)

    welcome = root / "sites" / "welcome" / "index.html"
    if not welcome.exists():
        welcome.parent.mkdir(parents=True, exist_ok=True)
        welcome.write_text(
            """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Agent Studio Welcome</title>
    <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
    <style>
      body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0d1117; color: #f6f8fa; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 32px; }
      section { width: min(760px, 100%); }
      h1 { font-size: clamp(2.25rem, 7vw, 5rem); line-height: .95; margin: 0 0 18px; letter-spacing: 0; }
      p { color: #b7c0cc; font-size: 1.05rem; line-height: 1.7; max-width: 620px; }
      a { color: #80d6ff; }
      .panel { border: 1px solid #303846; border-radius: 8px; padding: 16px; background: #151b23; margin-top: 28px; }
      code { color: #c9f088; }
    </style>
  </head>
  <body>
    <main id="app">
      <section>
        <h1>{{ title }}</h1>
        <p>
          This static page is served from <code>/workspace/sites/welcome/index.html</code>.
          Ask the studio agent to replace it with your first real site.
        </p>
        <div class="panel">
          Dynamic APIs live under <code>/workspace/api</code> and are exposed at
          <a href="/runtime-api/health">/runtime-api/health</a>.
        </div>
      </section>
    </main>
    <script>
      Vue.createApp({ data: () => ({ title: "Agent Studio is running." }) }).mount("#app")
    </script>
  </body>
</html>
""",
            encoding="utf-8",
        )

    health = root / "api" / "health.py"
    if not health.exists():
        health.write_text(
            """from __future__ import annotations


def get(request):
    return {
        "ok": True,
        "service": "agent-studio",
        "message": "Runtime API scripts are working.",
    }
""",
            encoding="utf-8",
        )


def _init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS studio_threads (
              thread_id TEXT PRIMARY KEY,
              assistant_id TEXT NOT NULL DEFAULT 'agent',
              metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
              values JSONB NOT NULL DEFAULT '{"messages":[]}'::jsonb,
              checkpoint_id TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'idle',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS studio_threads_updated_at_idx
            ON studio_threads (updated_at DESC)
            """
        )
        conn.commit()


def _coerce_values(values: Any) -> dict[str, Any]:
    if isinstance(values, dict):
        messages = values.get("messages")
        if isinstance(messages, list):
            return values
    return {"messages": []}


def _format_time(value: Any) -> str:
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    return str(value)


def _content_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text") or item.get("content")
                if isinstance(text, str):
                    parts.append(text)
        return " ".join(part.strip() for part in parts if part).strip()
    return ""


def _thread_response(row: Mapping[str, Any]) -> dict[str, Any]:
    values = _coerce_values(row.get("values"))
    messages = values.get("messages", [])
    preview = ""
    if isinstance(messages, list):
        for message in messages:
            if not isinstance(message, dict):
                continue
            if message.get("type") not in {"human", "user"}:
                continue
            preview = _content_to_text(message.get("content", ""))
            if preview:
                break

    return {
        "thread_id": row["thread_id"],
        "created_at": _format_time(row["created_at"]),
        "updated_at": _format_time(row["updated_at"]),
        "metadata": row.get("metadata") or {},
        "status": row.get("status") or "idle",
        "values": values,
        "extracted": {"preview": preview},
    }


def _history_response(row: Mapping[str, Any]) -> list[dict[str, Any]]:
    values = _coerce_values(row.get("values"))
    return [
        {
            "values": values,
            "checkpoint": {
                "checkpoint_id": row["checkpoint_id"],
                "thread_id": row["thread_id"],
            },
            "parent_checkpoint": None,
            "metadata": row.get("metadata") or {},
            "created_at": _format_time(row["updated_at"]),
            "tasks": [],
            "next": [],
        }
    ]


def _load_thread(thread_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM studio_threads WHERE thread_id = %s",
            (thread_id,),
        ).fetchone()
    return dict(row) if row else None


def _create_thread(
    assistant_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    thread_id: str | None = None,
) -> dict[str, Any]:
    metadata = dict(metadata or {})
    metadata.setdefault("graph_id", assistant_id or "agent")
    thread_id = thread_id or str(uuid.uuid4())
    checkpoint_id = str(uuid.uuid4())
    with _connect() as conn:
        row = conn.execute(
            """
            INSERT INTO studio_threads (thread_id, assistant_id, metadata, values, checkpoint_id)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                thread_id,
                assistant_id or "agent",
                Jsonb(metadata),
                Jsonb({"messages": []}),
                checkpoint_id,
            ),
        ).fetchone()
        conn.commit()
    if not row:
        raise RuntimeError("Thread creation failed")
    return dict(row)


def _save_values(thread_id: str, values: dict[str, Any], status: str = "idle") -> dict[str, Any]:
    checkpoint_id = str(uuid.uuid4())
    with _connect() as conn:
        row = conn.execute(
            """
            UPDATE studio_threads
            SET values = %s,
                checkpoint_id = %s,
                status = %s,
                updated_at = NOW()
            WHERE thread_id = %s
            RETURNING *
            """,
            (Jsonb(values), checkpoint_id, status, thread_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Thread not found")
    return dict(row)


def _save_values_if_present(thread_id: str, values: dict[str, Any], status: str = "idle") -> dict[str, Any] | None:
    try:
        return _save_values(thread_id, values, status)
    except HTTPException as exc:
        if exc.status_code == 404:
            return None
        raise


def _search_threads(body: SearchThreadsRequest) -> list[dict[str, Any]]:
    metadata_filter = body.metadata or {}
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM studio_threads
            WHERE (%s::jsonb = '{}'::jsonb OR metadata @> %s::jsonb)
            ORDER BY updated_at DESC
            LIMIT %s OFFSET %s
            """,
            (
                Jsonb(metadata_filter),
                Jsonb(metadata_filter),
                body.limit,
                body.offset,
            ),
        ).fetchall()
    return [dict(row) for row in rows]


def _delete_thread(thread_id: str) -> bool:
    with _connect() as conn:
        result = conn.execute("DELETE FROM studio_threads WHERE thread_id = %s", (thread_id,))
        conn.commit()
    return bool(result.rowcount)


def _message_type(message: Mapping[str, Any]) -> str:
    value = message.get("type") or message.get("role")
    if value == "user":
        return "human"
    if value == "assistant":
        return "ai"
    return str(value or "human")


def _dict_to_message(message: Mapping[str, Any]) -> BaseMessage:
    message_type = _message_type(message)
    content = message.get("content", "")
    message_id = message.get("id")
    additional_kwargs = message.get("additional_kwargs") if isinstance(message.get("additional_kwargs"), dict) else {}
    response_metadata = message.get("response_metadata") if isinstance(message.get("response_metadata"), dict) else {}

    if message_type == "ai":
        tool_calls = message.get("tool_calls") if isinstance(message.get("tool_calls"), list) else []
        return AIMessage(
            content=content,
            id=message_id,
            tool_calls=tool_calls,
            additional_kwargs=additional_kwargs,
            response_metadata=response_metadata,
        )
    if message_type == "tool":
        return ToolMessage(
            content=content,
            id=message_id,
            name=message.get("name"),
            tool_call_id=str(message.get("tool_call_id") or message.get("id") or uuid.uuid4()),
        )
    if message_type == "system":
        return SystemMessage(content=content, id=message_id)
    return HumanMessage(content=content, id=message_id)


def _message_to_dict(message: Any) -> dict[str, Any]:
    if isinstance(message, dict):
        result = dict(message)
    elif hasattr(message, "model_dump"):
        result = message.model_dump(mode="json", exclude_none=True)
    else:
        result = {"type": getattr(message, "type", "ai"), "content": getattr(message, "content", "")}

    result.setdefault("type", getattr(message, "type", result.get("type", "ai")))
    result.setdefault("id", str(uuid.uuid4()))

    if isinstance(result.get("tool_calls"), list):
        normalized_calls: list[dict[str, Any]] = []
        for call in result["tool_calls"]:
            if not isinstance(call, dict):
                continue
            normalized_calls.append(
                {
                    "id": call.get("id") or str(uuid.uuid4()),
                    "name": call.get("name"),
                    "args": call.get("args") or call.get("arguments") or {},
                    "type": call.get("type") or "tool_call",
                }
            )
        result["tool_calls"] = normalized_calls

    if result.get("type") == "tool" and "tool_call_id" not in result:
        result["tool_call_id"] = result.get("id")

    return result


def _merge_messages(existing: list[Any], incoming: list[Any]) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for raw in [*existing, *incoming]:
        if not isinstance(raw, dict):
            continue
        message = dict(raw)
        message_id = str(message.get("id") or uuid.uuid4())
        if message_id in seen_ids:
            continue
        message["id"] = message_id
        merged.append(message)
        seen_ids.add(message_id)

    return merged


def _normalize_graph_stream_item(item: Any) -> tuple[str, Any] | None:
    if isinstance(item, tuple):
        if len(item) == 2 and isinstance(item[0], str):
            return item[0], item[1]
        if len(item) == 3 and isinstance(item[1], str):
            return item[1], item[2]
    return None


async def _stream_agent(messages: list[dict[str, Any]], thread_id: str) -> AsyncIterator[tuple[str, Any]]:
    from agent_studio.app.agent import agent

    lc_messages = [_dict_to_message(message) for message in messages]
    async for item in agent.astream(
        {"messages": lc_messages},
        config={
            "configurable": {
                "thread_id": thread_id,
                "project_slug": "agent-studio",
            }
        },
        stream_mode=["messages", "values"],
    ):
        normalized = _normalize_graph_stream_item(item)
        if normalized is None:
            continue
        mode, chunk = normalized
        if mode == "messages":
            message = chunk[0] if isinstance(chunk, tuple) and chunk else chunk
            yield "messages", [_message_to_dict(message)]
        elif mode == "values" and isinstance(chunk, dict):
            raw_messages = chunk.get("messages", [])
            if isinstance(raw_messages, list):
                yield "values", {"messages": [_message_to_dict(message) for message in raw_messages]}


def _stream_line(event: str, data: Any) -> str:
    return json.dumps({"event": event, "data": data}, separators=(",", ":"), default=str) + "\n"


def _request_with_path(request: Request, path: str) -> Request:
    request.scope["path_params"] = {**request.path_params, "path": path}
    return request


@asynccontextmanager
async def lifespan(_: FastAPI):
    await asyncio.to_thread(_init_workspace)
    await asyncio.to_thread(_init_db)
    yield


app = FastAPI(title="Agent Studio Runtime", version="0.1.0", lifespan=lifespan)


@app.get("/info")
async def info() -> dict[str, Any]:
    return {
        "ok": True,
        "service": settings.service_name,
        "graph_id": "agent",
        "model": settings.agent_model,
        "workspace_root": settings.workspace_root,
        "site_url_pattern": "https://<site-name>.<site-domain-suffix>/",
        "runtime_api_url_pattern": "/runtime-api/<route>",
        "time": _now(),
    }


@app.post("/threads")
async def create_thread(body: CreateThreadRequest | None = None) -> dict[str, Any]:
    body = body or CreateThreadRequest()
    row = await asyncio.to_thread(_create_thread, body.assistant_id or "agent", body.metadata)
    return _thread_response(row)


@app.post("/threads/search")
async def search_threads(body: SearchThreadsRequest | None = None) -> list[dict[str, Any]]:
    body = body or SearchThreadsRequest()
    rows = await asyncio.to_thread(_search_threads, body)
    return [_thread_response(row) for row in rows]


@app.get("/threads/{thread_id}/history")
async def thread_history(thread_id: str, limit: int = 5) -> list[dict[str, Any]]:
    del limit
    row = await asyncio.to_thread(_load_thread, thread_id)
    if row is None:
        return []
    return _history_response(row)


@app.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str) -> dict[str, bool]:
    deleted = await asyncio.to_thread(_delete_thread, thread_id)
    return {"deleted": deleted}


@app.post("/runs/stream")
async def run_stream(body: RunStreamRequest) -> StreamingResponse:
    thread_id = body.thread_id or str(uuid.uuid4())
    row = await asyncio.to_thread(_load_thread, thread_id)
    if row is None:
        row = await asyncio.to_thread(
            _create_thread,
            body.assistant_id,
            {"graph_id": body.assistant_id},
            thread_id,
        )

    existing_values = _coerce_values(row.get("values"))
    existing_messages = existing_values.get("messages", [])
    input_values = body.payload.get("input") if isinstance(body.payload.get("input"), dict) else {}
    incoming_messages = input_values.get("messages", []) if isinstance(input_values, dict) else []

    if not isinstance(existing_messages, list):
        existing_messages = []
    if not isinstance(incoming_messages, list):
        incoming_messages = []

    messages = _merge_messages(existing_messages, incoming_messages)

    async def event_stream() -> AsyncIterator[str]:
        started = await asyncio.to_thread(_save_values_if_present, thread_id, {"messages": messages}, "running")
        if started is None:
            yield _stream_line("error", {"message": "Thread not found", "name": "ThreadNotFound"})
            return

        yield _stream_line("metadata", {"thread_id": thread_id})

        latest_values: dict[str, Any] = {"messages": messages}
        try:
            async for event, data in _stream_agent(messages, thread_id):
                if event == "values" and isinstance(data, dict):
                    latest_values = _coerce_values(data)
                yield _stream_line(event, data)
        except Exception as exc:
            await asyncio.to_thread(_save_values_if_present, thread_id, {"messages": messages}, "error")
            yield _stream_line("error", {"message": str(exc), "name": exc.__class__.__name__})
            return

        saved = await asyncio.to_thread(_save_values_if_present, thread_id, latest_values, "idle")
        if saved is None:
            yield _stream_line("metadata", {"thread_id": thread_id, "status": "deleted"})
            return

        yield _stream_line("values", _coerce_values(saved.get("values")))
        yield _stream_line(
            "metadata",
            {
                "checkpoint": {
                    "checkpoint_id": saved["checkpoint_id"],
                    "thread_id": thread_id,
                }
            },
        )

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@app.api_route("/api", methods=_HTTP_METHODS)
async def dynamic_api_root(request: Request) -> Response:
    return await dispatch_api_request(_request_with_path(request, ""))


@app.api_route("/api/{path:path}", methods=_HTTP_METHODS)
async def dynamic_api(path: str, request: Request) -> Response:
    return await dispatch_api_request(_request_with_path(request, path))


@app.api_route("/runtime-api", methods=_HTTP_METHODS)
async def runtime_api_root(request: Request) -> Response:
    return await dispatch_api_request(_request_with_path(request, ""))


@app.api_route("/runtime-api/{path:path}", methods=_HTTP_METHODS)
async def runtime_api(path: str, request: Request) -> Response:
    return await dispatch_api_request(_request_with_path(request, path))


@app.api_route("/{path:path}", methods=["GET", "HEAD"])
async def host_site(path: str, request: Request) -> Response:
    return await serve_host_site(_request_with_path(request, path))
