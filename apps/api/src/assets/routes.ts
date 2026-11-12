import type { FastifyInstance } from 'fastify';

import { requireAuth, type CourseAuthContext } from '../courses/auth-hook.js';
import { forbidden } from '../errors.js';
import { sendDomainError, sendError } from '../lib/errors.js';

import type { AssetService } from './service.js';

function assertAssetsWrite(auth: CourseAuthContext): void {
  if (
    auth.scopes &&
    !auth.scopes.includes('assets:write') &&
    !auth.scopes.includes('courses:write')
  ) {
    throw forbidden('API key lacks assets:write');
  }
}

/**
 * Register /v1 asset upload + resolve routes.
 */
export async function registerAssetRoutes(
  app: FastifyInstance,
  service: AssetService,
): Promise<void> {
  app.post<{ Params: { orgId: string } }>('/v1/orgs/:orgId/assets', async (request, reply) => {
    try {
      const auth = requireAuth(request);
      assertAssetsWrite(auth);

      if (auth.orgId && auth.orgId !== request.params.orgId) {
        sendError(reply, 403, 'forbidden', 'Org mismatch');
        return;
      }

      if (!auth.scopes) {
        await service.assertCanUpload(auth.userId, request.params.orgId);
      }

      const file = await request.file();
      if (!file) {
        sendError(reply, 400, 'validation', 'Expected multipart file field');
        return;
      }

      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of file.file) {
        total += chunk.length;
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks, total);
      const mime = file.mimetype || 'application/octet-stream';
      const originalFilename = file.filename || null;

      const result = await service.upload({
        orgId: request.params.orgId,
        createdBy: auth.userId,
        mime,
        size: body.length,
        originalFilename,
        body,
      });

      return reply.status(201).send({
        id: result.asset.id,
        url: result.url,
        mime: result.asset.mime,
        size: result.asset.size,
        originalFilename: result.asset.originalFilename,
      });
    } catch (err) {
      if (handleForbidden(reply, err)) return;
      if (sendDomainError(reply, err)) return;
      throw err;
    }
  });

  app.get<{ Params: { assetId: string } }>('/v1/assets/:assetId', async (request, reply) => {
    try {
      const auth = requireAuth(request);
      const { asset, url } = await service.getMetadata(request.params.assetId);
      await service.assertCanRead(auth.scopes ? null : auth.userId, asset.orgId, auth.scopes);
      return {
        id: asset.id,
        url,
        mime: asset.mime,
        size: asset.size,
        originalFilename: asset.originalFilename,
        orgId: asset.orgId,
        createdAt: asset.createdAt.toISOString(),
      };
    } catch (err) {
      if (handleForbidden(reply, err)) return;
      if (sendDomainError(reply, err)) return;
      throw err;
    }
  });

  app.get<{ Params: { assetId: string } }>(
    '/v1/assets/:assetId/content',
    async (request, reply) => {
      try {
        const auth = requireAuth(request);
        const { asset, stream } = await service.openContent(request.params.assetId);
        await service.assertCanRead(auth.scopes ? null : auth.userId, asset.orgId, auth.scopes);
        return reply
          .header('Content-Type', asset.mime)
          .header('Content-Length', String(asset.size))
          .header(
            'Content-Disposition',
            `inline; filename="${(asset.originalFilename ?? asset.id).replace(/"/g, '')}"`,
          )
          .send(stream);
      } catch (err) {
        if (handleForbidden(reply, err)) return;
        if (sendDomainError(reply, err)) return;
        throw err;
      }
    },
  );
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
  if (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    (err as { statusCode?: number }).statusCode === 401
  ) {
    sendError(reply, 401, 'unauthorized', err instanceof Error ? err.message : 'Unauthorized');
    return true;
  }
  return false;
}
