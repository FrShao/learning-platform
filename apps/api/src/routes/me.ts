import type { FastifyInstance } from 'fastify';

import { requireJwtUser } from '../auth/require-user.js';
import { serializeUser } from '../serialize.js';

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/me', async (request) => {
    const user = requireJwtUser(request);
    const me = await app.authService.getMe(user);
    return {
      user: {
        ...serializeUser(user),
      },
      memberships: me.memberships.map((m) => ({
        orgId: m.orgId,
        role: m.role,
        org: m.org,
      })),
    };
  });
}
