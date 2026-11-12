import { canAuthorOwnedResource, type Path } from '@lp/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { assertCourseWrite, requireAuth, type CourseAuthContext } from '../courses/auth-hook.js';
import { forbidden, unauthorized } from '../errors.js';
import { sendDomainError, sendError } from '../lib/errors.js';
import {
  assertCanAuthorOwned,
  requireUserSession,
  resolveOrgRole,
} from '../ownership-acl.js';

import type { PathService } from './service.js';

async function requirePathAuthor(
  app: FastifyInstance,
  service: PathService,
  auth: CourseAuthContext,
  pathId: string,
): Promise<Path> {
  const path = await service.getPath(pathId);
  await assertCanAuthorOwned(app.dbClient.db, path.owner, auth);
  return path;
}

const nodeBodySchema = z.object({
  id: z.string().min(1).optional(),
  parentId: z.string().uuid().nullable(),
  title: z.string().max(200).nullable().optional(),
  order: z.number().int().nonnegative().optional(),
  courseId: z.string().uuid(),
  sectionId: z.string().min(1),
});

const treeNodeSchema = z.object({
  id: z.string().min(1).optional(),
  parentId: z.string().uuid().nullable(),
  title: z.string().max(200).nullable().optional(),
  order: z.number().int().nonnegative(),
  courseId: z.string().uuid(),
  sectionId: z.string().min(1),
});

function requireJwtUser(auth: CourseAuthContext): string {
  if (auth.actor.kind !== 'user') {
    throw unauthorized('Learner path routes require a user session');
  }
  return auth.userId;
}

function serializePath(path: Path) {
  return {
    id: path.id,
    owner: path.owner,
    orgId: path.orgId,
    ownerUserId: path.ownerUserId,
    slug: path.slug,
    title: path.title,
    description: path.description,
    createdBy: path.createdBy,
    createdAt: path.createdAt.toISOString(),
    updatedAt: path.updatedAt.toISOString(),
    deletedAt: path.deletedAt ? path.deletedAt.toISOString() : null,
  };
}

function serializeNode(node: {
  id: string;
  pathId: string;
  parentId: string | null;
  title: string | null;
  order: number;
  courseId: string;
  sectionId: string;
}) {
  return {
    id: node.id,
    pathId: node.pathId,
    parentId: node.parentId,
    title: node.title,
    order: node.order,
    courseId: node.courseId,
    sectionId: node.sectionId,
  };
}

function serializeEnrollment(enrollment: {
  id: string;
  pathId: string;
  userId: string;
  orgId: string | null;
  enrolledAt: Date;
  revokedAt: Date | null;
}) {
  return {
    id: enrollment.id,
    pathId: enrollment.pathId,
    userId: enrollment.userId,
    orgId: enrollment.orgId,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    revokedAt: enrollment.revokedAt ? enrollment.revokedAt.toISOString() : null,
  };
}

function serializeProgress(progress: {
  enrollmentId: string;
  completedNodeIds: string[];
  currentNodeId: string | null;
  percent: number;
  updatedAt: Date;
}) {
  return {
    enrollmentId: progress.enrollmentId,
    completedNodeIds: progress.completedNodeIds,
    currentNodeId: progress.currentNodeId,
    percent: progress.percent,
    updatedAt: progress.updatedAt.toISOString(),
  };
}

/**
 * Register /v1 path authoring + learner routes.
 */
