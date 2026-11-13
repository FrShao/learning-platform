# 0005 — Courses and paths owned by a user or an organization

- Status: accepted
- Date: 2026-11-12

## Context

Phase 1 assumed every course and path lived under an organization. Authors without an org (or who preferred a personal workspace) could not create content. We needed ownership that supports:

1. **Personal** courses/paths created by an authenticated user with no org context.
2. **Org-owned** courses/paths that keep today’s membership + author role rules.
3. Clear ACL: the owning user has full control; org roles apply only to org-owned resources.

## Decision

Model exclusive ownership as:

```ts
type ResourceOwner = { kind: 'user'; userId: UserId } | { kind: 'org'; orgId: OrgId };
```

Persist with nullable `org_id` and `owner_user_id` columns and a CHECK that exactly one is set (XOR). Slug uniqueness is scoped per owner (`(org_id, slug)` or `(owner_user_id, slug)` among non-deleted rows).

API:

- Personal: `GET|POST /v1/me/courses`, `GET|POST /v1/me/paths` (JWT user session required).
- Org: existing `/v1/orgs/:orgId/courses|paths` (membership; author+ to create).

Authoring ACL uses `canAuthorOwnedResource`; learning ACL uses `canLearnOwnedResource` (personal published content is learnable by any authenticated user; org content still requires enroll capability).

## Consequences

- Creating courses/paths no longer requires joining or creating an organization.
- Assets remain org-scoped for now; personal course editors disable image upload until personal assets exist.
- Path and course enrollments may carry a null `org_id` when the resource is personal.
- Web adds a Personal library (`/app/me/...`) alongside org shells.
