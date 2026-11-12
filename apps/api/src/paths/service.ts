import { randomUUID } from 'node:crypto';

import { PathRepository, findOrganizationById, getMembership, type Db } from '@lp/db';
import {
  DomainError,
  DEFAULT_ORG_SETTINGS,
  canCompletePathNode,
  computePathPercent,
  deletePathNode,
  insertPathNode,
  isValidCourseSlug,
  movePathNode,
  nextPathNodeId,
  normalizeCourseSlug,
  pathNodeUnlockStates,
  reorderPathSiblings,
  replacePathTree,
  type Path,
  type PathEnrollment,
  type PathNode,
  type PathProgress,
} from '@lp/domain';

export class PathService {
  private readonly repo: PathRepository;

  constructor(private readonly db: Db) {
    this.repo = new PathRepository(db);
  }

  listPaths(orgId: string): Promise<Path[]> {
    return this.repo.listByOrg(orgId);
  }

  async getPath(pathId: string): Promise<Path> {
    const path = await this.repo.getById(pathId);
    if (!path) {
      throw new DomainError('not_found', 'Path not found');
    }
    return path;
  }

  async createPath(input: {
    orgId: string;
    slug: string;
    title: string;
    description?: string;
    createdBy: string;
  }): Promise<Path> {
    const slug = normalizeCourseSlug(input.slug);
    if (!isValidCourseSlug(slug)) {
      throw new DomainError('validation', 'Invalid path slug');
    }
    if (!input.title || input.title.trim().length < 1 || input.title.length > 200) {
      throw new DomainError('validation', 'Title must be 1–200 characters');
    }

    try {
      return await this.repo.createPath({
        orgId: input.orgId,
        slug,
        title: input.title.trim(),
        description: input.description ?? '',
        createdBy: input.createdBy,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new DomainError('conflict', `Path slug already exists: ${slug}`);
      }
      throw err;
    }
  }

  async updatePath(
    pathId: string,
    patch: { title?: string; description?: string; slug?: string },
  ): Promise<Path> {
    const normalized: { title?: string; description?: string; slug?: string } = {};
    if (patch.title !== undefined) {
      if (patch.title.trim().length < 1 || patch.title.length > 200) {
        throw new DomainError('validation', 'Title must be 1–200 characters');
      }
      normalized.title = patch.title.trim();
    }
    if (patch.description !== undefined) {
      normalized.description = patch.description;
    }
    if (patch.slug !== undefined) {
      const slug = normalizeCourseSlug(patch.slug);
      if (!isValidCourseSlug(slug)) {
        throw new DomainError('validation', 'Invalid path slug');
      }
      normalized.slug = slug;
    }
    try {
      return await this.repo.updatePath(pathId, normalized);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new DomainError('conflict', 'Path slug already exists');
      }
      throw err;
    }
  }

  softDeletePath(pathId: string): Promise<Path> {
    return this.repo.softDeletePath(pathId);
  }

  async getTree(pathId: string): Promise<{ path: Path; nodes: PathNode[] }> {
    const path = await this.getPath(pathId);
    const nodes = await this.repo.listNodes(pathId);
    return { path, nodes };
  }

  async putTree(
    pathId: string,
    nodesInput: Array<{
      id?: string | undefined;
      parentId: string | null;
      title?: string | null | undefined;
      order: number;
      courseId: string;
      sectionId: string;
    }>,
  ): Promise<PathNode[]> {
    await this.getPath(pathId);
    const nodes = replacePathTree(
      pathId,
      nodesInput.map((n) => ({
        id: n.id && n.id.length > 0 ? n.id : randomUUID(),
        parentId: n.parentId,
        title: n.title === undefined ? null : n.title,
        order: n.order,
        courseId: n.courseId,
        sectionId: n.sectionId,
      })),
    );
    return this.repo.replaceTree(pathId, nodes);
  }

  async addNode(
    pathId: string,
    input: {
      id?: string | undefined;
      parentId: string | null;
      title?: string | null | undefined;
      order?: number | undefined;
      courseId: string;
      sectionId: string;
    },
  ): Promise<PathNode[]> {
    await this.getPath(pathId);
    const current = await this.repo.listNodes(pathId);
    const nodeInput: Parameters<typeof insertPathNode>[1] = {
      id: input.id && input.id.length > 0 ? input.id : randomUUID(),
      parentId: input.parentId,
      courseId: input.courseId,
      sectionId: input.sectionId,
      pathId,
    };
    if (input.title !== undefined) {
      nodeInput.title = input.title;
    }
    if (input.order !== undefined) {
      nodeInput.order = input.order;
    }
    const next = insertPathNode(current, nodeInput, pathId);
    return this.repo.replaceTree(pathId, next);
  }

