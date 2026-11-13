# Learning Platform — Docker & Compose

How we package and run the TypeScript monorepo (`apps/api`, `apps/web`, `apps/mcp`) with PostgreSQL. Artifacts ready to copy into the future repo root live under [`docs/docker/`](./docker/). Engineering rules: [`engineering-standards.md`](./engineering-standards.md) §10.

**Stack mapping**

| Compose service                        | Monorepo path      | Role                                               |
| -------------------------------------- | ------------------ | -------------------------------------------------- |
| `api`                                  | `apps/api`         | REST `/v1` (auth, courses, learner)                |
| `web`                                  | `apps/web`         | Author + learner UI                                |
| `mcp`                                  | `apps/mcp`         | MCP adapter over the same domain services          |
| `postgres`                             | — (official image) | System of record                                   |
| `minio` _(optional, profile `assets`)_ | —                  | Local S3-compatible blob store for `Asset` uploads |

Shared workspace packages (`packages/domain`, `packages/db`, `packages/config`, …) are **build dependencies** inside the Node images, not separate containers. Do not invent extra microservices.

---

## 1. Overview

### Services

| Service    | Image / build         | Default ports   | Notes                                                                 |
| ---------- | --------------------- | --------------- | --------------------------------------------------------------------- |
| `postgres` | `postgres:16-alpine`  | `5432`          | Named volume `lp_pgdata` in dev/prod; **no volume** on test profile   |
| `api`      | `apps/api/Dockerfile` | `3000`          | `depends_on: postgres` (healthy); runs migrations on start in compose |
| `web`      | `apps/web/Dockerfile` | `3001`          | Talks to `api` via `NEXT_PUBLIC_API_URL` / `API_URL`                  |
| `mcp`      | `apps/mcp/Dockerfile` | `3100`          | HTTP or stdio MCP; uses `DATABASE_URL` / API key config via env       |
| `minio`    | `minio/minio`         | `9000` / `9001` | Profile `assets` only — justified by plan §3.3 / assets API           |

MailHog is **not** included: Phase 1 has no transactional email requirement.

### Networks

- Single user-defined bridge: `lp_net`. All app containers resolve each other by service name (`postgres`, `api`, `web`, `mcp`, `minio`).

### Volumes

| Volume      | Used by         | When                                                       |
| ----------- | --------------- | ---------------------------------------------------------- |
| `lp_pgdata` | `postgres`      | Default / production-ish — **persistent**                  |
| _(none)_    | `postgres-test` | Profile `test` / `docker-compose.test.yml` — **ephemeral** |
| `lp_minio`  | `minio`         | Profile `assets` only                                      |

### Env vars

Copy [`docs/docker/.env.example`](./docker/.env.example) → repo-root `.env` (never commit real secrets). Compose interpolates `${VAR}` from that file.

| Variable                                                        | Services           | Purpose                                 |
| --------------------------------------------------------------- | ------------------ | --------------------------------------- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`           | postgres, api, mcp | DB bootstrap + connection               |
| `DATABASE_URL`                                                  | api, mcp           | Full Postgres URL                       |
| `JWT_SECRET`                                                    | api                | Access-token signing                    |
| `API_URL` / `NEXT_PUBLIC_API_URL`                               | web                | Browser/server → API base               |
| `MCP_HTTP_PORT`                                                 | mcp                | MCP HTTP listen port                    |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` | api                | Object storage (MinIO locally)          |
| `NODE_ENV`                                                      | all Node apps      | `development` \| `production` \| `test` |
| `LOG_LEVEL`                                                     | api, mcp           | Structured logging                      |

### Profiles

| Profile     | Activates                                        | Purpose                                    |
| ----------- | ------------------------------------------------ | ------------------------------------------ |
| _(default)_ | `postgres`, `api`, `web`, `mcp`                  | Local development / production-ish         |
| `assets`    | `minio`                                          | Local S3 when exercising asset uploads     |
| `test`      | `postgres-test`, `api-test`, `integration-tests` | Ephemeral DB + migrate + integration suite |

`docker-compose.test.yml` is a **standalone** ephemeral test stack for CI (same migrate-then-test intent as `--profile test` on the main file). Prefer one approach per environment; document which you use in the job. Do not `-f` merge it with `docker-compose.yml`.

---

## 2. Artifact layout (copy into repo)

When the Learning Platform repo is created, copy from the Project store as:

```text
docs/docker/                          →  <repo>/
├── docker-compose.yml                   docker-compose.yml
├── docker-compose.test.yml              docker-compose.test.yml
├── .dockerignore                        .dockerignore
├── .env.example                         .env.example
├── apps/api/Dockerfile                  apps/api/Dockerfile
├── apps/web/Dockerfile                  apps/web/Dockerfile
├── apps/mcp/Dockerfile                  apps/mcp/Dockerfile
└── scripts/docker-entrypoint-api.sh     scripts/docker-entrypoint-api.sh
```

