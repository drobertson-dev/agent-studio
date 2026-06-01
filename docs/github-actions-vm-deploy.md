# GitHub Actions VM Deploy

This repo deploys to a Linux VM with `.github/workflows/deploy.yml`.

The workflow is started manually from the GitHub Actions tab. It packages the
repository from the GitHub runner, uploads it to the VM over SSH, writes the
production `.env` from GitHub secrets, and runs:

```bash
docker compose up -d --build --remove-orphans
```

## VM Requirements

- Docker Engine and the Docker Compose plugin are installed.
- Ports `80` and `443` are open in the cloud firewall.
- The SSH user can run Docker without `sudo`.
- DNS points the admin host and public site hosts to the VM public IP.

For the default Ubuntu image, the SSH user is usually `ubuntu`.

## TLS / Edge Assumption

The default deployment uses `APP_DOMAIN=:80`, which is best when another edge
layer handles HTTPS and forwards HTTP to the Docker host. That can be a
platform proxy, Cloudflare, Coolify, or another reverse proxy.

Stock Caddy can manage certificates directly for fixed hostnames such as
`admin.example.com,example.com,www.example.com`. Dynamic wildcard HTTPS for
`*.example.com` requires an external wildcard TLS layer or a Caddy build
configured for DNS-challenge certificates.

## Required GitHub Secrets

Add these in:

`Settings` -> `Secrets and variables` -> `Actions` -> `Secrets`

```text
VM_HOST=your VM public IP or hostname
VM_USER=ubuntu
VM_SSH_KEY=private SSH key that can log into the VM
APP_DOMAIN=:80
STUDIO_PASSWORD=your studio login password
AUTH_SECRET=long random signing secret
POSTGRES_PASSWORD=long random database password
ADMIN_HOST_REGEX=^(admin\.your-domain\.com|admin\..+)(:\d+)?$
ADMIN_HOSTS=admin.your-domain.com
SITE_DOMAIN_SUFFIXES=your-domain.com
```

Set at least one model provider key:

```text
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

Optional:

```text
ACME_EMAIL=you@example.com
DEFAULT_SITE=
DEFAULT_SITE_HOSTS=
```

## Optional GitHub Variables

Add these in:

`Settings` -> `Secrets and variables` -> `Actions` -> `Variables`

```text
DEPLOY_PATH=/home/ubuntu/agent-studio
VM_SSH_PORT=22
DEFAULT_AGENT_MODEL=anthropic:claude-opus-4-6
```

If omitted, the workflow uses those defaults.

## First Deploy

After the secrets are set, run the workflow manually:

`Actions` -> `Deploy to VM` -> `Run workflow`

The first deploy will take longer because Docker builds both app images.

## DNS Shape

Use one host for the studio admin UI and separate hosts for generated sites:

```text
admin.example.com -> Studio UI
*.example.com     -> generated sites
example.com       -> optional default site
```

For that setup:

```text
ADMIN_HOST_REGEX=^(admin\.example\.com)(:\d+)?$
ADMIN_HOSTS=admin.example.com
SITE_DOMAIN_SUFFIXES=example.com
```

Generated files under `/workspace/sites/acme/index.html` will be served from
`https://acme.example.com/`.
