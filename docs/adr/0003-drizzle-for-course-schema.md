# 0003 — Drizzle ORM for course versioning schema

- Status: accepted
- Date: 2026-11-10

## Context

Phase 1 persistence needs PostgreSQL tables for Course / Branch / Commit / Snapshot / WorkingTree. The monorepo scaffold left `@lp/db` as a stub. Prisma and Drizzle were both listed as options in the product plan.

Auth/org tables are owned by a parallel track; course migrations must stay courses-only and cannot assume user/org FK targets exist yet.

## Decision

Use **Drizzle ORM** + `postgres` (postgres.js) for the course schema and repositories, with hand-written SQL migrations under `packages/db/migrations/` applied by `migrate:deploy`.

## Consequences

- Schema lives in `packages/db/src/schema/courses.ts`; SQL source of truth for deploy is `migrations/0001_courses.sql`.
- `org_id` / `created_by` / `author_id` / `updated_by` are UUID columns without FK to auth tables until those land; FKs can be added in a follow-up migration.
- Application services in `apps/api` orchestrate; pure tree ops stay in `@lp/domain`.
