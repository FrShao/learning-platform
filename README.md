# Learning Platform

TypeScript monorepo for a multi-tenant learning system: organizations own courses with **git-like versioning** (working tree, commits, publish), authored via web UI or MCP, with learner progress against the published commit only.

Design detail lives under [`docs/`](./docs/) — start with [engineering standards](./docs/engineering-standards.md) and [Docker & Compose](./docs/docker-and-compose.md). Product/API plan and domain models are summarized in [`docs/README.md`](./docs/README.md).

## Monorepo map

```text
apps/
  api/          REST /v1 (auth, courses, learner)
  web/          Author + learner UI
  mcp/          MCP adapter over the same domain services
packages/
  domain/       Canonical types, pure helpers
  db/           Schema, migrations, repositories (stub)
  config/       Shared env parsing
  tsconfig/     Shared TypeScript bases
  eslint-config Shared ESLint flat config
tests/
  integration/  API + Postgres
  smoke/        Post-start critical paths (see also scripts/smoke.ts)
  regression/   Locked fixtures (grading, versioning, publish)
  fixtures/     Shared JSON fixtures
docs/           Standards, ADRs, Docker runbook
scripts/        Entrypoints and smoke runner
```

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io) 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- Docker Engine + Compose v2 (for the full stack / integration DB)

## Quick start (host)

```bash
pnpm install
pnpm --filter @lp/domain build
pnpm --filter @lp/db build
pnpm --filter @lp/config build

# Postgres (Compose) then migrate
docker compose up -d postgres
export DATABASE_URL=postgresql://lp:lp_dev_change_me@127.0.0.1:5432/learning_platform
export JWT_SECRET=dev-only-change-me-in-prod
pnpm --filter @lp/db migrate:deploy

# Terminals (or use pnpm --filter <pkg> dev)
pnpm --filter @lp/api dev     # http://localhost:3000/health
pnpm --filter @lp/mcp dev     # http://localhost:3100/health
pnpm --filter @lp/web dev     # http://localhost:3001
```

Integration tests (ephemeral Postgres + migrate):

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from integration-tests
```

## Quick start (Docker)

```bash
cp .env.example .env          # never commit real secrets
docker compose up --build     # postgres + api + web + mcp
# optional: docker compose --profile assets up -d
```

See [`docs/docker-and-compose.md`](./docs/docker-and-compose.md) for profiles, test stack, and production notes.

## Scripts

| Script                         | Purpose                                  |
| ------------------------------ | ---------------------------------------- |
| `pnpm lint` / `lint:fix`       | ESLint                                   |
| `pnpm format` / `format:check` | Prettier                                 |
| `pnpm typecheck`               | TypeScript project references + web      |
| `pnpm test`                    | All Vitest projects                      |
| `pnpm test:unit`               | Unit (packages/apps)                     |
| `pnpm test:integration`        | `tests/integration`                      |
| `pnpm test:regression`         | `tests/regression`                       |
| `pnpm test:smoke`              | `scripts/smoke.ts` against a running API |
| `pnpm check`                   | typecheck + lint + format:check + unit   |

## Branching

| Branch | Role                                                   |
| ------ | ------------------------------------------------------ |
| `main` | Production-ready                                       |
| `dev`  | Integration branch — **default base for feature work** |

Flow: branch from `dev` → PR into `dev` → promote `dev` → `main` via a release PR. Hotfixes may target `main`, then land back on `dev`. Full rules: [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`docs/engineering-standards.md`](./docs/engineering-standards.md).

## Testing pyramid

1. **Unit** — pure domain logic (colocated `*.test.ts`)
2. **Integration** — API + Postgres (`tests/integration`, Compose test profile)
3. **Regression** — locked fixtures (`tests/regression` + `tests/fixtures`)
4. **Smoke** — post-start health / critical path (`pnpm test:smoke`)

## Security

Never commit `.env`, API keys, JWT secrets, or database passwords. Ship `.env.example` only.

## License

Private / unpublished unless a license file is added later.
