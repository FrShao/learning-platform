/** Canonical course / git-versioning types. See domain-object-models.md §2–§3. */

import type { ContentBlock, CourseTree, Section } from '../content/types.js';
import type { ApiKeyScope } from '../identity.js';
import type {
  AssetId,
  ContentBlockId,
  CourseBranchId,
  CourseCommitId,
  CourseId,
  CourseSnapshotId,
  OptionId,
  OrgId,
  QuestionId,
  SectionId,
  UserId,
} from '../ids.js';

export type {
  ApiKeyScope,
  AssetId,
  ContentBlock,
  ContentBlockId,
  CourseBranchId,
  CourseCommitId,
  CourseId,
  CourseSnapshotId,
  CourseTree,
  OptionId,
  OrgId,
  QuestionId,
  Section,
  SectionId,
  UserId,
};

/** Actor resolved by auth middleware (JWT user or API key). */
export type Actor =
  | { kind: 'user'; userId: UserId }
  | { kind: 'api_key'; apiKeyId: string; orgId: OrgId; scopes: ApiKeyScope[] };

export interface Course {
  id: CourseId;
  orgId: OrgId;
  slug: string;
  title: string;
  description: string;
  defaultBranch: string;
  publishedCommitId: CourseCommitId | null;
  createdBy: UserId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CourseBranch {
  id: CourseBranchId;
  courseId: CourseId;
  name: string;
  headCommitId: CourseCommitId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseCommit {
  id: CourseCommitId;
  courseId: CourseId;
  branchIdAtCreate: CourseBranchId;
  parentIds: CourseCommitId[];
  message: string;
  authorId: UserId;
  snapshotId: CourseSnapshotId;
  createdAt: Date;
}

export interface CourseSnapshot {
  id: CourseSnapshotId;
  tree: CourseTree;
  contentHash: string;
  createdAt: Date;
}

export interface CourseWorkingTree {
  courseId: CourseId;
  branchId: CourseBranchId;
  baseCommitId: CourseCommitId | null;
  dirtyTree: CourseTree;
  updatedBy: UserId;
  updatedAt: Date;
}

export type TreePatchOp =
  | {
      op: 'upsert_section';
      section: Omit<Section, 'blocks'> & { blocks?: ContentBlock[] };
    }
  | { op: 'delete_section'; sectionId: SectionId }
  | { op: 'reorder_sections'; sectionIds: SectionId[] }
  | { op: 'upsert_block'; sectionId: SectionId; block: ContentBlock }
  | { op: 'delete_block'; sectionId: SectionId; blockId: ContentBlockId }
  | { op: 'reorder_blocks'; sectionId: SectionId; blockIds: ContentBlockId[] };

export interface TreePatch {
  ops: TreePatchOp[];
}

export type TreeDiffKind =
  | 'section_added'
  | 'section_removed'
  | 'section_changed'
  | 'block_added'
  | 'block_removed'
  | 'block_changed';

export interface TreeDiffEntry {
  kind: TreeDiffKind;
  sectionId: SectionId;
  blockId?: ContentBlockId;
  before?: unknown;
  after?: unknown;
}

export interface TreeDiff {
  entries: TreeDiffEntry[];
}

export class DomainError extends Error {
  readonly code: 'validation' | 'conflict' | 'not_found';
  readonly details?: unknown;

  constructor(code: 'validation' | 'conflict' | 'not_found', message: string, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}