  async moveNode(
    pathId: string,
    nodeId: string,
    input: {
      parentId: string | null;
      order?: number | undefined;
      title?: string | null | undefined;
      courseId?: string | undefined;
      sectionId?: string | undefined;
    },
  ): Promise<PathNode[]> {
    await this.getPath(pathId);
    let nodes = await this.repo.listNodes(pathId);
    nodes = movePathNode(nodes, nodeId, input.parentId, input.order);

    if (
      input.title !== undefined ||
      input.courseId !== undefined ||
      input.sectionId !== undefined
    ) {
      nodes = nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          title: input.title !== undefined ? input.title : n.title,
          courseId: input.courseId ?? n.courseId,
          sectionId: input.sectionId ?? n.sectionId,
        };
      });
    }

    return this.repo.replaceTree(pathId, nodes);
  }

  async deleteNode(pathId: string, nodeId: string): Promise<PathNode[]> {
    await this.getPath(pathId);
    const current = await this.repo.listNodes(pathId);
    const next = deletePathNode(current, nodeId);
    return this.repo.replaceTree(pathId, next);
  }

  async reorderNodes(
    pathId: string,
    parentId: string | null,
    orderedIds: string[],
  ): Promise<PathNode[]> {
    await this.getPath(pathId);
    const current = await this.repo.listNodes(pathId);
    const next = reorderPathSiblings(current, parentId, orderedIds);
    return this.repo.replaceTree(pathId, next);
  }

  async enroll(
    pathId: string,
    userId: string,
  ): Promise<{ enrollment: PathEnrollment; progress: PathProgress; nodes: PathNode[] }> {
    const path = await this.getPath(pathId);
    const membership = await getMembership(this.db, path.orgId, userId);
    if (!membership) {
      throw new DomainError('not_found', 'Not a member of this organization');
    }

    const org = await findOrganizationById(this.db, path.orgId);
    const enforceSequential =
      org?.settings.enforceSequentialProgress ?? DEFAULT_ORG_SETTINGS.enforceSequentialProgress;

    const result = await this.repo.enroll({
      pathId,
      userId,
      orgId: path.orgId,
      enforceSequential,
    });
    const nodes = await this.repo.listNodes(pathId);
    return { ...result, nodes };
  }

  async getProgress(
    enrollmentId: string,
    userId: string,
  ): Promise<{
    enrollment: PathEnrollment;
    progress: PathProgress;
    nodes: PathNode[];
    unlockedNodeIds: string[];
    path: Path;
  }> {
    const enrollment = await this.repo.getEnrollment(enrollmentId);
    if (!enrollment || enrollment.revokedAt) {
      throw new DomainError('not_found', 'Path enrollment not found');
    }
    if (enrollment.userId !== userId) {
      throw new DomainError('not_found', 'Path enrollment not found');
    }

    const progress = await this.repo.getProgress(enrollmentId);
    if (!progress) {
      throw new DomainError('not_found', 'Path progress not found');
    }

    const path = await this.getPath(enrollment.pathId);
    const nodes = await this.repo.listNodes(path.id);
    const org = await findOrganizationById(this.db, path.orgId);
    const enforceSequential =
      org?.settings.enforceSequentialProgress ?? DEFAULT_ORG_SETTINGS.enforceSequentialProgress;

    const states = pathNodeUnlockStates(nodes, progress.completedNodeIds, enforceSequential);
    return {
      enrollment,
      progress,
      nodes,
      unlockedNodeIds: states.filter((s) => s.unlocked).map((s) => s.nodeId),
      path,
    };
  }

  async completeNode(
    enrollmentId: string,
    nodeId: string,
    userId: string,
  ): Promise<{
    progress: PathProgress;
    unlockedNodeIds: string[];
  }> {
    const enrollment = await this.repo.getEnrollment(enrollmentId);
    if (!enrollment || enrollment.revokedAt) {
      throw new DomainError('not_found', 'Path enrollment not found');
    }
    if (enrollment.userId !== userId) {
      throw new DomainError('not_found', 'Path enrollment not found');
    }

    const progress = await this.repo.getProgress(enrollmentId);
    if (!progress) {
      throw new DomainError('not_found', 'Path progress not found');
    }

    const nodes = await this.repo.listNodes(enrollment.pathId);
    const org = await findOrganizationById(this.db, enrollment.orgId);
    const enforceSequential =
      org?.settings.enforceSequentialProgress ?? DEFAULT_ORG_SETTINGS.enforceSequentialProgress;

    if (!nodes.some((n) => n.id === nodeId)) {
      throw new DomainError('not_found', 'Path node not found');
    }

    if (!canCompletePathNode(nodes, progress.completedNodeIds, nodeId, enforceSequential)) {
      if (progress.completedNodeIds.includes(nodeId)) {
        throw new DomainError('conflict', 'Node already completed');
      }
      throw new DomainError('conflict', 'Node is locked');
    }

    const completedNodeIds = [...progress.completedNodeIds, nodeId];
    const currentNodeId = nextPathNodeId(nodes, completedNodeIds, enforceSequential);
    const percent = computePathPercent(nodes, completedNodeIds);
    const updated = await this.repo.updateProgress(enrollmentId, {
      completedNodeIds,
      currentNodeId,
      percent,
    });

    const states = pathNodeUnlockStates(nodes, completedNodeIds, enforceSequential);
    return {
      progress: updated,
      unlockedNodeIds: states.filter((s) => s.unlocked).map((s) => s.nodeId),
    };
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}
