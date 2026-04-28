from __future__ import annotations

from pathlib import Path
from typing import cast

from deepagents import create_deep_agent
from langchain.agents.middleware import AgentMiddleware

from agent_studio.configuration import RuntimeContext
from agent_studio.runtime_factory import get_runtime_backend
from agent_studio.settings import settings
from agent_studio.tools import list_studio_routes, runtime_status

PROMPT_PATH = Path(__file__).resolve().parent / "PROMPT.md"
SYSTEM_PROMPT = PROMPT_PATH.read_text(encoding="utf-8")

backend_factory, store = get_runtime_backend()

agent = create_deep_agent(
    name="agent",
    model=settings.agent_model,
    tools=[runtime_status, list_studio_routes],
    system_prompt=SYSTEM_PROMPT,
    context_schema=RuntimeContext,
    backend=backend_factory,
    store=store,
    memory=[
        "/memories/operator.md",
        "/memories/projects/active-project.md",
        "/artifacts/projects/active-project/current-state.md",
    ],
    middleware=cast(list[AgentMiddleware], []),
)
