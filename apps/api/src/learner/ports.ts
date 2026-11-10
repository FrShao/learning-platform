import type {
  CourseId,
  CourseSummary,
  OrgId,
  OrgRole,
  OrgSettings,
  PublishedCourseView,
  UserId,
} from './types.js';

/** Authenticated user actor for learner flows (API keys do not enroll). */
export interface LearnerActor {
  kind: 'user';
  userId: UserId;
}

export interface MembershipRecord {
  orgId: OrgId;
  userId: UserId;
  role: OrgRole;
}

/**
 * Resolve the calling user. Auth module owns real JWT/session resolution;
 * learner mounts whatever resolver is injected at boot.
 */
export type ResolveLearnerActor = (headers: HeadersLike) => Promise<LearnerActor | null>;

export interface HeadersLike {
  get(name: string): string | null;
}

/**
 * Course published-read port. Course versioning module owns real persistence;
 * learner only needs published metadata + tree.
 */
export interface CoursePublishedReader {
  getCourse(courseId: CourseId): Promise<CourseSummary | null>;
  getPublished(courseId: CourseId): Promise<PublishedCourseView | null>;
}

export interface OrgMembershipReader {
  getMembership(orgId: OrgId, userId: UserId): Promise<MembershipRecord | null>;
  getOrgSettings(orgId: OrgId): Promise<OrgSettings>;
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  enforceSequentialProgress: true,
  republishProgressPolicy: 'keep',
};
