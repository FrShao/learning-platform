/** Canonical domain types and pure helpers. See docs/domain-object-models.md. */

export type {
  ApiKeyId,
  AssetId,
  ContentBlockId,
  CourseBranchId,
  CourseCommitId,
  CourseId,
  CourseSnapshotId,
  EnrollmentId,
  FormAttemptId,
  OptionId,
  OrgId,
  PathEnrollmentId,
  PathId,
  PathNodeId,
  QuestionId,
  RefreshTokenId,
  SectionId,
  SessionId,
  UserId,
} from './ids.js';

export type {
  AccessTokenClaims,
  ApiKey,
  ApiKeyCreated,
  ApiKeyScope,
  OAuthProvider,
  Organization,
  OrgMembership,
  OrgRole,
  OrgSettings,
  PublicUser,
  RefreshToken,
  User,
} from './identity.js';

export {
  API_KEY_SCOPES,
  DEFAULT_ORG_SETTINGS,
  normalizeEmail,
  ORG_ROLES,
  toPublicUser,
} from './identity.js';

export { isValidOrgSlug, normalizeOrgSlug } from './org-slug.js';

export type { OrgCapability } from './roles.js';
export {
  canAssignRole,
  canChangeSoleOwner,
  canManageMemberRole,
  roleHasCapability,
} from './roles.js';

export { hashPassword, verifyPassword } from './password.js';

export {
  apiKeyDisplayPrefix,
  generateApiKeySecret,
  hashApiKey,
  verifyApiKey,
} from './api-key-crypto.js';

export type {
  BlockBase,
  BooleanQuestion,
  ChartGraphSpec,
  ChartKind,
  ContentBlock,
  ContentBlockType,
  CourseTree,
  DiagramFormat,
  DiagramGraphSpec,
  FormBlock,
  FormSpec,
  GraphBlock,
  GraphKind,
  GraphSpec,
  ImageBlock,
  LongTextQuestion,
  MultiSelectQuestion,
  NumberQuestion,
  Option,
  PassRule,
  PassRuleMode,
  Question,
  QuestionBase,
  QuestionType,
  Section,
  ShortTextQuestion,
  SingleSelectQuestion,
  TextBlock,
} from './content/types.js';

export { DEFAULT_PASS_RULE } from './content/types.js';

export type { ValidationIssue, ValidationResult } from './content/validate.js';
export { validateContentBlock, validateFormSpec, validateGraphSpec } from './content/validate.js';

export type {
  AnswerValue,
  FormGradeResult,
  GradeFormError,
  GradeFormErrorCode,
  GradeFormOutcome,
  QuestionGrade,
  QuestionGradeStatus,
} from './grading/types.js';

export { isAutoGradable } from './grading/auto-gradable.js';
export { gradeQuestion } from './grading/grade-question.js';
export { gradeForm, gradeFormOrThrow } from './grading/grade-form.js';

export type {
  Actor,
  Course,
  CourseBranch,
  CourseCommit,
  CourseSnapshot,
  CourseWorkingTree,
  TreeDiff,
  TreeDiffEntry,
  TreeDiffKind,
  TreePatch,
  TreePatchOp,
} from './course/types.js';

export { DomainError } from './course/types.js';

export {
  applyTreePatch,
  canonicalizeTreeJson,
  cloneCourseTree,
  diffCourseTrees,
  emptyCourseTree,
  hashCourseTree,
  isValidBranchName,
  isValidCourseSlug,
  normalizeCourseSlug,
  normalizeSectionOrders,
  validateCourseTree,
} from './course/index.js';

export type {
  LessonRef,
  Path,
  PathEnrollment,
  PathNode,
  PathNodeInput,
  PathNodeUnlockState,
  PathProgress,
} from './path/index.js';

export {
  canCompletePathNode,
  childrenOf,
  clonePathNodes,
  computePathPercent,
  deletePathNode,
  insertPathNode,
  isDescendant,
  isPathNodeCompleted,
  isPathNodeUnlocked,
  movePathNode,
  nextPathNodeId,
  normalizeSiblingOrders,
  pathNodeUnlockStates,
  pathRootCount,
  reorderPathSiblings,
  replacePathTree,
  rootNodes,
  validatePathTree,
  walkPathNodes,
} from './path/index.js';
