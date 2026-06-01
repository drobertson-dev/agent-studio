# Contributing

Thanks for taking a look at Agent Studio. This project is early, so the most useful contributions are focused, practical, and easy to review.

## Good First Contributions

- Documentation improvements.
- Reproducible bug reports with logs and environment details.
- Small fixes to local setup, Docker Compose, routing, or tests.
- Focused UI improvements that preserve the existing Nuxt/Vue patterns.
- Runtime tests for generated site serving, dynamic APIs, and persistence behavior.

## Development Setup

Install dependencies:

```bash
pnpm install
```

Run the full check:

```bash
pnpm run verify
```

Useful focused commands:

```bash
pnpm run web:lint
pnpm run web:test
pnpm run web:build
pnpm run runtime:lint
pnpm run runtime:test
pnpm run compose:config
```

## Pull Requests

- Keep pull requests scoped to one clear change.
- Include tests for runtime behavior changes.
- Update `README.md`, `CHANGELOG.md`, or docs when behavior or setup changes.
- Do not commit `.env`, credentials, generated build output, caches, or local workspace data.
- Describe the validation you ran.

## Versioning

Agent Studio uses Semantic Versioning. See [docs/release-process.md](docs/release-process.md).
