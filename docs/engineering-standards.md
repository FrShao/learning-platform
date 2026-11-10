# Learning Platform — Engineering Standards

Durable playbook for how we structure, change, review, and test the Learning Platform. Use this as the source of truth for README / CONTRIBUTING once the repo exists. Do not treat CursorRemote or other repos as style authority.

**Related design docs**

| Doc                                                        | Role                                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`learning-platform-plan.md`](./learning-platform-plan.md) | Product goals, API surface, MCP tools, phases                                          |
| [`domain-object-models.md`](./domain-object-models.md)     | Canonical TypeScript domain types & invariants                                         |
| [`screens-and-navigation.md`](./screens-and-navigation.md) | Routes, screens, authoring vs learning UX                                              |
| [`docker-and-compose.md`](./docker-and-compose.md)         | Compose services, profiles, local/CI/prod runbook; artifacts in [`docker/`](./docker/) |

**Stack baseline:** TypeScript (strict) · Node.js · PostgreSQL · Prisma or Drizzle · Fastify/Nest API · MCP server · web client consuming `/v1`.

---

## 1. Monorepo layout

Recommended layout (npm/pnpm workspaces). Each package owns a clear boundary; do not invent parallel homes for the same concern.

```text
/
├── apps/
│   ├── api/                 # REST /v1 HTTP server (auth, courses, learner)
│   ├── web/                 # Author + learner UI (routes per screens doc)
│   └── mcp/                 # MCP process; thin adapter over domain services
├── packages/
│   ├── domain/              # Canonical types, validators, pure graders, tree ops
│   ├── db/                  # Schema, migrations, repositories / mappers
│   ├── config/              # Shared env parsing, feature flags
│   ├── tsconfig/            # Shared tsconfig bases (strict presets)
│   └── eslint-config/       # Shared lint rules (or biome.json at root)
├── tests/
│   ├── integration/         # API + Postgres (Testcontainers or CI Postgres)
│   ├── smoke/               # Post-start / post-deploy critical paths
│   ├── regression/          # Locked fixtures: grading, versioning, publish
│   └── fixtures/            # Shared JSON trees, form specs, expected grades
├── docs/
│   ├── adr/                 # Architecture Decision Records
│   └── …                    # Plan / models / screens (or links to Project store)
├── scripts/                 # Dev bootstrap, migrate, seed, smoke runners
├── package.json             # Workspace root scripts
├── pnpm-workspace.yaml      # or npm/yarn equivalent
├── .github/workflows/       # CI
└── README.md / CONTRIBUTING.md
```

### Ownership

