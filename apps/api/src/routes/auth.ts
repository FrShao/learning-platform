import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { validation } from '../errors.js';
import { serializeUser } from '../serialize.js';

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(200),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshBody = z.object({
  refreshToken: z.string().min(1),
});

function clientMeta(request: { headers: Record<string, unknown>; ip: string }): {
  userAgent: string | null;
  ip: string | null;
} {
  const ua = request.headers['user-agent'];
  return {
    userAgent: typeof ua === 'string' ? ua : null,
    ip: request.ip || null,
  };
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/auth/register', async (request, reply) => {
    const parsed = registerBody.safeParse(request.body);
    if (!parsed.success) {
      throw validation('Invalid register payload', { issues: parsed.error.issues });
    }
    const meta = clientMeta(request);
    const result = await app.authService.register({
      ...parsed.data,
      ...meta,
    });
    return reply.status(201).send({
      user: serializeUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      tokenType: 'Bearer',
    });
  });

  app.post('/v1/auth/login', async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) {
      throw validation('Invalid login payload', { issues: parsed.error.issues });
    }
    const meta = clientMeta(request);
    const result = await app.authService.login({
      ...parsed.data,
      ...meta,
    });
    return reply.status(200).send({
      user: serializeUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      tokenType: 'Bearer',
    });
  });

  app.post('/v1/auth/refresh', async (request, reply) => {
    const parsed = refreshBody.safeParse(request.body);
    if (!parsed.success) {
      throw validation('Invalid refresh payload', { issues: parsed.error.issues });
    }
    const meta = clientMeta(request);
    const result = await app.authService.refresh({
      refreshToken: parsed.data.refreshToken,
      ...meta,
    });
    return reply.status(200).send({
      user: serializeUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      tokenType: 'Bearer',
    });
  });
}
