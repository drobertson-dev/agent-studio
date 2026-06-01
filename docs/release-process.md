# Release Process

Agent Studio uses Semantic Versioning:

```text
MAJOR.MINOR.PATCH
```

Until `v1.0.0`, minor releases may include breaking changes while the runtime, UI, and extension boundaries are still settling.

## Release Checklist

1. Update versions in:

```text
package.json
apps/runtime/pyproject.toml
```

2. Update `CHANGELOG.md` with the release date and notable changes.

3. Run verification:

```bash
pnpm run verify
```

4. Commit the release prep:

```bash
git commit -m "Release vX.Y.Z"
```

5. Create an annotated tag:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
```

6. Push the branch and tag:

```bash
git push origin main
git push origin vX.Y.Z
```

7. Create a GitHub release from the tag and include the changelog notes.

## Current Release

Current release: `v0.1.2`