export async function registerPathRoutes(
  app: FastifyInstance,
  service: PathService,
): Promise<void> {
  app.get('/v1/me/paths', async (request, reply) => {
    try {
      const auth = requireAuth(request);
      const userId = requireUserSession(auth);
      const paths = await service.listPersonalPaths(userId);
      return { paths: paths.map(serializePath) };
    } catch (err) {
      if (handleForbidden(reply, err)) return;
      if (sendDomainError(reply, err)) return;
      throw err;
    }
  });

  app.post<{ Body: unknown }>('/v1/me/paths', async (request, reply) => {
    try {
      const auth = requireAuth(request);
      const userId = requireUserSession(auth);
      const body = z
        .object({
          slug: z.string().min(1),
          title: z.string().min(1),
          description: z.string().optional(),
        })
        .parse(request.body);

      const createInput: {
        ownerUserId: string;
        slug: string;
        title: string;
        createdBy: string;
        description?: string;
      } = {
        ownerUserId: userId,
        slug: body.slug,
        title: body.title,
        createdBy: userId,
      };
      if (body.description !== undefined) {
        createInput.description = body.description;
      }

      const path = await service.createPath(createInput);
      return reply.status(201).send({ path: serializePath(path) });
    } catch (err) {
      if (handleZod(reply, err)) return;
      if (handleForbidden(reply, err)) return;
      if (sendDomainError(reply, err)) return;
      throw err;
    }
  });

  app.get<{ Params: { orgId: string } }>('/v1/orgs/:orgId/paths', async (request, reply) => {
    try {
      const auth = requireAuth(request);
      if (auth.orgId && auth.orgId !== request.params.orgId) {
        sendError(reply, 403, 'forbidden', 'Org mismatch');
        return;
      }
      if (auth.actor.kind === 'user') {
        const role = await resolveOrgRole(app.dbClient.db, request.params.orgId, auth.userId);
        if (!role) {
          sendError(reply, 403, 'forbidden', 'Not a member of this organization');
          return;
        }
      }
      const paths = await service.listPaths(request.params.orgId);
      return { paths: paths.map(serializePath) };
    } catch (err) {
      if (handleForbidden(reply, err)) return;
      if (sendDomainError(reply, err)) return;
      throw err;
    }
  });

  app.post<{ Params: { orgId: string }; Body: unknown }>(
    '/v1/orgs/:orgId/paths',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCourseWrite(auth);
        if (auth.orgId && auth.orgId !== request.params.orgId) {
          sendError(reply, 403, 'forbidden', 'Org mismatch');
          return;
        }
        if (auth.actor.kind === 'user') {
          const role = await resolveOrgRole(app.dbClient.db, request.params.orgId, auth.userId);
          if (
            !canAuthorOwnedResource(
              { kind: 'org', orgId: request.params.orgId },
              { userId: auth.userId, orgRole: role },
            )
          ) {
            throw forbidden('Author role required for this organization');
          }
        }
        const body = z
          .object({
            slug: z.string().min(1),
            title: z.string().min(1),
            description: z.string().optional(),
          })
          .parse(request.body);

        const createInput: {
          orgId: string;
          slug: string;
          title: string;
          createdBy: string;
          description?: string;
        } = {
          orgId: request.params.orgId,
          slug: body.slug,
          title: body.title,
          createdBy: auth.userId,
        };
        if (body.description !== undefined) {
          createInput.description = body.description;
        }

        const path = await service.createPath(createInput);
        return reply.status(201).send({ path: serializePath(path) });
      } catch (err) {
        if (handleZod(reply, err)) return;
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.get<{ Params: { pathId: string } }>('/v1/paths/:pathId', async (request, reply) => {
    try {
      requireAuth(request);
      const path = await service.getPath(request.params.pathId);
      return { path: serializePath(path) };
    } catch (err) {
      if (sendDomainError(reply, err)) return;
      throw err;
    }
  });

  app.patch<{ Params: { pathId: string }; Body: unknown }>(
    '/v1/paths/:pathId',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCourseWrite(auth);
        await requirePathAuthor(app, service, auth, request.params.pathId);
        const body = z
          .object({
            slug: z.string().min(1).optional(),
            title: z.string().min(1).optional(),
            description: z.string().optional(),
          })
          .parse(request.body);
        const patch: { slug?: string; title?: string; description?: string } = {};
        if (body.slug !== undefined) patch.slug = body.slug;
        if (body.title !== undefined) patch.title = body.title;
        if (body.description !== undefined) patch.description = body.description;
        const path = await service.updatePath(request.params.pathId, patch);
        return { path: serializePath(path) };
      } catch (err) {
        if (handleZod(reply, err)) return;
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.delete<{ Params: { pathId: string } }>('/v1/paths/:pathId', async (request, reply) => {
    try {
      const auth = requireAuth(request);
      assertCourseWrite(auth);
      await requirePathAuthor(app, service, auth, request.params.pathId);
      const path = await service.softDeletePath(request.params.pathId);
      return { path: serializePath(path) };
    } catch (err) {
      if (handleForbidden(reply, err)) return;
      if (sendDomainError(reply, err)) return;
      throw err;
    }
  });

  app.get<{ Params: { pathId: string } }>('/v1/paths/:pathId/tree', async (request, reply) => {
    try {
      requireAuth(request);
      const { path, nodes } = await service.getTree(request.params.pathId);
      return { path: serializePath(path), nodes: nodes.map(serializeNode) };
    } catch (err) {
      if (sendDomainError(reply, err)) return;
      throw err;
    }
  });

  app.put<{ Params: { pathId: string }; Body: unknown }>(
    '/v1/paths/:pathId/tree',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCourseWrite(auth);
        await requirePathAuthor(app, service, auth, request.params.pathId);
        const body = z.object({ nodes: z.array(treeNodeSchema) }).parse(request.body);
        const nodes = await service.putTree(
          request.params.pathId,
          body.nodes.map((n) => {
            const mapped: {
              id?: string;
              parentId: string | null;
              title?: string | null;
              order: number;
              courseId: string;
              sectionId: string;
            } = {
              parentId: n.parentId,
              order: n.order,
              courseId: n.courseId,
              sectionId: n.sectionId,
            };
            if (n.id !== undefined) mapped.id = n.id;
            if (n.title !== undefined) mapped.title = n.title;
            return mapped;
          }),
        );
        return { nodes: nodes.map(serializeNode) };
      } catch (err) {
        if (handleZod(reply, err)) return;
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.post<{ Params: { pathId: string }; Body: unknown }>(
    '/v1/paths/:pathId/nodes',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCourseWrite(auth);
        await requirePathAuthor(app, service, auth, request.params.pathId);
        const body = nodeBodySchema.parse(request.body);
        const addInput: {
          id?: string;
          parentId: string | null;
          title?: string | null;
          order?: number;
          courseId: string;
          sectionId: string;
        } = {
          parentId: body.parentId,
          courseId: body.courseId,
          sectionId: body.sectionId,
        };
        if (body.id !== undefined) addInput.id = body.id;
        if (body.title !== undefined) addInput.title = body.title;
        if (body.order !== undefined) addInput.order = body.order;
        const nodes = await service.addNode(request.params.pathId, addInput);
        return reply.status(201).send({ nodes: nodes.map(serializeNode) });
      } catch (err) {
        if (handleZod(reply, err)) return;
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  // Register before /nodes/:nodeId so "reorder" is not captured as a node id.
  app.post<{ Params: { pathId: string }; Body: unknown }>(
    '/v1/paths/:pathId/nodes/reorder',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCourseWrite(auth);
        await requirePathAuthor(app, service, auth, request.params.pathId);
        const body = z
          .object({
            parentId: z.string().uuid().nullable(),
            orderedIds: z.array(z.string().uuid()).min(1),
          })
          .parse(request.body);
        const nodes = await service.reorderNodes(
          request.params.pathId,
          body.parentId,
          body.orderedIds,
        );
        return { nodes: nodes.map(serializeNode) };
      } catch (err) {
        if (handleZod(reply, err)) return;
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.patch<{ Params: { pathId: string; nodeId: string }; Body: unknown }>(
    '/v1/paths/:pathId/nodes/:nodeId',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCourseWrite(auth);
        await requirePathAuthor(app, service, auth, request.params.pathId);
        const body = z
          .object({
            parentId: z.string().uuid().nullable(),
            order: z.number().int().nonnegative().optional(),
            title: z.string().max(200).nullable().optional(),
            courseId: z.string().uuid().optional(),
            sectionId: z.string().min(1).optional(),
          })
          .parse(request.body);
        const moveInput: {
          parentId: string | null;
          order?: number;
          title?: string | null;
          courseId?: string;
          sectionId?: string;
        } = { parentId: body.parentId };
        if (body.order !== undefined) moveInput.order = body.order;
        if (body.title !== undefined) moveInput.title = body.title;
        if (body.courseId !== undefined) moveInput.courseId = body.courseId;
        if (body.sectionId !== undefined) moveInput.sectionId = body.sectionId;
        const nodes = await service.moveNode(
          request.params.pathId,
          request.params.nodeId,
          moveInput,
        );
        return { nodes: nodes.map(serializeNode) };
      } catch (err) {
        if (handleZod(reply, err)) return;
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.delete<{ Params: { pathId: string; nodeId: string } }>(
    '/v1/paths/:pathId/nodes/:nodeId',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCourseWrite(auth);
        await requirePathAuthor(app, service, auth, request.params.pathId);
        const nodes = await service.deleteNode(request.params.pathId, request.params.nodeId);
        return { nodes: nodes.map(serializeNode) };
      } catch (err) {
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.post<{ Params: { pathId: string } }>('/v1/paths/:pathId/enroll', async (request, reply) => {
    try {
      const auth = requireAuth(request);
      const userId = requireJwtUser(auth);
      const result = await service.enroll(request.params.pathId, userId);
      return reply.status(201).send({
        enrollment: serializeEnrollment(result.enrollment),
        progress: serializeProgress(result.progress),
        nodes: result.nodes.map(serializeNode),
      });
    } catch (err) {
      if (sendDomainError(reply, err)) return;
      throw err;
    }
  });

  app.get<{ Params: { enrollmentId: string } }>(
    '/v1/path-enrollments/:enrollmentId/progress',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        const userId = requireJwtUser(auth);
        const result = await service.getProgress(request.params.enrollmentId, userId);
        return {
          path: serializePath(result.path),
          enrollment: serializeEnrollment(result.enrollment),
          progress: serializeProgress(result.progress),
          nodes: result.nodes.map(serializeNode),
          unlockedNodeIds: result.unlockedNodeIds,
        };
      } catch (err) {
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.post<{ Params: { enrollmentId: string; nodeId: string } }>(
    '/v1/path-enrollments/:enrollmentId/nodes/:nodeId/complete',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        const userId = requireJwtUser(auth);
        const result = await service.completeNode(
          request.params.enrollmentId,
          request.params.nodeId,
          userId,
        );
        return {
          progress: serializeProgress(result.progress),
          unlockedNodeIds: result.unlockedNodeIds,
        };
      } catch (err) {
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );
}

function handleZod(reply: import('fastify').FastifyReply, err: unknown): boolean {
  if (err instanceof z.ZodError) {
    sendError(reply, 400, 'validation', 'Request validation failed', err.flatten());
    return true;
  }
  return false;
}

function handleForbidden(reply: import('fastify').FastifyReply, err: unknown): boolean {
  if (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    (err as { statusCode?: number }).statusCode === 403
  ) {
    sendError(reply, 403, 'forbidden', err instanceof Error ? err.message : 'Forbidden');
    return true;
  }
  return false;
}
