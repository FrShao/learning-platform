/** Canonical Path types — user- or org-owned learning journeys as strict trees of lessons. */

import type {
  CourseId,
  OrgId,
  PathEnrollmentId,
  PathId,
  PathNodeId,
  SectionId,
  UserId,
} from '../ids.js';
import type { ResourceOwner } from '../ownership.js';

export type { CourseId, OrgId, PathEnrollmentId, PathId, PathNodeId, SectionId, UserId };

export type { ResourceOwner };

/**
 * Lesson reference: a course section (v1: section = lesson unit) in a published course.
 * Paths point at live course+section ids; they do not snapshot course content.
 */
export interface LessonRef {
  courseId: CourseId;
  sectionId: SectionId;
}

/** User- or org-owned learning journey metadata. Tree lives in PathNode rows. */
export interface Path {
  id: PathId;
  /** Exclusive owner: personal user or organization. */
  owner: ResourceOwner;
  /** Convenience mirror of owner when kind === 'org'; else null. */
  orgId: OrgId | null;
  /** Convenience mirror of owner when kind === 'user'; else null. */
  ownerUserId: UserId | null;
  slug: string;
  title: string;
  description: string;
  createdBy: UserId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Single-parent tree node. `parentId === null` means root.
 * `title` optionally overrides the referenced section title in path UI.
 */
export interface PathNode {
  id: PathNodeId;
  pathId: PathId;
  parentId: PathNodeId | null;
  title: string | null;
  order: number;
  courseId: CourseId;
  sectionId: SectionId;
}

export interface PathEnrollment {
  id: PathEnrollmentId;
  pathId: PathId;
  userId: UserId;
  /** Denormalized from path; null for personal paths. */
  orgId: OrgId | null;
  enrolledAt: Date;
  revokedAt: Date | null;
}

export interface PathProgress {
  enrollmentId: PathEnrollmentId;
  completedNodeIds: PathNodeId[];
  currentNodeId: PathNodeId | null;
  percent: number;
  updatedAt: Date;
}

/** Input for inserting a node into an in-memory tree. */
export interface PathNodeInput {
  id: PathNodeId;
  parentId: PathNodeId | null;
  title?: string | null;
  order?: number;
  courseId: CourseId;
  sectionId: SectionId;
  pathId?: PathId;
}

export interface PathNodeUnlockState {
  nodeId: PathNodeId;
  unlocked: boolean;
  completed: boolean;
}
