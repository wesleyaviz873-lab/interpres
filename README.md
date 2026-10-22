# Interpres

Self-hosted AI workspace. Your keys, your models, your files, your machine.

> **Status: early foundation (v0.1).** The owner account, login, sessions, database,
> Docker packaging and the first web screens are working. Chat, persistent jobs,
> providers, the workspace and the local agent are the next blocks.

Interpres is designed for people who want a hosted-AI experience without handing
their keys, conversations and files to a third party. Each installation has one
owner account, like a self-hosted n8n. There is no public signup.

## What works today

- First-run owner creation (`/api/setup`) with a one-time recovery code.
- Login, logout and server-side sessions with HttpOnly cookies.
- Show/hide password on every password field.
- Password recovery with the one-time recovery code.
- Optional password recovery by e-mail: a 6-digit code is sent when SMTP is
  configured.
- Optional TOTP two-factor authentication (Google Authenticator) with QR code
  and one-time backup codes.
- Admin CLI: `list-users` and `reset-password` for the server owner.
- Account settings: change e-mail, change password, rotate the recovery code and
  log out of every device.
- Encrypted provider key storage for OpenAI, Anthropic, Google, OpenRouter,
  OpenCode and Ollama. Ollama is detected automatically and lists local models;
  no API-key field is shown for it.
- Connected-device list with per-device revoke; sessions slide while the account
  is used (30 days by default).
- Optional tunnel manager: Cloudflare quick link (no account), Cloudflare token
  and ngrok. Start/stop and copy/open the public URL from Settings.
- Settings sections for account, security, API keys, voice, harnesses, project
  memory (future), backend health, tunnel, appearance, notifications and about.
- A real app shell with sidebar, chat area and composer. The chat engine and
  persistent jobs are the next block.
- CSRF protection on state-changing requests.
- Argon2id password hashing.
- Login and recovery rate limiting.
- Audit log for setup, login, failed login, recovery and account changes.
- SQLite with Alembic migrations (PostgreSQL is a planned option).
- Security headers and a production CSP.
- Healthcheck at `/api/health`.
- A React + TypeScript + Tailwind app shell with sidebar, conversation empty
  state and the account settings modal.
- One Docker image serving the API and the built frontend.

## Quick start

Requirements: Docker with Compose v2.

```bash
git clone https://github.com/<your-user>/interpres.git
cd interpres
cp .env.example .env
# generate a real secret and put it in APP_SECRET:
#   openssl rand -hex 32
# do not start with the default "change-me": production refuses it.
docker compose up -d
```

Open <http://localhost:3000>. The first visit asks you to create the owner
account and goes straight to the app. The recovery code is **optional and
configured later** in **Configurações → Segurança**; there is no public signup.

For the simpler "forgot password" by e-mail, fill the `SMTP_*` variables in
`.env` before starting. The login page then offers a 6-digit code sent to the
account e-mail. Without SMTP, the recovery code and the admin CLI remain
available. TOTP two-factor is optional and can be enabled later in
**Configurações → Segurança**.

To expose the installation without opening ports, use **Configurações → Túnel**.
The Docker image includes `cloudflared` and `ngrok`. The Cloudflare quick link
needs no account; a token is optional for a named tunnel. The link can be opened
on the phone and the app is responsive.

To stop:

```bash
docker compose down
```

To stop and erase the installation (owner, sessions, future conversations and
the workspace):

```bash
docker compose down -v
```

## Configuration

The main variables are in `.env.example`:

| Variable | Meaning |
|---|---|
| `APP_URL` | Public URL. Use `https://...` behind a tunnel or reverse proxy. |
| `APP_SECRET` | Random secret for this installation. Never commit it. |
| `APP_ENV` | `production` in Docker. |
| `INTERPRES_PORT` | Host port (default `3000`). |
| `SESSION_TTL_HOURS` | Session lifetime (default `168`). |
| `AUTH_MAX_ATTEMPTS` / `AUTH_WINDOW_MINUTES` | Login rate limit. |

Docker keeps data in two named volumes:

- `interpres_data`: database, audit log and future job storage.
- `interpres_workspace`: the only directory the AI will be allowed to touch.

## Development

### API

```bash
cd apps/api
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # Windows
# source .venv/bin/activate && pip install -r requirements-dev.txt  # Linux/macOS
.venv/Scripts/python -m pytest
.venv/Scripts/python -m uvicorn app.main:app --reload
```

The API runs on `http://127.0.0.1:8000`. In development it creates the SQLite
tables automatically. Production runs `alembic upgrade head` in the container
entrypoint.

### Web

```bash
cd apps/web
npm install
npm run dev
```

The web app runs on `http://localhost:5173` and proxies `/api` to the API on
port `8000`.

Production build:

```bash
npm run build
```

The built files go to `apps/web/dist` and are served by the API when
`WEB_DIST_DIR` points to them.

## Security

- The network is not the security boundary. Authentication and CSRF are inside
  the application.
- Session cookies are `HttpOnly`, `SameSite=Lax` and become `Secure` when
  `APP_URL` starts with `https://`.
- Passwords use Argon2id. API keys will be encrypted at rest in the next block.
- TOTP secrets are encrypted at rest with `APP_SECRET`; backup codes are stored
  as HMAC hashes and consumed once.
- Password reset codes are hashed, expire in 15 minutes and are rate limited.
- SMTP is optional and never required for the installation to run.
- The workspace will be a single explicit directory; the AI will not receive
  access to the whole disk.
- See [docs/02-SEGURANCA.md](docs/02-SEGURANCA.md) and [SECURITY.md](SECURITY.md).

## Structure

```
apps/
  api/       FastAPI, SQLAlchemy, Alembic, auth, tests
  web/       React, TypeScript, Vite, Tailwind
  agent/     local agent (next)
docker/      Dockerfile and entrypoint
docs/        vision, architecture, security, roadmap, checklist
packages/    shared contracts (next)
```

## Documentation

- [Vision](docs/00-VISAO.md)
- [Architecture](docs/01-ARQUITETURA.md)
- [Security](docs/02-SEGURANCA.md)
- [Roadmap](docs/03-ROADMAP.md)
- [Construction checklist](docs/04-CHECKLIST-CONSTRUCAO.md)
- [Current state](docs/07-ESTADO-ATUAL.md)

## License

AGPL-3.0. See [LICENSE](LICENSE).
