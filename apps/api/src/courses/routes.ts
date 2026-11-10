import type { ContentBlock, TreePatch } from '@lp/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { sendDomainError, sendError } from '../lib/errors.js';

import { assertCoursePublish, assertCourseWrite, requireAuth } from './auth-hook.js';
import type { CourseService } from './service.js';

const contentBlockSchema: z.ZodType<ContentBlock> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      id: z.string().min(1),
      type: z.literal('text'),
      markdown: z.string(),
    }),
    z.object({
      id: z.string().min(1),
      type: z.literal('image'),
      assetId: z.string().min(1),
      alt: z.string().optional(),
      caption: z.string().optional(),
    }),
    z.object({
      id: z.string().min(1),
      type: z.literal('graph'),
      spec: z.union([
        z.object({
          kind: z.literal('chart'),
          chart: z.enum(['line', 'bar', 'pie', 'scatter']),
          data: z.unknown(),
          options: z.unknown().optional(),
        }),
        z.object({
          kind: z.literal('diagram'),
          format: z.literal('mermaid'),
          source: z.string().min(1),
        }),
      ]),
    }),
    z.object({
      id: z.string().min(1),
      type: z.literal('form'),
      form: z.object({
        title: z.string().optional(),
        questions: z.array(z.record(z.string(), z.unknown())).min(1),
        passRule: z
          .union([
            z.object({ mode: z.literal('all_correct') }),
            z.object({ mode: z.literal('min_score'), min: z.number().min(0).max(1) }),
          ])
          .optional(),
      }),
    }),
  ]),
) as z.ZodType<ContentBlock>;

const treeSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string().min(1),
      slug: z.string().min(1),
      title: z.string().min(1),
      order: z.number().int().nonnegative(),
      blocks: z.array(contentBlockSchema),
    }),
  ),
});

const treePatchOpSchema = z.union([
  z.object({
    op: z.literal('upsert_section'),
    section: z.object({
      id: z.string().min(1),
      slug: z.string().min(1),
      title: z.string().min(1),
      order: z.number().int().nonnegative(),
      blocks: z.array(contentBlockSchema).optional(),
    }),
  }),
  z.object({
    op: z.literal('delete_section'),
    sectionId: z.string().min(1),
  }),
  z.object({
    op: z.literal('reorder_sections'),
    sectionIds: z.array(z.string().min(1)),
  }),
  z.object({
    op: z.literal('upsert_block'),
    sectionId: z.string().min(1),
    block: contentBlockSchema,
  }),
  z.object({
    op: z.literal('delete_block'),
    sectionId: z.string().min(1),
    blockId: z.string().min(1),
  }),
  z.object({
    op: z.literal('reorder_blocks'),
    sectionId: z.string().min(1),
    blockIds: z.array(z.string().min(1)),
  }),
]);

/**
 * Register /v1 course versioning routes.
 */
