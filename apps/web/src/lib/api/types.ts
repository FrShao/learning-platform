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

export interface CourseDto {
  id: string;
  orgId: OrgId;
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

export interface CourseSectionDto {
  id: string;
  slug: string;
  title: string;
  order: number;
  blocks: CourseBlockDto[];
}

export type CourseBlockDto =
  | { id: string; type: 'text'; markdown: string }
  | { id: string; type: 'image'; assetId: string; alt?: string; caption?: string }
  | { id: string; type: 'graph'; kind: 'chart' | 'mermaid'; source: string }
  | {
      id: string;
      type: 'form';
      title: string;
      passRule: 'all_correct' | 'min_score';
      minScore?: number;
      questions: unknown[];
    };

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
  orgId: OrgId;
  createdAt?: string;
}

export interface LearnerProgressDto {
  enrollmentId: string;
  courseId: string;
  percent: number;
  currentSectionId: string | null;
  completedSectionIds: string[];
  publishedCommitId: string;
}

export interface FormAttemptResultDto {
  score: number | null;
  passed: boolean | null;
  grades: unknown[];
}
