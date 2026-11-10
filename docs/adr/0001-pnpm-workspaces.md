# 0001 — pnpm workspaces for the monorepo

- **Status:** accepted
- **Date:** 2026-11-10

## Context

The Learning Platform needs a TypeScript monorepo with multiple apps (`api`, `web`, `mcp`) and shared packages (`domain`, `db`, `config`). We need a package manager that handles workspace linking, filtered scripts, and Docker-friendly installs.

## Decision

Use **pnpm workspaces** (`pnpm-workspace.yaml`) with package names under the `@lp/*` scope. Shared TypeScript bases live in `@lp/tsconfig`; shared ESLint config in `@lp/eslint-config`.

## Consequences

- Root scripts orchestrate `lint`, `typecheck`, `test:*` across the workspace.
- Docker multi-stage builds copy workspace manifests first, then run `pnpm install` / filtered builds.
- Contributors must use pnpm (see `packageManager` in the root `package.json`).
