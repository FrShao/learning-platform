import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireJwtUser } from '../auth/require-user.js';
import { validation } from '../errors.js';
import { serializeApiKey, serializeMembership, serializeOrg, serializeUser } from '../serialize.js';

const createOrgBody = z.object({
  slug: z.string().min(2).max(64),
  name: z.string().min(1).max(200),
});

const addMemberBody = z.object({
  email: z.string().email(),
  role: z.string().min(1),
});

const patchMemberBody = z.object({
  role: z.string().min(1),
});

const createApiKeyBody = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1),
});

export async function registerOrgRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/orgs', async (request, reply) => {
    const user = requireJwtUser(request);
    const parsed = createOrgBody.safeParse(request.body);
    if (!parsed.success) {
      throw validation('Invalid organization payload', { issues: parsed.error.issues });
    }
    const { org, membership } = await app.orgService.createOrg(user, parsed.data);
    return reply.status(201).send({
      org: serializeOrg(org),
      membership: serializeMembership(membership),
    });
  });

  app.get('/v1/orgs/:orgId', async (request) => {
    const user = requireJwtUser(request);
    const { orgId } = request.params as { orgId: string };
    const org = await app.orgService.getOrg(user, orgId);
    return { org: serializeOrg(org) };
  });

  app.get('/v1/orgs/:orgId/members', async (request) => {
    const user = requireJwtUser(request);
    const { orgId } = request.params as { orgId: string };
    const members = await app.orgService.listMembers(user, orgId);
    return {
      members: members.map((m) => ({
        ...serializeMembership(m.membership),
        user: serializeUser(m.user),
      })),
    };
  });

  app.post('/v1/orgs/:orgId/members', async (request, reply) => {
    const user = requireJwtUser(request);
    const { orgId } = request.params as { orgId: string };
    const parsed = addMemberBody.safeParse(request.body);
    if (!parsed.success) {
      throw validation('Invalid member payload', { issues: parsed.error.issues });
    }
    const result = await app.orgService.addMember(user, orgId, parsed.data);
    return reply.status(201).send({
      membership: serializeMembership(result.membership),
      user: serializeUser(result.user),
    });
  });

  app.patch('/v1/orgs/:orgId/members/:userId', async (request) => {
    const user = requireJwtUser(request);
    const { orgId, userId } = request.params as { orgId: string; userId: string };
    const parsed = patchMemberBody.safeParse(request.body);
    if (!parsed.success) {
      throw validation('Invalid role payload', { issues: parsed.error.issues });
    }
    const membership = await app.orgService.patchMemberRole(user, orgId, userId, parsed.data.role);
    return { membership: serializeMembership(membership) };
  });

  app.delete('/v1/orgs/:orgId/members/:userId', async (request, reply) => {
    const user = requireJwtUser(request);
    const { orgId, userId } = request.params as { orgId: string; userId: string };
    await app.orgService.removeMember(user, orgId, userId);
    return reply.status(204).send();
  });

  app.post('/v1/orgs/:orgId/api-keys', async (request, reply) => {
    const user = requireJwtUser(request);
    const { orgId } = request.params as { orgId: string };
    const parsed = createApiKeyBody.safeParse(request.body);
    if (!parsed.success) {
      throw validation('Invalid API key payload', { issues: parsed.error.issues });
    }
    const { key, secret } = await app.orgService.createApiKey(user, orgId, parsed.data);
    return reply.status(201).send({ apiKey: serializeApiKey(key, secret) });
  });

  app.get('/v1/orgs/:orgId/api-keys', async (request) => {
    const user = requireJwtUser(request);
    const { orgId } = request.params as { orgId: string };
    const keys = await app.orgService.listApiKeys(user, orgId);
    return { apiKeys: keys.map((k) => serializeApiKey(k)) };
  });

  app.delete('/v1/orgs/:orgId/api-keys/:keyId', async (request) => {
    const user = requireJwtUser(request);
    const { orgId, keyId } = request.params as { orgId: string; keyId: string };
    const key = await app.orgService.revokeApiKey(user, orgId, keyId);
    return { apiKey: serializeApiKey(key) };
  });
}
