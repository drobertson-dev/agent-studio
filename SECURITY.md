# Security Policy

Agent Studio is an early self-hosted runtime that can execute generated Python API code inside its runtime container. Treat access to the studio admin UI as privileged.

## Supported Versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Reporting a Vulnerability

Please do not open a public issue for sensitive security reports.

Email the maintainer at the address listed on the GitHub profile, or open a private security advisory through GitHub if available. Include:

- A clear description of the issue.
- Reproduction steps.
- Impact and affected version.
- Any relevant logs or proof-of-concept code.

## Security Notes

- Generated runtime API scripts are code and should be reviewed before sensitive production use.
- The admin UI is password-gated; use a strong `STUDIO_PASSWORD` and `AUTH_SECRET`.
- Keep the Docker host and dependencies updated.
- Do not expose the admin UI to untrusted users.
- Do not commit provider keys, `.env`, database dumps, generated secrets, or workspace data.
