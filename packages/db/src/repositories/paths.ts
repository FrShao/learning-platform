import {
  DomainError,
  computePathPercent,
  nextPathNodeId,
  normalizeSiblingOrders,
  validatePathTree,
  type Path,
  type PathEnrollment,
  type PathNode,
  type PathProgress,
} from '@lp/domain';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import type { Db } from '../client.js';
import { mapPath, mapPathEnrollment, mapPathNode, mapPathProgress } from '../mappers/paths.js';
import { learningPaths, pathEnrollments, pathNodes, pathProgress } from '../schema/paths.js';

export interface CreatePathInput {
  /** Exactly one of orgId / ownerUserId. */
  orgId?: string | null;
  ownerUserId?: string | null;
  slug: string;
  title: string;
  description: string;
  createdBy: string;
}

export class PathRepository {
  constructor(private readonly db: Db) {}

  async listByOrg(orgId: string): Promise<Path[]> {
    const rows = await this.db
      .select()
      .from(learningPaths)
      .where(and(eq(learningPaths.orgId, orgId), isNull(learningPaths.deletedAt)))
      .orderBy(desc(learningPaths.updatedAt));
    return rows.map(mapPath);
  }

  async listByOwnerUser(ownerUserId: string): Promise<Path[]> {
    const rows = await this.db
      .select()
      .from(learningPaths)
      .where(and(eq(learningPaths.ownerUserId, ownerUserId), isNull(learningPaths.deletedAt)))
      .orderBy(desc(learningPaths.updatedAt));
    return rows.map(mapPath);
  }

  async getById(pathId: string): Promise<Path | null> {
    const rows = await this.db
      .select()
      .from(learningPaths)
      .where(and(eq(learningPaths.id, pathId), isNull(learningPaths.deletedAt)))
      .limit(1);
    const row = rows[0];
    return row ? mapPath(row) : null;
  }

