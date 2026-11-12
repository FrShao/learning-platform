import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import type { AppEnv } from '@lp/config';
import {
  createDbClient,
  findApiKeyByHash,
  findOrganizationById,
  findUserById,
  pingDb,
  touchApiKeyLastUsed,
  type Db,
  type DbClient,
} from '@lp/db';
import { hashApiKey } from '@lp/domain';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';

import { AssetService, LocalBlobStorage, registerAssetRoutes } from './assets/index.js';
import type { AuthContext } from './auth/context.js';
import { verifyAccessToken } from './auth/tokens.js';
import { registerCourseRoutes } from './courses/routes.js';
import { CourseService } from './courses/service.js';
import { ApiError, unauthorized } from './errors.js';
import { registerLearnerRoutes } from './learner/register.js';
import { registerPathRoutes } from './paths/routes.js';
import { PathService } from './paths/service.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerMeRoutes } from './routes/me.js';
import { registerOrgRoutes } from './routes/orgs.js';
import { AuthService } from './services/auth-service.js';
import { OrgService } from './services/org-service.js';

export { requireJwtUser } from './auth/require-user.js';

declare module 'fastify' {
  interface FastifyInstance {
    dbClient: DbClient;
    authService: AuthService;
    orgService: OrgService;
    courseService: CourseService;
    pathService: PathService;
    assetService: AssetService;
    jwtSecret: string;
  }
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

export interface BuildAppOptions {
  env: AppEnv;
  databaseUrl: string;
  jwtSecret: string;
  /** Inject a Db for tests; skips creating a new client when provided with closeDbOnClose=false. */
  db?: Db;
  /** When false, caller owns closing the DB client. Default true for production boot. */
  closeDbOnClose?: boolean;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const injectedDb = Boolean(options.db);
  const client: DbClient = options.db
    ? {
        db: options.db,
        sql: (() => {
          throw new Error('sql not available for injected Db');
        }) as unknown as DbClient['sql'],
        close: async () => undefined,
      }
    : createDbClient(options.databaseUrl);
  const app = Fastify({
    logger: options.env.nodeEnv !== 'test',
  });

  // Browser UI (separate origin / port) needs preflight + ACAO on /v1/*.
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'Accept'],
  });
  await app.register(multipart, {
    limits: {
      fileSize: options.env.maxAssetBytes,
      files: 1,
    },
  });

  const publicApiBaseUrl =
    options.env.publicApiBaseUrl?.replace(/\/$/, '') || `http://127.0.0.1:${options.env.port}/v1`;
  const assetService = new AssetService({
    db: client.db,
    storage: new LocalBlobStorage(options.env.assetStorageDir),
    maxAssetBytes: options.env.maxAssetBytes,
    publicApiBaseUrl,
  });

  app.decorate('dbClient', client);
  app.decorate('jwtSecret', options.jwtSecret);
  app.decorate('authService', new AuthService(client, options.env, options.jwtSecret));
  app.decorate('orgService', new OrgService(client));
  app.decorate('courseService', new CourseService(client.db));
  app.decorate('pathService', new PathService(client.db));
  app.decorate('assetService', assetService);
  app.decorateRequest('auth', null);

  app.addHook('onRequest', async (request) => {
    request.auth = null;
    const apiKeyHeader = request.headers['x-api-key'];
    if (typeof apiKeyHeader === 'string' && apiKeyHeader.length > 0) {
      const keyHash = hashApiKey(apiKeyHeader);
      const apiKey = await findApiKeyByHash(client.db, keyHash);
      if (!apiKey) {
        throw unauthorized('Invalid API key');
      }
      const org = await findOrganizationById(client.db, apiKey.orgId);
      if (!org) {
        throw unauthorized('Invalid API key');
      }
      request.auth = {
        kind: 'api_key',
        apiKey,
        org,
        scopes: apiKey.scopes,
      };
      void touchApiKeyLastUsed(client.db, apiKey.id);
      return;
    }

    const header = request.headers.authorization;
    if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
      const token = header.slice('bearer '.length).trim();
      try {
        const claims = await verifyAccessToken(token, options.jwtSecret);
        const user = await findUserById(client.db, claims.sub);
        if (!user) {
          throw unauthorized('Invalid access token');
        }
        request.auth = { kind: 'jwt', user };
      } catch (err) {
        if (err instanceof ApiError) {
          throw err;
        }
        throw unauthorized('Invalid access token');
      }
    }
  });

  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof ApiError) {
      const body: { error: { code: string; message: string; details?: Record<string, unknown> } } =
        {
          error: {
            code: err.code,
            message: err.message,
          },
        };
      if (err.details) {
        body.error.details = err.details;
      }
      return reply.status(err.statusCode).send(body);
    }

    const statusCode =
      typeof err === 'object' &&
      err !== null &&
      'statusCode' in err &&
      typeof (err as { statusCode: unknown }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : 500;

    if (statusCode >= 400 && statusCode < 500) {
      const message = err instanceof Error ? err.message : 'Bad request';
      return reply.status(statusCode).send({
        error: { code: 'validation', message },
      });
    }

    requestLogError(app, err);
    return reply.status(500).send({
      error: { code: 'internal', message: 'Internal server error' },
    });
  });

  app.get('/health', async () => {
    if (injectedDb) {
      return {
        status: 'ok',
        service: 'api',
        db: { ok: true, message: 'injected db' },
      };
    }
    const db = await pingDb(client);
    return {
      status: db.ok ? 'ok' : 'degraded',
      service: 'api',
      db,
    };
  });

  app.get('/v1', async () => ({
    name: 'learning-platform-api',
    version: 'v1',
    status: 'ok',
  }));

  await registerAuthRoutes(app);
  await registerMeRoutes(app);
  await registerOrgRoutes(app);
  await registerCourseRoutes(app, app.courseService);
  await registerPathRoutes(app, app.pathService);
  await registerAssetRoutes(app, app.assetService);
  await registerLearnerRoutes(app, client);

  const closeDb = options.closeDbOnClose !== false && !options.db;
  if (closeDb) {
    app.addHook('onClose', async () => {
      await client.close();
    });
  }

  return app;
}

function requestLogError(app: FastifyInstance, err: unknown): void {
  if (app.log) {
    app.log.error(err);
  }
}

export async function sendJson(reply: FastifyReply, status: number, body: unknown): Promise<void> {
  await reply.status(status).send(body);
}
