# Contributing

Interpres is being designed before it is implemented. The first contributions
will be architectural review, threat modelling, and documentation.

## Before you write code

1. Read `docs/00-VISAO.md`, `docs/01-ARQUITETURA.md`, and `docs/02-SEGURANCA.md`.
2. Open an issue describing the problem and the proposed change.
3. Wait for agreement on the approach before opening a large pull request.

## Rules

- No secrets in code, tests, logs, screenshots, or examples.
- No access outside the configured workspace without an explicit permission.
- No new external service without a clear reason and an offline fallback.
- Every new tool must declare its permissions and be covered by a test.
- Security-sensitive changes need tests that demonstrate the control works.
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

## Development

The exact commands will be added when the first executable skeleton exists.