export async function registerCourseRoutes(
  app: FastifyInstance,
  service: CourseService,
): Promise<void> {
  app.get<{ Params: { orgId: string } }>('/v1/orgs/:orgId/courses', async (request, reply) => {
    try {
      const auth = requireAuth(request);
      if (auth.orgId && auth.orgId !== request.params.orgId) {
        sendError(reply, 403, 'forbidden', 'Org mismatch');
        return;
      }
      const courses = await service.listCourses(request.params.orgId);
      return { courses };
    } catch (err) {
      if (sendDomainError(reply, err)) return;
      throw err;
    }
  });

  app.post<{ Params: { orgId: string }; Body: unknown }>(
    '/v1/orgs/:orgId/courses',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCourseWrite(auth);
        if (auth.orgId && auth.orgId !== request.params.orgId) {
          sendError(reply, 403, 'forbidden', 'Org mismatch');
          return;
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
        const result = await service.createCourse(createInput);
        return reply.status(201).send(result);
      } catch (err) {
        if (handleZod(reply, err)) return;
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.get<{ Params: { courseId: string } }>('/v1/courses/:courseId', async (request, reply) => {
    try {
      requireAuth(request);
      const course = await service.getCourse(request.params.courseId);
      return { course };
    } catch (err) {
      if (sendDomainError(reply, err)) return;
      throw err;
    }
  });

  app.patch<{ Params: { courseId: string }; Body: unknown }>(
    '/v1/courses/:courseId',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCourseWrite(auth);
        const body = z
          .object({
            title: z.string().min(1).optional(),
            description: z.string().optional(),
            slug: z.string().min(1).optional(),
          })
          .parse(request.body);
        const patch: { title?: string; description?: string; slug?: string } = {};
        if (body.title !== undefined) patch.title = body.title;
        if (body.description !== undefined) patch.description = body.description;
        if (body.slug !== undefined) patch.slug = body.slug;
        const course = await service.updateCourse(request.params.courseId, patch);
        return { course };
      } catch (err) {
        if (handleZod(reply, err)) return;
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.delete<{ Params: { courseId: string } }>('/v1/courses/:courseId', async (request, reply) => {
    try {
      const auth = requireAuth(request);
      assertCourseWrite(auth);
      const course = await service.softDeleteCourse(request.params.courseId);
      return { course };
    } catch (err) {
      if (handleForbidden(reply, err)) return;
      if (sendDomainError(reply, err)) return;
      throw err;
    }
  });

  app.get<{ Params: { courseId: string } }>(
    '/v1/courses/:courseId/branches',
    async (request, reply) => {
      try {
        requireAuth(request);
        const branches = await service.listBranches(request.params.courseId);
        return { branches };
      } catch (err) {
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.post<{ Params: { courseId: string }; Body: unknown }>(
    '/v1/courses/:courseId/branches',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCourseWrite(auth);
        const body = z
          .object({
            name: z.string().min(1),
            from_commit_id: z.string().uuid().nullable().optional(),
            fromCommitId: z.string().uuid().nullable().optional(),
          })
          .parse(request.body);
        const fromCommitId = body.from_commit_id ?? body.fromCommitId ?? null;
        const branch = await service.createBranch(request.params.courseId, body.name, fromCommitId);
        return reply.status(201).send({ branch });
      } catch (err) {
        if (handleZod(reply, err)) return;
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.get<{ Params: { courseId: string; name: string } }>(
    '/v1/courses/:courseId/branches/:name',
    async (request, reply) => {
      try {
        requireAuth(request);
        const branch = await service.getBranch(
          request.params.courseId,
          decodeURIComponent(request.params.name),
        );
        return { branch };
      } catch (err) {
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.delete<{ Params: { courseId: string; name: string } }>(
    '/v1/courses/:courseId/branches/:name',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCourseWrite(auth);
        await service.deleteBranch(
          request.params.courseId,
          decodeURIComponent(request.params.name),
        );
        return reply.status(204).send();
      } catch (err) {
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.get<{ Params: { courseId: string; name: string } }>(
    '/v1/courses/:courseId/branches/:name/tree',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        const workingTree = await service.getWorkingTree(
          request.params.courseId,
          decodeURIComponent(request.params.name),
          auth.userId,
        );
        return { workingTree };
      } catch (err) {
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.put<{ Params: { courseId: string; name: string }; Body: unknown }>(
    '/v1/courses/:courseId/branches/:name/tree',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCourseWrite(auth);
        const body = treeSchema.parse(request.body);
        const workingTree = await service.putWorkingTree(
          request.params.courseId,
          decodeURIComponent(request.params.name),
          body,
          auth.userId,
        );
        return { workingTree };
      } catch (err) {
        if (handleZod(reply, err)) return;
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.patch<{ Params: { courseId: string; name: string }; Body: unknown }>(
    '/v1/courses/:courseId/branches/:name/tree',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCourseWrite(auth);
        const body = z
          .object({
            ops: z.array(treePatchOpSchema).min(1),
          })
          .parse(request.body);
        const patch = body as TreePatch;
        const workingTree = await service.patchWorkingTree(
          request.params.courseId,
          decodeURIComponent(request.params.name),
          patch,
          auth.userId,
        );
        return { workingTree };
      } catch (err) {
        if (handleZod(reply, err)) return;
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.get<{ Params: { courseId: string; name: string } }>(
    '/v1/courses/:courseId/branches/:name/diff',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        const result = await service.diffWorkingTree(
          request.params.courseId,
          decodeURIComponent(request.params.name),
          auth.userId,
        );
        return result;
      } catch (err) {
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.post<{ Params: { courseId: string; name: string }; Body: unknown }>(
    '/v1/courses/:courseId/branches/:name/commit',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCourseWrite(auth);
        const body = z.object({ message: z.string().min(1).max(2000) }).parse(request.body);
        const result = await service.commit(
          request.params.courseId,
          decodeURIComponent(request.params.name),
          body.message,
          auth.userId,
        );
        return reply.status(201).send(result);
      } catch (err) {
        if (handleZod(reply, err)) return;
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.get<{ Params: { courseId: string }; Querystring: { branch?: string } }>(
    '/v1/courses/:courseId/commits',
    async (request, reply) => {
      try {
        requireAuth(request);
        const commits = await service.listCommits(request.params.courseId, request.query.branch);
        return { commits };
      } catch (err) {
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.get<{ Params: { courseId: string; commitId: string } }>(
    '/v1/courses/:courseId/commits/:commitId',
    async (request, reply) => {
      try {
        requireAuth(request);
        const commit = await service.getCommit(request.params.courseId, request.params.commitId);
        return { commit };
      } catch (err) {
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.get<{ Params: { courseId: string; commitId: string } }>(
    '/v1/courses/:courseId/commits/:commitId/tree',
    async (request, reply) => {
      try {
        requireAuth(request);
        const snapshot = await service.getCommitTree(
          request.params.courseId,
          request.params.commitId,
        );
        return { snapshot };
      } catch (err) {
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );

  app.post<{ Params: { courseId: string }; Body: unknown }>(
    '/v1/courses/:courseId/publish',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        assertCoursePublish(auth);
        assertCourseWrite(auth);
        const body = z
          .object({
            commit_id: z.string().uuid().optional(),
            commitId: z.string().uuid().optional(),
          })
          .parse(request.body);
        const commitId = body.commit_id ?? body.commitId;
        if (!commitId) {
          sendError(reply, 400, 'validation', 'commit_id is required');
          return;
        }
        const course = await service.publish(request.params.courseId, commitId);
        return { course };
      } catch (err) {
        if (handleZod(reply, err)) return;
        if (handleForbidden(reply, err)) return;
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