Dockerfiles assume context = **monorepo root** (so they can copy `packages/*` and workspace manifests). Compose sets `build.context: .` and `dockerfile: apps/<app>/Dockerfile`.

---

## 3. Local development

Prerequisites: Docker Engine + Compose v2, copy `.env.example` → `.env`, fill secrets.

```bash
# From repo root (after copying artifacts)
cp .env.example .env

# Build and start default stack (postgres + api + web + mcp)
docker compose up --build

# Optional local object storage
docker compose --profile assets up --build

# Tail one service
docker compose logs -f api

# Tear down (keep named volume)
docker compose down

# Tear down + wipe Postgres data
docker compose down -v
```

**Dev workflow notes**

- First `api` start runs DB migrations (entrypoint), then listens on `:3000`.
- Prefer bind-mount + `pnpm dev` _outside_ Docker for fast UI iteration once Postgres is up: `docker compose up postgres` (and optionally `minio`), run Node apps on the host against `DATABASE_URL=postgresql://…@localhost:5432/…`.
- Health: `GET http://localhost:3000/health` (api), `GET http://localhost:3001/` (web).

---

## 4. Integration tests

Integration tests live at `tests/integration` (see engineering standards §6.2). They need a **fresh** Postgres, migrations applied, then the Vitest (or chosen) suite.

### Option A — Compose profile `test`

```bash
# Ephemeral Postgres (tmpfs / anonymous volume), migrate, run tests, exit
docker compose --profile test run --rm --build integration-tests

# Or bring the test DB up, then run from host / CI step
docker compose --profile test up -d postgres-test
docker compose --profile test run --rm api-test pnpm --filter @lp/db migrate:deploy
docker compose --profile test run --rm integration-tests
docker compose --profile test down -v
```

### Option B — standalone `docker-compose.test.yml` (CI-friendly)

Do **not** merge with the main compose file (that would start the durable stack too).

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from integration-tests
docker compose -f docker-compose.test.yml down -v
```

**Guarantees for test**

- No `lp_pgdata` bind — data discarded on `down -v`.
- `postgres-test` has a healthcheck; `api-test` / `integration-tests` `depends_on` with `condition: service_healthy`.
- Migrations run before tests (`packages/db` migrate script).
- Distinct `POSTGRES_DB` / credentials from local dev when possible (`lp_test`).

### CI sketch

```yaml
# .github/workflows/ci.yml (illustrative)
jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cp .env.example .env
      - run: docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from integration-tests
      - if: always()
        run: docker compose -f docker-compose.test.yml down -v
```

Unit / regression tests that do not need Postgres stay on the host or a Node CI job — do not force them through Compose.

---

## 5. Production-ish deploy

Use the **same** `docker-compose.yml` with production env values (or a thin `docker-compose.prod.yml` override that only changes restart policies, resource limits, and image tags — do not fork the service graph).

```bash
# Pull/build release images, start with restart policies
NODE_ENV=production docker compose up -d --build

# Optional assets backend on the same network
NODE_ENV=production docker compose --profile assets up -d --build

docker compose ps
docker compose logs -f api
```

**Production rules**

- Set strong `POSTGRES_PASSWORD`, `JWT_SECRET`, and S3 credentials via secrets manager or host env — never bake into images.
- Prefer pre-built images tagged from CI (`ghcr.io/…/lp-api:$GIT_SHA`) over `build:` on the server once the registry exists; Compose `image:` + `build:` can coexist for local.
- Persist only `lp_pgdata` (and object storage); app containers are disposable.
- Run migrations as a one-shot before rolling api: `docker compose run --rm api pnpm --filter @lp/db migrate:deploy`.
- Smoke after deploy: `pnpm test:smoke` / `scripts/smoke.ts` against public `BASE_URL` (engineering standards §6.3).

---

## 6. Image design (all Node apps)

Multi-stage pattern (see Dockerfiles under [`docs/docker/apps/`](./docker/apps/)):

1. **`deps`** — install workspace deps with pnpm (frozen lockfile when present).
2. **`build`** — compile the target app + needed packages.
3. **`runner`** — copy production `node_modules` + build output; run as non-root `node` user (uid 1000); lean Alpine/distroless-friendly Node 26 image.

Shared rules:

- Build context = repo root; root [`.dockerignore`](./docker/.dockerignore) excludes `node_modules`, `.git`, tests, docs noise.
- One process per container; no supervisord.
- Healthchecks via HTTP (`wget`/`curl`) or `pg_isready` for Postgres.
- `api` waits for Postgres healthy before migrate/start.

---

## 7. Quick command cheat sheet

```bash
docker compose up --build                 # dev stack
docker compose --profile assets up -d     # + MinIO
docker compose --profile test run --rm integration-tests
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from integration-tests
docker compose down                       # stop
docker compose down -v                    # stop + delete volumes (wipes DB)
docker compose logs -f api
docker compose exec api sh                # debug shell (non-prod)
```

---

## Document history

- Initial Docker & Compose packaging for LearningPlatform (LEA-7); artifacts under `docs/docker/` until the application repo exists.
