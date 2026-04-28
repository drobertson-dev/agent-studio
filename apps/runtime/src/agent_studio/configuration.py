from __future__ import annotations

from pydantic import BaseModel, Field


class RuntimeContext(BaseModel):
    """Context supplied by LangGraph for a run."""

    thread_id: str | None = Field(default=None, description="Unique thread identifier.")
    project_slug: str | None = Field(default="agent-studio", description="Project slug.")