| Path              | Owns                                                                                                        | Must not own                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/domain` | Types from domain models, tree patch apply, form auto-grading, progression pure logic, content-hash helpers | HTTP, MCP protocol, SQL, React                                |
| `packages/db`     | Migrations, ORM client, row↔domain mappers, tenancy-scoped queries                                          | Business policy beyond persistence, UI                        |
| `apps/api`        | Routes, auth middleware (JWT / API key), DTO validation at edge, orchestration calling domain + db          | Duplicate domain types; MCP wire format                       |
| `apps/mcp`        | Tool definitions, API-key auth wiring, mapping tools → same services as API                                 | Alternate ACL rules; private DB access that bypasses services |
| `apps/web`        | Screens/routes from screens doc, client state, presentation                                                 | Server-side secrets; direct DB                                |
| `tests/*`         | Cross-package confidence                                                                                    | Production runtime code                                       |

**Rule:** REST and MCP call the **same** domain/application services. MCP never bypasses org/ACL. Canonical types live in `packages/domain` and match [`domain-object-models.md`](./domain-object-models.md).

---

## 2. Git branching model

### Long-lived branches

| Branch | Role                                                       |
| ------ | ---------------------------------------------------------- |
| `main` | Production-ready. Deployable. Protected.                   |
| `dev`  | Integration branch. Default merge target for feature work. |

### Feature flow

1. Branch from **`dev`**.
2. Open PR **into `dev`**.
3. After review + green CI, merge to `dev` (squash preferred for noisy history; merge commit OK for intentional multi-commit stories).
4. Promote **`dev` → `main`** via a dedicated release PR (or controlled fast-forward when `dev` is known-good). No feature PR targets `main`.

```text
main  ◄── release PR ──  dev  ◄── feat/* | fix/* | …
```

### Hotfix policy

- Branch from `main`: `fix/…` (or `hotfix/…`).
- PR into `main` **only** for production-critical fixes.
- Immediately merge or cherry-pick the same fix back into `dev` so integration does not regress.

### Branch naming

Pattern: `<type>/<short-kebab-description>`

| Prefix      | Use                                  | Examples                                           |
| ----------- | ------------------------------------ | -------------------------------------------------- |
| `feat/`     | New capability                       | `feat/course-working-tree`, `feat/form-auto-grade` |
| `fix/`      | Bug fix                              | `fix/publish-commit-acl`, `fix/sequential-unlock`  |
| `chore/`    | Tooling, deps, non-user-facing       | `chore/eslint-strict`, `chore/ci-postgres`         |
| `test/`     | Tests only                           | `test/grader-regression-fixtures`                  |
| `docs/`     | Documentation                        | `docs/adr-tree-json-shape`                         |
| `refactor/` | Internal reshape, no behavior change | `refactor/domain-tree-ops`                         |
| `hotfix/`   | Urgent production fix from `main`    | `hotfix/api-key-hash-verify`                       |

Avoid: personal names as prefixes, ticket-only names without meaning (`feat/LEA-12` alone), mixed case, spaces.

### PR rules

- **Default base:** `dev`.
- **`main`:** only release PRs from `dev`, or hotfixes per policy above.
- **One outcome per PR:** one shippable slice (see §8). Description links design docs / ADR when behavior changes.
- **Required checks before merge:** `typecheck`, `lint`, unit tests; integration tests for API/db-touching changes; no secrets in diff.
- **Reviews:** at least one reviewer when the team has more than one active engineer; self-merge only for trivial docs/chore on `dev` if agreed locally.
- Protect `main` and `dev` from direct pushes.

---

## 3. Commit messages (Conventional Commits)

Format:

```text
<type>(optional-scope): <imperative summary>

[optional body]

[optional footer]
```

### Types

| Type       | When                                   |
| ---------- | -------------------------------------- |
| `feat`     | User-visible or API-visible capability |
| `fix`      | Bug fix                                |
| `docs`     | Documentation only                     |
| `style`    | Formatting (no logic change)           |
| `refactor` | Code change without feat/fix           |
| `test`     | Add or fix tests                       |
| `chore`    | Build, CI, deps, tooling               |
| `perf`     | Performance                            |

### Scopes (suggested)

`domain` · `api` · `mcp` · `web` · `db` · `auth` · `grading` · `versioning` · `ci` · `docs`

### Examples (this project)

```text
feat(domain): add tree patch ops for section reorder
feat(api): POST /courses/:id/publish pins published_commit_id
feat(mcp): add commit_course and publish_course tools
feat(grading): auto-grade number questions with tolerance
fix(auth): reject revoked API keys before scope check
fix(web): lock learner section until prior forms pass
test(regression): lock form fixtures for multi_select pass_rule
docs(adr): record JSONB tree over normalized blocks for v1
chore(ci): run integration suite against Postgres service
```

**Rules**

- Imperative mood (“add”, not “added”); ≤ ~72 char subject; no trailing period.
- Body explains **why** when non-obvious; reference invariants from the domain doc when touching graders or versioning.
- Breaking API changes: `feat(api)!: …` or `BREAKING CHANGE:` footer; update plan/OpenAPI/ADR in the same PR when possible.

---

## 4. Code style

### TypeScript

- **Strict mode everywhere** (`strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` preferred once adopted consistently).
- Shared base configs in `packages/tsconfig`; apps extend, do not fork casually.
- Prefer `interface` / discriminated unions for domain objects as in [`domain-object-models.md`](./domain-object-models.md); avoid `any`. Use `unknown` + narrow at boundaries.
- Explicit return types on exported public functions in `packages/domain` and service APIs.
- `async`/`await` over raw Promise chains; never swallow errors without context.
- IDs and enums: use domain branded/aliased string types (`CourseId`, `OrgRole`, …) rather than bare `string` in domain and service layers.

### Naming

| Kind               | Convention                                                                    |
| ------------------ | ----------------------------------------------------------------------------- |
| Files              | `kebab-case.ts` (or `PascalCase.tsx` for React components if web adopts that) |
| Types / classes    | `PascalCase`                                                                  |
| Values / functions | `camelCase`                                                                   |
| DB columns         | `snake_case` (mappers convert to domain `camelCase`)                          |
| Constants          | `UPPER_SNAKE` only for true constants                                         |
| React components   | `PascalCase`                                                                  |
| Tests              | `*.test.ts` / `*.spec.ts` colocated or under `tests/` (see §6)                |

### Module boundaries

```text
web ──HTTP──► api ──► application services ──► domain (pure)
mcp ──────────────► application services ──► domain (pure)
                         │
                         └──► db / Postgres
```

| From → To                                     | Allowed?                                                     |
| --------------------------------------------- | ------------------------------------------------------------ |
| `domain` → anything app/db                    | **No**                                                       |
| `db` → `domain` (types only)                  | Yes                                                          |
| `api` / `mcp` → `domain`, `db`, shared config | Yes                                                          |
| `api` ↔ `mcp`                                 | **No** direct imports; share via `domain` / services package |
| `web` → `domain` (types only, optional)       | Yes for shared DTO/types; never import server/db             |
| `web` → `api` source                          | **No**; HTTP client only                                     |

### Import rules

- Prefer package name imports (`@lp/domain`, `@lp/db`) over deep relative paths across packages.
- No circular imports; domain must stay acyclic and side-effect free.
- Side effects (I/O, env, clock) injected at the app/service edge so domain unit tests stay pure.
- Do not import `apps/*` from `packages/*`.

### Error & API shape

- API errors follow the plan: `{ "error": { "code", "message", "details?" } }` with codes `unauthorized` | `forbidden` | `not_found` | `validation` | `conflict` | `merge_conflict` (later).
- Map domain validation failures to `validation` / `conflict`; do not leak stack traces or SQL to clients.

### Security defaults (code-level)

- Org tenancy on every course/asset/enrollment query (`org_id`).
- Learners never receive working trees or unpublished commits.
- API keys hashed at rest; secrets never logged or committed.
- Password hashing: Argon2id; JWT short-lived access + stored refresh revocation.

---

## 5. Linting & formatting

**Default recommendation:** **ESLint + Prettier** (team familiarity). **Biome** is an acceptable single-tool alternative if chosen in an ADR before scaffold; do not run both formatters.

### Enforce

- TypeScript-eslint recommended + strict stylistic rules aligned with §4.
- `import/order` or equivalent; forbid `any` where practical (`ban-types` / `no-explicit-any` as warn→error).
- Prettier (or Biome format): consistent quotes, trailing commas, width ~100.
- `eslint-plugin-security` or equivalent light checks optional; secret scanning in CI.
- Web: a11y plugin when UI lands; MCP/API: no React rules.

### Root scripts

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc -b --pretty false",
    "test": "vitest run",
    "test:unit": "vitest run packages apps --exclude tests/integration",
    "test:integration": "vitest run tests/integration",
    "test:regression": "vitest run tests/regression",
    "test:smoke": "tsx scripts/smoke.ts",
    "check": "pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:unit"
  }
}
```

(Adjust runner names if the scaffold picks Jest; prefer Vitest for TS monorepos.)

### When they run

| Gate                           | Commands                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Pre-commit (husky/lint-staged) | `format` on staged · `lint` on staged · fast unit for touched packages if cheap |
| PR / CI                        | `typecheck` · `lint` · `format:check` · unit · integration · regression         |
| Local full confidence          | `pnpm check` then integration                                                   |

---

## 6. Testing strategy

Pyramid: many **unit** tests → fewer **integration** → thin **smoke** → durable **regression** fixtures for correctness-critical paths (grading, versioning, publish).

### 6.1 Unit

**What:** Pure domain logic — tree patch ops, content-hash, form auto-grading (`short_text`, `single_select`, `multi_select`, `boolean`, `number` + tolerance), pass rules, progression unlock helpers, DTO/schema parsers that do not need DB.

**Where:** Colocate next to source: `packages/domain/src/**/*.test.ts` (preferred for pure modules). App-local pure helpers may colocate under `apps/*/src`.

**Naming:** `tree-ops.test.ts`, `grade-form.test.ts` — describe behavior, not implementation.

**When:** Pre-commit (targeted) · every CI PR · required to merge.

### 6.2 Integration

**What:** API + PostgreSQL — auth/JWT, API keys, org tenancy, course CRUD, working tree PATCH → commit → publish, enrollment against published commit only, form attempt persistence.

**Where:** `tests/integration/**/*.test.ts` (or `*.integration.test.ts`). Use Testcontainers Postgres or CI service containers; migrate schema in setup.

**Rules:** No shared mutable global DB without cleanup; prefer transactional rollback or unique org slugs per test. Hit HTTP (or in-process app) rather than bypassing ACL.

**When:** CI on PRs that touch `apps/api`, `packages/db`, `packages/domain` services with persistence · nightly full suite. Not required on every docs-only PR.

### 6.3 Smoke

**What:** Critical paths after process start or deploy: health → register/login → create org → create course → patch tree → commit → publish → enroll → read published → submit one auto-gradable form.

**Where:** `tests/smoke/` or `scripts/smoke.ts` against a running stack (`BASE_URL`, test credentials from env).

**When:** Post-deploy / docker-compose `up` verification · optional CI job on `main` after release. Fast failure, not deep coverage.

### 6.4 Regression

**What:** **Locked fixtures** that must not drift:

- Grading: golden inputs/outputs per question type and `pass_rule` (`all_correct`, `min_score`), including edge cases (tolerance, case sensitivity, multi_select set equality, `long_text` → pending).
- Versioning: commit advances head; working tree base resets; publish pins `published_commit_id`; learners still isolated from dirty trees.
- Publish/progress: progress remains keyed by prior `published_commit_id` under org policy `keep`.

**Where:** `tests/regression/` + `tests/fixtures/` (JSON trees, attempts, expected grades). Fixtures are reviewed like code; changing a golden requires an explicit commit message explaining the product change.

**When:** Every CI PR · block merge on failure. Treat as correctness contract for [`domain-object-models.md`](./domain-object-models.md) §3–§6.

### Summary matrix

| Layer       | Location                      | Pre-commit  | PR CI              | Nightly / post-deploy |
| ----------- | ----------------------------- | ----------- | ------------------ | --------------------- |
| Unit        | colocated / packages          | ✓ (touched) | ✓                  | ✓                     |
| Integration | `tests/integration`           | —           | ✓ (relevant)       | ✓                     |
| Regression  | `tests/regression` + fixtures | —           | ✓                  | ✓                     |
| Smoke       | `tests/smoke` / scripts       | —           | optional on `main` | ✓ after deploy        |

### Writing tests

- Arrange–Act–Assert; name tests after invariants (“rejects publish of unknown commit”).
- Prefer factory helpers in `tests/fixtures` over copy-paste trees.
- Flaky tests are bugs: fix or quarantine with an issue; do not retry away races in grading/versioning tests.
- MCP: contract tests that tools invoke the same services as REST for equivalent ops (Phase 3+).

---

## 7. Documentation expectations

### README (repo root)

Must include:

1. What the product is (one short paragraph + link to plan).
2. Monorepo map (§1).
3. Prerequisites (Node, pnpm/npm, Docker/Postgres).
4. Quick start: install, migrate, `dev` for api/web/mcp.
5. Scripts table (`lint`, `typecheck`, `test`, smoke).
6. Link to CONTRIBUTING and this standards doc (or inlined summary).
7. Link to design docs: plan, domain models, screens.
8. Security note: never commit `.env` / API key secrets.

### CONTRIBUTING

- Branch/PR rules (§2), commit format (§3), `pnpm check` before PR.
- How to run integration tests locally.
- Code owners / review expectations.
- Pointer to ADRs for “why”.

### ADRs (`docs/adr/`)

- Filename: `NNNN-short-title.md` (e.g. `0001-orm-prisma.md`, `0002-biome-vs-eslint.md`).
- Write an ADR when choosing: ORM, lint toolchain, auth provider, blob storage, monorepo package manager, merge strategy for course trees, publish/progress policy defaults.
- Lightweight template: Context · Decision · Consequences · Status (proposed/accepted/superseded).

### When to update docs

| Change                            | Update                                          |
| --------------------------------- | ----------------------------------------------- |
| New/changed REST path or MCP tool | Plan + OpenAPI/MCP list                         |
| New domain field/invariant        | `domain-object-models.md` + regression fixtures |
| New screen/route                  | `screens-and-navigation.md`                     |
| Tooling or architectural choice   | ADR + README scripts if needed                  |
| Engineering process               | This file                                       |

Docs PRs may use `docs/…` branches and skip integration jobs when CI path-filters allow.

---

## 8. Worker / PR orchestration

For humans and coding agents working in parallel on this Project:

1. **One feature branch and one PR per worker outcome.** Do not overload a single PR with unrelated features (e.g. graders + web chrome).
2. **Base every worker branch on `dev`** (unless hotfixing `main`).
3. **Stack PRs only when dependent** (e.g. domain tree ops must land before API PATCH wiring). Independent work stays parallel, unstacked.
4. **Do not push to `main`/`dev` directly;** do not merge another worker’s PR unless asked.
5. **Cross-link** the PR to the design doc section(s) touched; update docs in the same PR when contracts change.
6. **Agents:** leave CI green; include test plan in the PR body (unit/integration/regression touched); never scaffold secrets.
7. After merge to `dev`, delete the feature branch; release to `main` is a separate, explicit promotion.

---

## 9. Definition of done (feature slice)

A slice is done when:

- [ ] Types/invariants match [`domain-object-models.md`](./domain-object-models.md) (or doc updated).
- [ ] API/MCP/UI behavior matches [`learning-platform-plan.md`](./learning-platform-plan.md) / [`screens-and-navigation.md`](./screens-and-navigation.md) as applicable.
- [ ] `typecheck`, `lint`, and relevant tests pass in CI.
- [ ] Tenancy and role/scope checks covered for new write paths.
- [ ] Regression fixtures updated if grading/versioning/publish behavior changed.
- [ ] ADR filed when a non-obvious decision was made.
- [ ] PR targets `dev` with Conventional Commit history (or squash message).

---

## 10. Docker & Compose

Canonical runbook and ready-to-copy files: [`docker-and-compose.md`](./docker-and-compose.md) and [`docs/docker/`](./docker/). This section is the process contract; that doc is the operational detail.

### Principles

- **One container per Node app** — `apps/api`, `apps/web`, `apps/mcp` — plus a **Postgres** service. Shared packages (`packages/domain`, `packages/db`, …) are build-time dependencies inside those images, not separate services.
- **Do not invent unrelated microservices.** Optional `minio` (Compose profile `assets`) is allowed for local S3-compatible asset storage; skip MailHog until transactional email exists.
- **Multi-stage Dockerfiles**, lean runtime images, **non-root** user (`lp`, uid 1000) where practical.
- **Shared user-defined network** (`lp_net`). **Named volume** `lp_pgdata` for durable Postgres in dev/prod-ish; **never** attach that volume on the test stack (use tmpfs / anonymous + `down -v`).
- **Healthchecks** on Postgres and apps; `api` (and dependents) use `depends_on: … condition: service_healthy`.
- Build **context = monorepo root** so images can copy workspace packages; keep a root `.dockerignore` so secrets and `node_modules` never enter the daemon context.

### Profiles vs override file

| Mechanism                            | When                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| Default (no profile)                 | `postgres` + `api` + `web` + `mcp` for local `docker compose up`               |
| `--profile assets`                   | Start optional MinIO                                                           |
| `--profile test`                     | Ephemeral `postgres-test` → migrate (`api-test`) → `integration-tests`         |
| Standalone `docker-compose.test.yml` | CI-friendly ephemeral migrate-then-test stack (do not merge with main compose) |

Prefer profiles for local; either `--profile test` or standalone `docker-compose.test.yml` in CI — pick one per pipeline and document it in the workflow.

### Commands (repo root, after copying artifacts)

```bash
cp .env.example .env                         # never commit real .env
docker compose up --build                    # local stack
docker compose --profile assets up -d        # + MinIO
docker compose --profile test run --rm --build integration-tests
docker compose -f docker-compose.test.yml \
  up --build --abort-on-container-exit --exit-code-from integration-tests
