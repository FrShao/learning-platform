# Contributing

## Branching

- Long-lived: `main` (production), `dev` (integration).
- **Feature work branches from `dev`** and opens a PR **into `dev`**.
- Promote `dev` → `main` only via a dedicated release PR (or controlled fast-forward).
- Hotfixes: branch from `main` as `fix/…` or `hotfix/…`, PR into `main`, then merge/cherry-pick back to `dev`.

### Branch names

`<type>/<short-kebab-description>`

| Prefix      | Use                               |
| ----------- | --------------------------------- |
| `feat/`     | New capability                    |
| `fix/`      | Bug fix                           |
| `chore/`    | Tooling, deps                     |
| `test/`     | Tests only                        |
| `docs/`     | Documentation                     |
| `refactor/` | Internal reshape                  |
| `hotfix/`   | Urgent production fix from `main` |

## Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(optional-scope): <imperative summary>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`.  
Suggested scopes: `domain`, `api`, `mcp`, `web`, `db`, `auth`, `grading`, `versioning`, `ci`, `docs`.

## Pull requests

- One shippable outcome per PR.
- Default base: **`dev`**.
- Before opening: `pnpm check` (typecheck, lint, format:check, unit).
- Touching API/db/persistence: run integration locally (`pnpm test:integration` or Compose test stack).
- Required CI: lint, typecheck, unit (see `.github/workflows/ci.yml`).
- Do not commit secrets (`.env`, keys, passwords).

## Local checks

```bash
pnpm install
pnpm check
pnpm test:regression

# Integration (host harness is thin until Postgres wiring lands)
pnpm test:integration

# Full ephemeral stack (when migrations exist)
cp .env.example .env
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from integration-tests
docker compose -f docker-compose.test.yml down -v
```

## Docs & ADRs

- Process and layout: [`docs/engineering-standards.md`](./docs/engineering-standards.md)
- Non-obvious decisions: add an ADR under `docs/adr/` (`NNNN-short-title.md`)
