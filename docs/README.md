# Documentation

| Doc                                                    | Role                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| [engineering-standards.md](./engineering-standards.md) | Monorepo layout, branching, commits, lint, testing, Docker process        |
| [docker-and-compose.md](./docker-and-compose.md)       | Compose services, profiles, local/CI/prod runbook                         |
| [docker/](./docker/)                                   | Source copies of Compose/Dockerfiles (repo root is canonical for running) |
| [adr/](./adr/)                                         | Architecture Decision Records                                             |

## Product design (summary)

The platform lets organizations author **versioned courses** (working tree → commit → publish), compose **Paths** (mutable trees of published course sections), and enroll learners against the **published** commit / path unlock rules. REST (`apps/api`) and MCP (`apps/mcp`) share the same domain services; the web app (`apps/web`) is the author/learner UI.

Canonical TypeScript shapes and invariants for identity, orgs, course trees, paths, forms, and progress live in `packages/domain` (see engineering standards for package ownership). Full product/API and screen specs are maintained with the project design set; keep this repo’s `docs/` focused on engineering contracts and ADRs unless a design doc needs to ship with a PR.

## Related ADRs

- [0001 — pnpm workspaces](./adr/0001-pnpm-workspaces.md)
- [0002 — ESLint + Prettier](./adr/0002-eslint-prettier.md)
- [0003 — Drizzle for course schema](./adr/0003-drizzle-for-course-schema.md)
- [0004 — Paths: mutable lesson refs](./adr/0004-path-mutable-lesson-refs.md)
