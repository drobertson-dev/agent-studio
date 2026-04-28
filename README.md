# Agent Studio

Agent Studio is a self-hosted AI application studio: a Docker-deployable runtime plus a Nuxt chat UI where an agent can build and operate websites, dashboards, API routes, workflows, artifacts, and specialized agent apps.

Think of it as a small open-source base for "WordPress for the AI age." You start the stack, log in, and ask the agent to build inside the already-running workspace.

## What Is Included

- `apps/runtime`: FastAPI runtime with a DeepAgents/LangGraph agent inside.
- `apps/web`: Nuxt/Vue studio UI with auth, thread history, streaming, tool-call visibility, and thread management.
- `docker-compose.yml`: VPS/Coolify-friendly stack with Caddy, Nuxt admin UI, runtime, Postgres, and Redis.
- `/workspace/sites/<site-name>/`: generated static sites served by hostname.
- `/workspace/api/*.py`: generated Python API scripts served at `/runtime-api/*`.
- `/memories` and `/artifacts`: persistent DeepAgents file memory backed by Postgres.

## Runtime Modes

Agent Studio is intended to support two product shapes:

- **Builder Host Mode:** use the studio agent to build a site/app/workflow in the running workspace.
- **Agent App Mode:** specialize the repo into a focused agent application with domain-specific tools, prompts, evals, and UI copy.

The newer UI and minimal runtime API bridge came from a specialized agent-app prototype. This repo strips that domain layer back out and keeps the reusable host.

## Local / VPS Setup

Copy the environment template:

```bash
cp .env.example .env
```

Set at least:

```bash
STUDIO_PASSWORD=your-login-password
AUTH_SECRET=long-random-session-secret
DEFAULT_AGENT_MODEL=anthropic:claude-opus-4-6
ANTHROPIC_API_KEY=...
```

Run the stack:

```bash
docker compose up --build
```

Open `http://localhost`, log in with `STUDIO_PASSWORD`, and send the starter prompt. The runtime also creates:

- `http://welcome.localhost`
- `http://localhost/runtime-api/health`

For OrbStack, the admin service is intended to be used as `admin.agent-studio.orb.local`. The Caddy service claims `*.agent-studio.orb.local`, so generated sites are available at `https://<site-name>.agent-studio.orb.local/` without editing `/etc/hosts`.

## Public Site Routing

The admin UI and public sites should not share one path tree. Agent Studio treats the admin app as the control plane and sites as virtual hosts:

```text
admin.my-site.com -> Studio UI
my-site.com       -> /workspace/sites/my-site/
www.my-site.com   -> /workspace/sites/my-site/
```

For local/generated subdomains, configure:

```env
SITE_DOMAIN_SUFFIXES=localhost,agent-studio.orb.local
```

Then this site:

```text
/workspace/sites/acme/index.html
```

is available at:

```text
http://acme.localhost/
https://acme.agent-studio.orb.local/
```

OrbStack wildcard domains are provided by the Caddy service label in `docker-compose.yml`. If you rename the compose project or local base domain, update both `SITE_DOMAIN_SUFFIXES` and that label together.

For real customer domains, add a `site.json` beside the site's `index.html`:

```json
{
  "domains": ["my-site.com", "www.my-site.com"]
}
```

## Dynamic Sites

Create files under the runtime workspace:

```text
/workspace/sites/acme/index.html
```

They are served by hostname:

```text
https://acme.<configured-site-domain-suffix>/
```

Generated static sites can be plain HTML, CSS, and Vue 3 from a CDN.

## Dynamic Runtime APIs

Create Python scripts under:

```text
/workspace/api
```

Examples:

```text
/workspace/api/contact.py -> /runtime-api/contact
/workspace/api/forms/submit.py -> /runtime-api/forms/submit
```

Scripts can export `get`, `post`, `put`, `patch`, `delete`, or `handle(request)`.

```python
def get(request):
    return {"ok": True}
```

## Development Commands

Runtime tests:

```bash
cd apps/runtime
uv run --python 3.13 --extra dev pytest -q
```

Frontend tests:

```bash
pnpm --dir apps/web test -- --run
```

Frontend build:

```bash
pnpm --dir apps/web build
```

Compose validation:

```bash
pnpm run compose:config
```

Full check:

```bash
pnpm run verify
```

## Notes

- The current embedded harness uses DeepAgents/LangGraph with provider API keys.
- ACP-style external harness adapters are a natural future extension, but are not in this first cut.
- Docker Compose is the primary open-source deployment target. Cloud-specific adapters can come later.
