/**
 * Learner enrollment, published read, progress, and form attempts.
 *
 * Owns apps/api/src/learner only. Auth and course versioning are injected via
 * ports. Form graders are vendored stubs until @lp/domain exporters land.
 */

export { LearnerError, toErrorBody } from './errors.js';
export { gradeFormAttempt, type FormGradeResult } from './graders.js';
export {
  handleLearnerRequest,
  matchLearnerRoute,
  stubResolveLearnerActor,
  type LearnerHttpDeps,
} from './http.js';
export {
  DEFAULT_ORG_SETTINGS,
  type CoursePublishedReader,
  type HeadersLike,
  type LearnerActor,
  type MembershipRecord,
  type OrgMembershipReader,
  type ResolveLearnerActor,
} from './ports.js';
export {
  computePercent,
  findFormBlock,
  findSection,
  formBlocksInSection,
  isSectionUnlocked,
  nextSectionId,
  orderedSections,
  sectionFormsSatisfied,
} from './progression.js';
export { LearnerService, type EnrollResult, type LearnerServiceDeps } from './service.js';
export {
  MemoryLearnerStore,
  type CreateEnrollmentInput,
  type CreateFormAttemptInput,
  type LearnerStore,
} from './store.js';
export type * from './types.js';

import { stubResolveLearnerActor } from './http.js';
import type { CoursePublishedReader, OrgMembershipReader, ResolveLearnerActor } from './ports.js';
import { LearnerService } from './service.js';
import { MemoryLearnerStore, type LearnerStore } from './store.js';

export interface CreateLearnerRuntimeOptions {
  store?: LearnerStore;
  courses: CoursePublishedReader;
  memberships: OrgMembershipReader;
  resolveActor?: ResolveLearnerActor;
  clock?: () => Date;
}

export interface LearnerRuntime {
  service: LearnerService;
  store: LearnerStore;
  resolveActor: ResolveLearnerActor;
}

/**
 * Assemble a learner runtime. Defaults to an in-memory store and stub actor
 * resolver so the API can boot before auth/db wiring lands.
 */
export function createLearnerRuntime(options: CreateLearnerRuntimeOptions): LearnerRuntime {
  const store = options.store ?? new MemoryLearnerStore();
  const service = new LearnerService({
    store,
    courses: options.courses,
    memberships: options.memberships,
    ...(options.clock ? { clock: options.clock } : {}),
  });
  return {
    service,
    store,
    resolveActor: options.resolveActor ?? stubResolveLearnerActor,
  };
}
