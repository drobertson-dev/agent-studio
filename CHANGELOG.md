# Changelog

All notable changes to Agent Studio will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Until `v1.0.0`, minor versions may include breaking changes as the runtime and extension surfaces settle.

## [0.1.1] - 2026-06-01

### Fixed

- Upgraded Nuxt to `4.4.6`, which resolves the Dependabot-reported `@nuxt/nitro-server` security floor.
- Updated both workspace and app-level pnpm lockfiles so local installs and Docker builds resolve the fixed Nuxt/Nitro versions.

## [0.1.0] - 2026-06-01

### Added

- Initial public Agent Studio monorepo.
- FastAPI runtime with DeepAgents/LangGraph agent wiring.
- Nuxt/Vue studio UI with login, streaming, thread history, tool-call visibility, and thread management.
- Host-based static site publishing from `/workspace/sites/<site-name>/`.
- Dynamic Python runtime API scripts from `/workspace/api`.
- Postgres-backed persistence for threads and DeepAgents store data.
- Docker Compose stack with Caddy, runtime, admin UI, Postgres, and Redis.
- OrbStack wildcard local domains for generated sites.
- GitHub Actions CI workflow and manual VM deployment workflow.
- MIT license, contribution guide, security policy, and release process documentation.

[0.1.1]: https://github.com/drobertson-dev/agent-studio/releases/tag/v0.1.1
[0.1.0]: https://github.com/drobertson-dev/agent-studio/releases/tag/v0.1.0
