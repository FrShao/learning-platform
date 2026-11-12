# 0004 — Paths keep a mutable tree pointing at published course sections

- Status: accepted
- Date: 2026-11-12

## Context

A **Path** is an org-owned learning journey: a single-parent tree of nodes. Each node references a lesson, and in this product a lesson is a course **section** (`section = lesson unit`). Course content itself is already versioned with a git-like model (working tree → commit → publish).

We needed to choose how path trees relate to course versioning:

1. **Snapshot on course publish** — copy section identity/content into an immutable path revision whenever a referenced course publishes.
2. **Mutable path definition** — store the path tree as editable org content; each node holds live `(courseId, sectionId)` pointers into published courses.

## Decision

Use **mutable path definitions** that point at **published course sections** via `(courseId, sectionId)`.

- Path metadata and the node tree can be edited in place (CRUD + tree replace / node ops).
- Nodes do **not** pin a `publishedCommitId`; learners resolve lesson content from the course’s current published snapshot.
- Unlock rules live on the path tree (parent completion + optional org sequential sibling order), independent of course-commit snapshots.

## Consequences

- Authors can restructure journeys without republishing courses.
- If a section id disappears from a course’s published tree, the path node may dangle until authors fix the ref (v1 does not auto-migrate).
- Progress is stored per path enrollment (`completedNodeIds`), not derived solely from course enrollment progress.
- A later ADR may add path revisions or pin `publishedCommitId` per node if reproducibility becomes a product requirement.
