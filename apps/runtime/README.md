# Agent Studio Runtime

FastAPI runtime for Agent Studio.

It provides:

- a minimal thread/run streaming API used by the Nuxt studio UI
- a DeepAgents/LangGraph builder agent
- Postgres-backed thread state and store-backed `/memories` and `/artifacts`
- host-based static site serving from `/workspace/sites`
- dynamic Python API scripts from `/workspace/api`

Important routes:

```text
GET  /info
POST /threads
POST /threads/search
GET  /threads/{thread_id}/history
POST /runs/stream
GET  /{path}                     host-mapped public site route
ANY  /runtime-api/{route}
```

Published sites should normally be reached by host, for example
`acme.agent-studio.orb.local` or a custom domain listed in
`/workspace/sites/acme/site.json`.

Run tests:

```bash
uv run --python 3.13 --extra dev pytest -q
```
