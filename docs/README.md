# Documentation

| Doc                                                    | Role                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| [engineering-standards.md](./engineering-standards.md) | Monorepo layout, branching, commits, lint, testing, Docker process        |
| [docker-and-compose.md](./docker-and-compose.md)       | Compose services, profiles, local/CI/prod runbook                         |
| [docker/](./docker/)                                   | Source copies of Compose/Dockerfiles (repo root is canonical for running) |
| [adr/](./adr/)                                         | Architecture Decision Records                                             |

## Product design (summary)

The platform lets organizations author **versioned courses** (working tree → commit → publish) and enroll learners against the **published** commit. REST (`apps/api`) and MCP (`apps/mcp`) share the same domain services; the web app (`apps/web`) is the author/learner UI.

Canonical TypeScript shapes and invariants for identity, orgs, course trees, forms, and progress will live alongside Phase 1 implementation (see engineering standards for package ownership). Full product/API and screen specs are maintained with the project design set; keep this repo’s `docs/` focused on engineering contracts and ADRs unless a design doc needs to ship with a PR.

## Related ADRs

- [0001 — pnpm workspaces](./adr/0001-pnpm-workspaces.md)
- [0002 — ESLint + Prettier](./adr/0002-eslint-prettier.md)
