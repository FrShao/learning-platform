import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, integrationEnabled, uniqueEmail, uniqueSlug } from './helpers.js';

const describeIntegration = integrationEnabled() ? describe : describe.skip;

describeIntegration('auth + orgs happy path', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, logs in, reads /me, manages org members and API keys', async () => {
    const email = uniqueEmail('owner');
    const password = 'password-ok-12';

    const register = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email, password, name: 'Owner One' },
    });
    expect(register.statusCode).toBe(201);
    const registerBody = register.json() as {
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string };
    };
    expect(registerBody.user.email).toBe(email);
    expect(registerBody.accessToken).toBeTruthy();
    expect(registerBody.refreshToken).toBeTruthy();

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);
    const loginBody = login.json() as { accessToken: string };
    const token = loginBody.accessToken;

    const me = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    expect((me.json() as { user: { email: string } }).user.email).toBe(email);

    const slug = uniqueSlug('acme');
    const createOrg = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { authorization: `Bearer ${token}` },
      payload: { slug, name: 'Acme Learning' },
    });
    expect(createOrg.statusCode).toBe(201);
    const orgBody = createOrg.json() as { org: { id: string; slug: string } };
    expect(orgBody.org.slug).toBe(slug);
    const orgId = orgBody.org.id;

    const getOrg = await app.inject({
      method: 'GET',
      url: `/v1/orgs/${orgId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getOrg.statusCode).toBe(200);

    const memberEmail = uniqueEmail('member');
    const memberReg = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: memberEmail, password, name: 'Member Two' },
    });
    expect(memberReg.statusCode).toBe(201);
    const memberId = (memberReg.json() as { user: { id: string } }).user.id;

    const addMember = await app.inject({
      method: 'POST',
      url: `/v1/orgs/${orgId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: { email: memberEmail, role: 'author' },
    });
    expect(addMember.statusCode).toBe(201);

    const listMembers = await app.inject({
      method: 'GET',
      url: `/v1/orgs/${orgId}/members`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listMembers.statusCode).toBe(200);
    const members = (listMembers.json() as { members: Array<{ userId: string; role: string }> })
      .members;
    expect(members.some((m) => m.userId === memberId && m.role === 'author')).toBe(true);

    const patchRole = await app.inject({
      method: 'PATCH',
      url: `/v1/orgs/${orgId}/members/${memberId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'admin' },
    });
    expect(patchRole.statusCode).toBe(200);
    expect((patchRole.json() as { membership: { role: string } }).membership.role).toBe('admin');

    const createKey = await app.inject({
      method: 'POST',
      url: `/v1/orgs/${orgId}/api-keys`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'mcp-bot', scopes: ['courses:read', 'courses:write'] },
    });
    expect(createKey.statusCode).toBe(201);
    const keyBody = createKey.json() as {
      apiKey: { id: string; secret: string; prefix: string; keyHash?: string };
    };
    expect(keyBody.apiKey.secret.startsWith('lp_live_')).toBe(true);
    expect(keyBody.apiKey.keyHash).toBeUndefined();
    const secret = keyBody.apiKey.secret;
    const keyId = keyBody.apiKey.id;

    const listKeys = await app.inject({
      method: 'GET',
      url: `/v1/orgs/${orgId}/api-keys`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listKeys.statusCode).toBe(200);
    const listed = (listKeys.json() as { apiKeys: Array<{ id: string; secret?: string }> }).apiKeys;
    expect(listed.some((k) => k.id === keyId)).toBe(true);
    expect(listed.find((k) => k.id === keyId)?.secret).toBeUndefined();

    const viaApiKey = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-api-key': secret },
    });
    expect(viaApiKey.statusCode).toBe(200);

    const revoke = await app.inject({
      method: 'DELETE',
      url: `/v1/orgs/${orgId}/api-keys/${keyId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(revoke.statusCode).toBe(200);

    const removeMember = await app.inject({
      method: 'DELETE',
      url: `/v1/orgs/${orgId}/members/${memberId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(removeMember.statusCode).toBe(204);
  });
});
