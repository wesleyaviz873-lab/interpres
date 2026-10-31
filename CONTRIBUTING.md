# Contributing

Thanks for taking the time to help. Interpres is a self-hosted workspace that
runs real agents on the user's machine, so correctness and safety matter more
than speed.

## Before you write code

1. Read `docs/00-VISAO.md`, `docs/01-ARQUITETURA.md` and `docs/02-SEGURANCA.md`.
2. Open an issue describing the problem and the proposed change.
3. For large changes, wait for agreement on the approach before opening a PR.

## Setup

Follow [docs/INSTALACAO.md](docs/INSTALACAO.md) (Portuguese) or the README. The
short version:

```bash
cd apps/api
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # Windows
# source .venv/bin/activate && pip install -r requirements-dev.txt  # Linux/macOS
.venv/Scripts/python -m pytest

cd ../web
npm install
npm run build
```

Use `npm run dev` for hot reload. Vite proxies `/api` to `http://127.0.0.1:8000`.

## Rules

- No secrets in code, tests, logs, screenshots, or examples.
- No access outside the configured project folder without an explicit permission.
- No new external service without a clear reason and an offline fallback.
- Every new tool must declare its permissions and be covered by a test.
- Security-sensitive changes need tests that prove the control works.
- Keep the UI and the API in separate layers. Business logic does not belong in
  React components.
- Prefer the simplest solution that solves the problem.

## Commit style

Use short, imperative messages:

```
feat(auth): add owner account creation
fix(jobs): resume events after reconnection
docs(security): document workspace isolation
```

## Checks before opening a pull request

- `python -m pytest` in `apps/api` (all tests pass).
- `npm run build` in `apps/web` (TypeScript and Vite pass).
- No new personal data, paths or keys in the diff.

## Continuous integration

GitHub Actions runs the API tests, the web build, a production dependency audit
and the Docker build on every push and pull request. The workflow lives in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Language

The main docs are in Portuguese, with an English README. Code, comments and
identifiers stay in English.
