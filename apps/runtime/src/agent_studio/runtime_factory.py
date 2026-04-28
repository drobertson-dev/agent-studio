from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from langgraph.store.base import BaseStore

from agent_studio.backend import BackendFactory, build_runtime_backend


@lru_cache(maxsize=1)
def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


@lru_cache(maxsize=1)
def get_runtime_backend() -> tuple[BackendFactory, BaseStore | None]:
    return build_runtime_backend(get_project_root())
