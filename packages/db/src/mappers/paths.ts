import type { Path, PathEnrollment, PathNode, PathProgress } from '@lp/domain';
import { resourceOwnerFromColumns } from '@lp/domain';

export interface PathRow {
  id: string;
  orgId: string | null;
  ownerUserId: string | null;
  slug: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PathNodeRow {
  id: string;
  pathId: string;
  parentId: string | null;
  title: string | null;
  order: number;
  courseId: string;
  sectionId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PathEnrollmentRow {
  id: string;
  pathId: string;
  userId: string;
  orgId: string | null;
  enrolledAt: Date;
  revokedAt: Date | null;
}

export interface PathProgressRow {
  enrollmentId: string;
  completedNodeIds: string[];
  currentNodeId: string | null;
  percent: number;
  updatedAt: Date;
}

export function mapPath(row: PathRow): Path {
  const owner = resourceOwnerFromColumns(row.orgId, row.ownerUserId);
  return {
    id: row.id,
    owner,
    orgId: owner.kind === 'org' ? owner.orgId : null,
    ownerUserId: owner.kind === 'user' ? owner.userId : null,
    slug: row.slug,
    title: row.title,
    description: row.description,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function mapPathNode(row: PathNodeRow): PathNode {
  return {
    id: row.id,
    pathId: row.pathId,
    parentId: row.parentId,
    title: row.title,
    order: row.order,
    courseId: row.courseId,
    sectionId: row.sectionId,
  };
}

export function mapPathEnrollment(row: PathEnrollmentRow): PathEnrollment {
  return {
    id: row.id,
    pathId: row.pathId,
    userId: row.userId,
    orgId: row.orgId,
    enrolledAt: row.enrolledAt,
    revokedAt: row.revokedAt,
  };
}

export function mapPathProgress(row: PathProgressRow): PathProgress {
  return {
    enrollmentId: row.enrollmentId,
    completedNodeIds: row.completedNodeIds ?? [],
    currentNodeId: row.currentNodeId,
    percent: row.percent,
    updatedAt: row.updatedAt,
  };
}
