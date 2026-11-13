import type { OrgId, OrgRole, UserId } from '@lp/domain';

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'merge_conflict'
  | 'network'
  | 'unknown';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode | string;
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  readonly code: ApiErrorCode | string;
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, body: ApiErrorBody | null, fallbackMessage: string) {
    const message = body?.error.message ?? fallbackMessage;
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.error.code ?? (status === 0 ? 'network' : 'unknown');
    this.details = body?.error.details;
  }
}

export interface PublicUser {
  id: UserId;
  email: string;
  name: string;
}

export interface OrgMembershipSummary {
  orgId: OrgId;
  role: OrgRole;
  org: {
    id: OrgId;
    slug: string;
    name: string;
  };
}

export interface MeResponse {
  user: PublicUser;
  memberships: OrgMembershipSummary[];
}

export interface AuthTokenResponse {
  accessToken?: string;
  token?: string;
  user: PublicUser;
}

export interface OrganizationDto {
  id: OrgId;
  slug: string;
  name: string;
  settings?: {
    enforceSequentialProgress: boolean;
    republishProgressPolicy: 'keep' | 'reset';
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface OrgMemberDto {
  userId: UserId;
  email: string;
  name: string;
  role: OrgRole;
  createdAt?: string;
}

export type ApiKeyScope =
  'courses:read' | 'courses:write' | 'courses:publish' | 'assets:write' | 'members:read';

export interface ApiKeyDto {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt?: string | null;
}

export interface ApiKeyCreatedDto extends ApiKeyDto {
  secret: string;
}

export type ResourceOwnerDto = { kind: 'user'; userId: UserId } | { kind: 'org'; orgId: OrgId };

export interface CourseDto {
  id: string;
  owner?: ResourceOwnerDto;
  orgId: OrgId | null;
  ownerUserId?: UserId | null;
  slug: string;
  title: string;
  description: string;
  defaultBranch: string;
  publishedCommitId: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseBranchDto {
  name: string;
  headCommitId: string | null;
  createdAt?: string;
}

export interface CourseCommitDto {
  id: string;
  message: string;
  authorId: UserId;
  parentIds: string[];
  createdAt: string;
}

export type PassRuleDto = { mode: 'all_correct' } | { mode: 'min_score'; min: number };

export type QuestionDto =
  | { id: string; type: 'short_text'; prompt: string; expected?: string; caseSensitive?: boolean }
  | { id: string; type: 'long_text'; prompt: string; rubric?: string }
  | {
      id: string;
      type: 'single_select';
      prompt: string;
      options: Array<{ id: string; label: string }>;
      correctOptionId: string;
    }
  | {
      id: string;
      type: 'multi_select';
      prompt: string;
      options: Array<{ id: string; label: string }>;
      correctOptionIds: string[];
    }
  | { id: string; type: 'boolean'; prompt: string; correct: boolean }
  | { id: string; type: 'number'; prompt: string; correct: number; tolerance?: number };

export interface FormSpecDto {
  title?: string | undefined;
  questions: QuestionDto[];
  passRule?: PassRuleDto | undefined;
}

export interface CourseSectionDto {
  id: string;
  slug: string;
  title: string;
  order: number;
  blocks: CourseBlockDto[];
}

export type ChartKind = 'line' | 'bar' | 'pie' | 'scatter';

export type GraphSpecDto =
  | { kind: 'chart'; chart: ChartKind; data: unknown; options?: unknown }
  | { kind: 'diagram'; format: 'mermaid'; source: string };

export type CourseBlockDto =
  | { id: string; type: 'text'; markdown: string }
  | { id: string; type: 'image'; assetId: string; alt?: string; caption?: string }
  | {
      id: string;
      type: 'graph';
      /** Canonical nested graph spec (authoring + domain). */
      spec?: GraphSpecDto;
      /** Legacy flat fields tolerated by published readers. */
      kind?: 'chart' | 'mermaid' | 'diagram';
      source?: string;
    }
  | {
      id: string;
      type: 'form';
      form?: FormSpecDto;
      /** Legacy flat fields tolerated by published readers. */
      title?: string;
      passRule?: 'all_correct' | 'min_score' | PassRuleDto;
      minScore?: number;
      questions?: QuestionDto[];
    };

export interface AssetDto {
  id: string;
  url: string;
  mime?: string;
  size?: number;
  originalFilename?: string | null;
}

export interface CourseTreeDto {
  sections: CourseSectionDto[];
}

export interface WorkingTreeDto {
  baseCommitId: string | null;
  dirtyTree: CourseTreeDto;
  updatedAt?: string;
}

export interface DiffDto {
  baseCommitId: string | null;
  hunks?: unknown[];
  summary?: string;
  clean?: boolean;
}

export interface EnrollmentDto {
  id: string;
  courseId: string;
  userId: UserId;
  orgId: OrgId | null;
  createdAt?: string;
  enrolledAt?: string;
  revokedAt?: string | null;
}

export interface CatalogResponse {
  courses: CourseDto[];
  paths: PathDto[];
}

export interface CourseEnrollmentRowDto {
  enrollment: EnrollmentDto;
  progress: LearnerProgressDto | null;
  course: CourseDto | null;
}

export interface PathEnrollmentRowDto {
  enrollment: PathEnrollmentDto;
  progress: PathProgressDto | null;
  path: PathDto | null;
}

export interface MyEnrollmentsResponse {
  courses: CourseEnrollmentRowDto[];
  paths: PathEnrollmentRowDto[];
}

export interface LearnerProgressDto {
  enrollmentId: string;
  courseId: string;
  percent: number;
  currentSectionId: string | null;
  completedSectionIds: string[];
  publishedCommitId: string;
  updatedAt?: string;
}

export type QuestionGradeStatus = 'correct' | 'incorrect' | 'pending' | 'ungraded';

export interface QuestionGradeDto {
  questionId: string;
  status: QuestionGradeStatus;
  points?: number;
}

export type AnswerValueDto =
  | { questionId: string; type: 'short_text'; value: string }
  | { questionId: string; type: 'long_text'; value: string }
  | { questionId: string; type: 'single_select'; optionId: string }
  | { questionId: string; type: 'multi_select'; optionIds: string[] }
  | { questionId: string; type: 'boolean'; value: boolean }
  | { questionId: string; type: 'number'; value: number };

export interface FormAttemptResultDto {
  score: number | null;
  passed: boolean | null;
  grades: QuestionGradeDto[];
  id?: string | undefined;
  formBlockId?: string | undefined;
}

export interface PathDto {
  id: string;
  owner?: ResourceOwnerDto;
  orgId: OrgId | null;
  ownerUserId?: UserId | null;
  slug: string;
  title: string;
  description: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface PathNodeDto {
  id: string;
  pathId: string;
  parentId: string | null;
  title: string | null;
  order: number;
  courseId: string;
  sectionId: string;
}

export interface PathEnrollmentDto {
  id: string;
  pathId: string;
  userId: UserId;
  orgId: OrgId | null;
  enrolledAt: string;
  revokedAt: string | null;
}

export interface PathProgressDto {
  enrollmentId: string;
  completedNodeIds: string[];
  currentNodeId: string | null;
  percent: number;
  updatedAt: string;
}

export interface PathProgressResponse {
  path: PathDto;
  enrollment: PathEnrollmentDto;
  progress: PathProgressDto;
  nodes: PathNodeDto[];
  unlockedNodeIds: string[];
}