docker compose down                          # stop
docker compose down -v                       # stop + wipe volumes (destroys DB data)
```

### CI usage (integration)

- Run the Compose **test** path on PRs that touch `apps/api`, `packages/db`, or persistence-related `packages/domain` (see §6.2).
- Always `down -v` (or equivalent) in an `if: always()` step so ephemeral DBs do not leak runners.
- Unit and pure regression fixtures stay on the Node CI job; do not force them through Docker.
- Post-deploy smoke (§6.3) targets the running compose/prod URL — not the test profile.

### Secrets

- **Do not commit secrets.** Ship `.env.example` only; real `.env`, API keys, JWT secrets, and DB passwords stay local or in the CI/CD secret store.
- Never `COPY` `.env` into images; inject via Compose `environment` / orchestrator secrets at runtime.
- Rotate any credential that appears in a PR diff; treat leaked compose overrides as incidents.

### Definition of done (Docker-touching changes)

- [ ] Compose still maps only to monorepo apps + Postgres (+ optional MinIO).
- [ ] Healthchecks and `depends_on` healthy ordering preserved.
- [ ] Test path remains ephemeral (no `lp_pgdata` on test).
- [ ] `.dockerignore` still excludes `.env` / secrets.
- [ ] [`docker-and-compose.md`](./docker-and-compose.md) updated if services, ports, or profiles change.

---

## Document history

- Initial playbook for LearningPlatform engineering foundation (LEA engineering standards).
- Aligns monorepo and test pyramid with Phase 1–3 in the API & data model plan; UI routes deferred to screens doc.
- Added §10 Docker & Compose (LEA-7); cross-links [`docker-and-compose.md`](./docker-and-compose.md) and [`docs/docker/`](./docker/) artifacts.
