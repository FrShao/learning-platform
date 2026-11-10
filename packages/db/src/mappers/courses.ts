import type {
  Course,
  CourseBranch,
  CourseCommit,
  CourseSnapshot,
  CourseTree,
  CourseWorkingTree,
} from '@lp/domain';

export interface CourseRow {
  id: string;
  orgId: string;
  slug: string;
  title: string;
  description: string;
  defaultBranch: string;
  publishedCommitId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface BranchRow {
  id: string;
  courseId: string;
  name: string;
  headCommitId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommitRow {
  id: string;
  courseId: string;
  branchIdAtCreate: string;
  parentIds: string[];
  message: string;
  authorId: string;
  snapshotId: string;
  createdAt: Date;
}

export interface SnapshotRow {
  id: string;
  tree: CourseTree;
  contentHash: string;
  createdAt: Date;
}

export interface WorkingTreeRow {
  courseId: string;
  branchId: string;
  baseCommitId: string | null;
  dirtyTree: CourseTree;
  updatedBy: string;
  updatedAt: Date;
}

export function mapCourse(row: CourseRow): Course {
  return {
    id: row.id,
    orgId: row.orgId,
    slug: row.slug,
    title: row.title,
    description: row.description,
    defaultBranch: row.defaultBranch,
    publishedCommitId: row.publishedCommitId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function mapBranch(row: BranchRow): CourseBranch {
  return {
    id: row.id,
    courseId: row.courseId,
    name: row.name,
    headCommitId: row.headCommitId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapCommit(row: CommitRow): CourseCommit {
  return {
    id: row.id,
    courseId: row.courseId,
    branchIdAtCreate: row.branchIdAtCreate,
    parentIds: row.parentIds ?? [],
    message: row.message,
    authorId: row.authorId,
    snapshotId: row.snapshotId,
    createdAt: row.createdAt,
  };
}

export function mapSnapshot(row: SnapshotRow): CourseSnapshot {
  return {
    id: row.id,
    tree: row.tree,
    contentHash: row.contentHash,
    createdAt: row.createdAt,
  };
}

export function mapWorkingTree(row: WorkingTreeRow): CourseWorkingTree {
  return {
    courseId: row.courseId,
    branchId: row.branchId,
    baseCommitId: row.baseCommitId,
    dirtyTree: row.dirtyTree,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}