  async createPath(input: CreatePathInput): Promise<Path> {
    const orgId = input.orgId ?? null;
    const ownerUserId = input.ownerUserId ?? null;
    if ((orgId == null) === (ownerUserId == null)) {
      throw new DomainError(
        'validation',
        'Path ownership requires exactly one of orgId or ownerUserId',
      );
    }

    const now = new Date();
    const [row] = await this.db
      .insert(learningPaths)
      .values({
        orgId,
        ownerUserId,
        slug: input.slug,
        title: input.title,
        description: input.description,
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new DomainError('conflict', 'Failed to create path');
    }
    return mapPath(row);
  }

  async updatePath(
    pathId: string,
    patch: { title?: string; description?: string; slug?: string },
  ): Promise<Path> {
    const existing = await this.getById(pathId);
    if (!existing) {
      throw new DomainError('not_found', 'Path not found');
    }
    const now = new Date();
    const [row] = await this.db
      .update(learningPaths)
      .set({
        title: patch.title ?? existing.title,
        description: patch.description ?? existing.description,
        slug: patch.slug ?? existing.slug,
        updatedAt: now,
      })
      .where(and(eq(learningPaths.id, pathId), isNull(learningPaths.deletedAt)))
      .returning();
    if (!row) {
      throw new DomainError('not_found', 'Path not found');
    }
    return mapPath(row);
  }

  async softDeletePath(pathId: string): Promise<Path> {
    const now = new Date();
    const [row] = await this.db
      .update(learningPaths)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(learningPaths.id, pathId), isNull(learningPaths.deletedAt)))
      .returning();
    if (!row) {
      throw new DomainError('not_found', 'Path not found');
    }
    return mapPath(row);
  }

  async listNodes(pathId: string): Promise<PathNode[]> {
    const rows = await this.db
      .select()
      .from(pathNodes)
      .where(eq(pathNodes.pathId, pathId))
      .orderBy(asc(pathNodes.order));
    return normalizeSiblingOrders(rows.map(mapPathNode));
  }

  /**
   * Replace the entire node tree for a path in one transaction.
   * Domain validation runs before write.
   */
  async replaceTree(pathId: string, nodes: PathNode[]): Promise<PathNode[]> {
    const path = await this.getById(pathId);
    if (!path) {
      throw new DomainError('not_found', 'Path not found');
    }

    const withPath = nodes.map((n) => ({ ...n, pathId }));
    const normalized = normalizeSiblingOrders(withPath);
    validatePathTree(normalized);

    const now = new Date();
    return this.db.transaction(async (tx) => {
      await tx.delete(pathNodes).where(eq(pathNodes.pathId, pathId));

      if (normalized.length > 0) {
        // Insert parents before children: sort by ancestry depth
        const ordered = topologicalInsertOrder(normalized);
        for (const n of ordered) {
          await tx.insert(pathNodes).values({
            id: n.id,
            pathId,
            parentId: n.parentId,
            title: n.title,
            order: n.order,
            courseId: n.courseId,
            sectionId: n.sectionId,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      await tx.update(learningPaths).set({ updatedAt: now }).where(eq(learningPaths.id, pathId));

      return normalized;
    });
  }

  async enroll(input: {
    pathId: string;
    userId: string;
    orgId: string | null;
    enforceSequential: boolean;
  }): Promise<{ enrollment: PathEnrollment; progress: PathProgress }> {
    const path = await this.getById(input.pathId);
    if (!path) {
      throw new DomainError('not_found', 'Path not found');
    }
    if (path.orgId !== input.orgId) {
      throw new DomainError('validation', 'Org mismatch for path enrollment');
    }

    const existing = await this.db
      .select()
      .from(pathEnrollments)
      .where(
        and(eq(pathEnrollments.pathId, input.pathId), eq(pathEnrollments.userId, input.userId)),
      )
      .limit(1);
    const existingRow = existing[0];
    if (existingRow && !existingRow.revokedAt) {
      throw new DomainError('conflict', 'Already enrolled in path');
    }

    const nodes = await this.listNodes(input.pathId);
    const now = new Date();

    return this.db.transaction(async (tx) => {
      let enrollmentRow;
      if (existingRow) {
        [enrollmentRow] = await tx
          .update(pathEnrollments)
          .set({ revokedAt: null, enrolledAt: now, orgId: input.orgId })
          .where(eq(pathEnrollments.id, existingRow.id))
          .returning();
      } else {
        [enrollmentRow] = await tx
          .insert(pathEnrollments)
          .values({
            pathId: input.pathId,
            userId: input.userId,
            orgId: input.orgId,
            enrolledAt: now,
          })
          .returning();
      }
      if (!enrollmentRow) {
        throw new DomainError('conflict', 'Failed to enroll in path');
      }

      const currentNodeId = nextPathNodeId(nodes, [], input.enforceSequential);
      const [progressRow] = await tx
        .insert(pathProgress)
        .values({
          enrollmentId: enrollmentRow.id,
          completedNodeIds: [],
          currentNodeId,
          percent: computePathPercent(nodes, []),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: pathProgress.enrollmentId,
          set: {
            completedNodeIds: [],
            currentNodeId,
            percent: computePathPercent(nodes, []),
            updatedAt: now,
          },
        })
        .returning();

      if (!progressRow) {
        throw new DomainError('conflict', 'Failed to create path progress');
      }

      return {
        enrollment: mapPathEnrollment(enrollmentRow),
        progress: mapPathProgress(progressRow),
      };
    });
  }

  async getEnrollment(enrollmentId: string): Promise<PathEnrollment | null> {
    const rows = await this.db
      .select()
      .from(pathEnrollments)
      .where(eq(pathEnrollments.id, enrollmentId))
      .limit(1);
    const row = rows[0];
    return row ? mapPathEnrollment(row) : null;
  }

  async getProgress(enrollmentId: string): Promise<PathProgress | null> {
    const rows = await this.db
      .select()
      .from(pathProgress)
      .where(eq(pathProgress.enrollmentId, enrollmentId))
      .limit(1);
    const row = rows[0];
    return row ? mapPathProgress(row) : null;
  }

  async updateProgress(
    enrollmentId: string,
    next: {
      completedNodeIds: string[];
      currentNodeId: string | null;
      percent: number;
    },
  ): Promise<PathProgress> {
    const now = new Date();
    const [row] = await this.db
      .update(pathProgress)
      .set({
        completedNodeIds: next.completedNodeIds,
        currentNodeId: next.currentNodeId,
        percent: next.percent,
        updatedAt: now,
      })
      .where(eq(pathProgress.enrollmentId, enrollmentId))
      .returning();
    if (!row) {
      throw new DomainError('not_found', 'Path progress not found');
    }
    return mapPathProgress(row);
  }
}

/** Order nodes so every parent appears before its children. */
function topologicalInsertOrder(nodes: PathNode[]): PathNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const remaining = new Set(nodes.map((n) => n.id));
  const out: PathNode[] = [];

  while (remaining.size > 0) {
    let progressed = false;
    for (const id of [...remaining]) {
      const n = byId.get(id)!;
      if (n.parentId === null || !remaining.has(n.parentId)) {
        out.push(n);
        remaining.delete(id);
        progressed = true;
      }
    }
    if (!progressed) {
      throw new DomainError('validation', 'Cannot order path nodes for insert (cycle?)');
    }
  }
  return out;
}
