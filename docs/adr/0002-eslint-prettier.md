# 0002 — ESLint + Prettier (not Biome)

- **Status:** accepted
- **Date:** 2026-11-10

## Context

Engineering standards allow ESLint + Prettier or Biome as a single-tool alternative, but not both formatters.

## Decision

Adopt **ESLint flat config** with **typescript-eslint** and **Prettier** for formatting. Biome is deferred unless the team revisits tooling in a later ADR.

## Consequences

- Root scripts: `lint`, `lint:fix`, `format`, `format:check`.
- Prettier disables conflicting ESLint stylistic rules via `eslint-config-prettier`.
