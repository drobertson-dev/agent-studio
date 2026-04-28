from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

from deepagents.backends import (
    CompositeBackend,
    FilesystemBackend,
    StateBackend,
    StoreBackend,
)
from deepagents.backends.local_shell import LocalShellBackend
from deepagents.backends.protocol import BackendProtocol
from langchain.tools import ToolRuntime
from langgraph.store.base import BaseStore
from langgraph.store.memory import InMemoryStore

from agent_studio.persistent_store import PostgresStore, file_value
from agent_studio.settings import settings

BackendFactory = Callable[[ToolRuntime], BackendProtocol]


def build_runtime_backend(project_root: Path) -> tuple[BackendFactory, BaseStore | None]:
    """Build a Docker-friendly backend for DeepAgents."""

    project_root = project_root.resolve()

    def _backend(runtime: ToolRuntime) -> BackendProtocol:
        if settings.dev_mode:
            default_backend = FilesystemBackend(root_dir=str(project_root), virtual_mode=True)
        else:
            default_backend = LocalShellBackend(root_dir=settings.workspace_root, inherit_env=True)

        if getattr(runtime, "store", None) is None:
            return default_backend

        return CompositeBackend(
            default=default_backend,
            routes={
                "/memories/": StoreBackend(runtime),
                "/artifacts/": StoreBackend(runtime),
                "/conversation_history/": StateBackend(runtime),
            },
        )

    store: BaseStore | None = InMemoryStore() if settings.dev_mode else PostgresStore(settings.database_uri)
    _seed_store_memory(store)
    return _backend, store


def _seed_store_memory(store: BaseStore | None) -> None:
    if store is None:
        return

    store.put(
        ("filesystem",),
        "/operator.md",
        file_value(
            "\n".join(
                [
                    "# Agent Studio Operator Memory",
                    "",
                    "- This is a generic self-hosted AI application host owned by the operator.",
                    "- Build static sites in `/workspace/sites/<site-name>/` and present host-based public URLs.",
                    "- Keep durable operator/project context in `/memories/` and build state in `/artifacts/`.",
                    "- Prefer Vue 3 from a CDN for generated lightweight sites unless a full frontend build is requested.",
                ]
            )
        ),
    )
    store.put(
        ("filesystem",),
        "/projects/active-project.md",
        file_value(
            "\n".join(
                [
                    "# Active Project",
                    "",
                    "- No active project has been defined yet.",
                ]
            )
        ),
    )
    store.put(
        ("filesystem",),
        "/projects/active-project/current-state.md",
        file_value(
            "\n".join(
                [
                    "# Current State",
                    "",
                    "- The workspace is ready for generated sites, API routes, artifacts, and notes.",
                ]
            )
        ),
    )
