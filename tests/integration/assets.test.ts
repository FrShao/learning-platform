import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, uniqueEmail, uniqueSlug } from './helpers.js';

const databaseUrl = process.env['DATABASE_URL']?.trim();
const jwtSecret = process.env['JWT_SECRET']?.trim();
const hasDb = Boolean(databaseUrl && jwtSecret);

describe.skipIf(!hasDb)('asset upload API', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let token: string;
  let orgId: string;

  beforeAll(async () => {
    process.env['ASSET_STORAGE_DIR'] = `.data/test-assets-${Date.now()}`;
    app = await createTestApp();

    const email = uniqueEmail('asset-author');
    const password = 'password-ok-12';
    const register = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email, password, name: 'Asset Author' },
    });
    expect(register.statusCode).toBe(201);
    token = (register.json() as { accessToken: string }).accessToken;

    const createOrg = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { authorization: `Bearer ${token}` },
      payload: { slug: uniqueSlug('asset-org'), name: 'Asset Org' },
    });
    expect(createOrg.statusCode).toBe(201);
    orgId = (createOrg.json() as { org: { id: string } }).org.id;
  }, 60_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('uploads an image and resolves metadata + content', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    const boundary = '----lpboundary';
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="dot.png"\r\n` +
          `Content-Type: image/png\r\n\r\n`,
      ),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const upload = await app.inject({
      method: 'POST',
      url: `/v1/orgs/${orgId}/assets`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });
    expect(upload.statusCode).toBe(201);
    const uploaded = upload.json() as { id: string; url: string; mime: string; size: number };
    expect(uploaded.id).toBeTruthy();
    expect(uploaded.mime).toBe('image/png');
    expect(uploaded.size).toBe(png.length);
    expect(uploaded.url).toContain(`/assets/${uploaded.id}/content`);

    const meta = await app.inject({
      method: 'GET',
      url: `/v1/assets/${uploaded.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meta.statusCode).toBe(200);
    expect((meta.json() as { id: string }).id).toBe(uploaded.id);

    const content = await app.inject({
      method: 'GET',
      url: `/v1/assets/${uploaded.id}/content`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(content.statusCode).toBe(200);
    expect(content.headers['content-type']).toMatch(/image\/png/);
    expect(Buffer.from(content.rawPayload)).toEqual(png);
  });

  it('rejects unsupported mime types', async () => {
    const boundary = '----lpboundary2';
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="notes.txt"\r\n` +
          `Content-Type: text/plain\r\n\r\n`,
      ),
      Buffer.from('hello'),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const upload = await app.inject({
      method: 'POST',
      url: `/v1/orgs/${orgId}/assets`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });
    expect(upload.statusCode).toBe(400);
    expect((upload.json() as { error: { code: string } }).error.code).toBe('validation');
  });
});
