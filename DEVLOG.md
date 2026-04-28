# Dev Log

## 2026-04-27

- Created the first generic Agent Studio monorepo from the newer specialized-agent app structure.
- Kept the reusable pieces: Nuxt studio UI, password-gated admin surface, WebSocket stream bridge, thread search/history/delete, FastAPI runtime, Postgres store, Docker Compose, and Caddy.
- Removed the domain-specific odds tool, prompt, eval pack, sample data, and branding.
- Added builder-host runtime behavior: generated static sites under `/workspace/sites` with host-based routing, plus dynamic Python API scripts under `/workspace/api`.
- Added a starter workspace page at `welcome.<site-domain-suffix>` and a starter runtime API at `/runtime-api/health`.
- Reworked auth to use a signed HTTP-only session cookie instead of storing the login password in the cookie.

## Next

- Add first-run setup for password/model/provider configuration.
- Add a Studio sidebar panel for sites, API routes, artifacts, and deploy logs.
- Add ACP/external harness adapters as a separate capability layer.
- Add retention/compaction for long-running thread state.
