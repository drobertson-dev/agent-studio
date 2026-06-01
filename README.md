# Agent Studio

[![Release](https://img.shields.io/github/v/release/drobertson-dev/agent-studio?sort=semver)](https://github.com/drobertson-dev/agent-studio/releases)
[![CI](https://github.com/drobertson-dev/agent-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/drobertson-dev/agent-studio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.13](https://img.shields.io/badge/python-3.13-blue)](apps/runtime/pyproject.toml)
[![Node >=22](https://img.shields.io/badge/node-%3E%3D22-green)](package.json)

Agent Studio is a self-hosted AI application studio: a Docker-deployable runtime plus a Nuxt chat UI where an agent can build and operate websites, dashboards, API routes, workflows, artifacts, and specialized agent apps.

The basic idea is "WordPress for the AI age." You start the stack, log in to the studio, and ask the agent to build inside the already-running workspace. The agent can create static sites, add Python API routes, connect to the configured database, and keep iterating without a separate cloud platform.

## Why This Exists

Most agent demos stop at chat, code generation, or a one-off local project. Agent Studio explores a more durable shape: an agent-owned application workspace that is already deployed, routable, and persistent. It is maintained as an open-source base for people who want to build real sites, dashboards, and specialized agent apps without being locked into a proprietary control plane or a telemetry-heavy hosted runtime.

## What Is Included

- `apps/runtime`: FastAPI runtime with a DeepAgents/LangGraph agent inside.
- `apps/web`: Nuxt/Vue studio UI with login, thread history, streaming, tool-call visibility, and thread management.
- `docker-compose.yml`: VPS/Coolify-friendly stack with Caddy, Nuxt admin UI, runtime, Postgres, and Redis.
- `/workspace/sites/<site-name>/`: generated static sites served by hostname.
- `/workspace/api/*.py`: generated Python API scripts served at `/runtime-api/*`.
- `/memories` and `/artifacts`: persistent DeepAgents file memory backed by Postgres.

## How It Works

```text
Browser
  |
  v
Caddy edge
  |-- admin host, for example admin.example.com -> Nuxt studio UI
  |-- /runtime-api/* ---------------------------> runtime API scripts
  `-- site hosts, for example example.com ------> generated static sites

Nuxt studio UI
  |
  v
FastAPI runtime
  |
  |-- DeepAgents/LangGraph agent
  |-- /workspace/sites for generated sites
  |-- /workspace/api for dynamic routes
  |-- Postgres for threads, store, and persistence
  `-- Redis for runtime support
```

The admin UI and public sites are intentionally separate. A user should visit `my-site.com` for the generated site and `admin.my-site.com` for the control plane, rather than mixing the admin app and public site under one path tree.

## Runtime Modes

Agent Studio is intended to support two product shapes:

- **Builder Host Mode:** use the studio agent to build a site, dashboard, API, workflow, or small app in the running workspace.
- **Agent App Mode:** specialize the repo into a focused agent application with domain-specific tools, prompts, evals, and UI copy.

The current repo is the reusable host. Specialized agents can be built on top of it.

## Project Status

Current release: `v0.1.2`

Agent Studio is early but usable. The initial release focuses on the self-hosted runtime, admin UI, host-based site publishing, dynamic API routes, persistence, Docker Compose deployment, and clear local development flows. Public APIs and internal extension points may change before `v1.0.0`.

## Quick Start

Prerequisites:

- Docker Engine with Docker Compose.
- A model provider API key for the default embedded harness, such as Anthropic or OpenAI.

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

Or use an OpenAI model/key instead:

```bash
DEFAULT_AGENT_MODEL=openai:<model-name>
OPENAI_API_KEY=...
```

Start the stack:

```bash
docker compose up -d --build
```

Open the admin UI:

```text
http://localhost/
```

Log in with `STUDIO_PASSWORD`, then send the starter prompt from the UI.

The runtime creates a starter site and API:

```text
http://welcome.localhost/
http://localhost/runtime-api/health
```

## OrbStack Local URLs

With OrbStack, the Caddy service claims the wildcard domain `*.agent-studio.orb.local`.

Use:

```text
https://admin.agent-studio.orb.local/
https://welcome.agent-studio.orb.local/
https://<site-name>.agent-studio.orb.local/
```

The wildcard is configured by the `dev.orbstack.domains` label on the Caddy service in `docker-compose.yml`. If you rename the compose project or local base domain, update both that label and `SITE_DOMAIN_SUFFIXES`.

## Public Site Routing

Agent Studio treats the admin app as the control plane and sites as virtual hosts:

```text
admin.my-site.com -> Studio UI
my-site.com       -> /workspace/sites/my-site/
www.my-site.com   -> /workspace/sites/my-site/
```

For generated subdomains, configure:

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

For real customer domains, add a `site.json` beside the site's `index.html`:

```json
{
  "domains": ["my-site.com", "www.my-site.com"]
}
```

Then point those DNS records at the server running Caddy.

## Generated Static Sites

Create files under:

```text
/workspace/sites/<site-name>/
```

The root page should usually be:

```text
/workspace/sites/<site-name>/index.html
```

Generated static sites can be plain HTML, CSS, and Vue 3 from a CDN. That is the preferred default for lightweight generated websites because it keeps the generated site inspectable and easy to serve without a separate frontend build step.

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

Scripts can export HTTP-method functions:

```python
def get(request):
    return {"ok": True}

async def post(request):
    body = await request.json()
    return {"received": body}
```

They can also export a generic handler:

```python
async def handle(request):
    return {"method": request.method}
```

## Deploy With Docker Compose

Agent Studio is designed to deploy to a normal Linux VM, a homelab server, or a Docker host managed by something like Coolify.

1. Point DNS at the server:

```text
admin.example.com -> server IP
*.example.com     -> server IP
example.com       -> server IP, optional
```

2. Copy `.env.example` to `.env` on the server and set production values:

```env
APP_DOMAIN=:80
STUDIO_PASSWORD=change-this
AUTH_SECRET=long-random-session-secret
POSTGRES_PASSWORD=long-random-database-password
ADMIN_HOST_REGEX=^(admin\.example\.com)(:\d+)?$
ADMIN_HOSTS=admin.example.com
SITE_DOMAIN_SUFFIXES=example.com
ANTHROPIC_API_KEY=...
```

Use `APP_DOMAIN=:80` behind a platform proxy, load balancer, Cloudflare tunnel, or Coolify-style edge that owns TLS and forwards HTTP to this stack.

If stock Caddy should manage public TLS directly for fixed hostnames, set `APP_DOMAIN` to the exact hostnames Caddy should answer for, such as `admin.example.com,example.com,www.example.com`, and set `ACME_EMAIL`. Dynamic wildcard HTTPS for `*.example.com` requires an external wildcard TLS layer or a Caddy build configured for DNS-challenge certificates.

3. Start the stack:

```bash
docker compose up -d --build
```

4. Open the admin UI with the scheme handled by your edge:

```text
https://admin.example.com/
```

5. Ask the agent to build a site under `/workspace/sites/<site-name>/`.

For GitHub Actions deployment to a VM, see [docs/github-actions-vm-deploy.md](docs/github-actions-vm-deploy.md).

## Environment Variables

Core settings:

```text
APP_DOMAIN              Caddy site address, often :80 behind a proxy.
ACME_EMAIL              Optional email for Caddy-managed TLS.
HTTP_PORT               Host port mapped to container port 80.
HTTPS_PORT              Host port mapped to container port 443.
STUDIO_PASSWORD         Password for the admin UI.
AUTH_SECRET             Long random value used to sign auth cookies.
POSTGRES_PASSWORD       Database password for the Compose Postgres service.
DEFAULT_AGENT_MODEL     Model identifier passed to the embedded agent harness.
ANTHROPIC_API_KEY       Anthropic provider key, optional if another provider is set.
OPENAI_API_KEY          OpenAI provider key, optional if another provider is set.
ADMIN_HOST_REGEX        Hosts routed to the Nuxt admin UI.
ADMIN_HOSTS             Hosts ignored by public site resolution.
SITE_DOMAIN_SUFFIXES    Suffixes used for generated subdomain sites.
DEFAULT_SITE            Optional default site for bare configured hosts.
DEFAULT_SITE_HOSTS      Optional hosts mapped to DEFAULT_SITE.
```

## Development Commands

Install JavaScript dependencies:

```bash
pnpm install
```

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

## Security Notes

- Do not commit `.env`; it is intentionally ignored.
- Change all placeholder secrets before a shared or public deployment.
- The admin UI is password-gated, but generated public sites are public by design.
- Runtime API scripts are code. Treat access to the studio as privileged.
- Review generated code before using this for sensitive production workloads.

## Roadmap

- First-run setup for password/model/provider configuration.
- Studio panels for sites, API routes, artifacts, and deploy logs.
- Retention and compaction controls for long-running thread state.
- External harness adapters, including ACP-style integrations, as a separate capability layer.
- Stronger permissions and review flows for generated API/database changes.

## License

MIT. See [LICENSE](LICENSE).

## Contributing

Issues, ideas, and small focused pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md), and [docs/release-process.md](docs/release-process.md).
