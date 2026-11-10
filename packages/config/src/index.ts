export type NodeEnv = 'development' | 'production' | 'test';

export interface AppEnv {
  nodeEnv: NodeEnv;
  logLevel: string;
  databaseUrl: string | undefined;
  jwtSecret: string | undefined;
  port: number;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
}

function asNodeEnv(value: string | undefined): NodeEnv {
  if (value === 'production' || value === 'test') {
    return value;
  }
  return 'development';
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Parse shared process env into a typed object. Does not throw on missing secrets
 * so stub apps can boot; call `requireRuntimeSecrets` before serving authenticated routes.
 */
export function loadEnv(env: Record<string, string | undefined> = process.env): AppEnv {
  const portRaw = env['PORT'] ?? env['API_PORT'] ?? '3000';
  const port = Number.parseInt(portRaw, 10);

  return {
    nodeEnv: asNodeEnv(env['NODE_ENV']),
    logLevel: env['LOG_LEVEL'] ?? 'info',
    databaseUrl: env['DATABASE_URL'],
    jwtSecret: env['JWT_SECRET'],
    port: Number.isFinite(port) ? port : 3000,
    accessTokenTtlSeconds: parsePositiveInt(env['ACCESS_TOKEN_TTL_SECONDS'], 15 * 60),
    refreshTokenTtlSeconds: parsePositiveInt(env['REFRESH_TOKEN_TTL_SECONDS'], 60 * 60 * 24 * 30),
  };
}

export interface RuntimeSecrets {
  databaseUrl: string;
  jwtSecret: string;
}

/**
 * Validate secrets required to run the API with auth + Postgres.
 */
export function requireRuntimeSecrets(env: AppEnv): RuntimeSecrets {
  if (!env.databaseUrl || env.databaseUrl.trim() === '') {
    throw new Error('DATABASE_URL is required');
  }
  if (!env.jwtSecret || env.jwtSecret.trim() === '') {
    throw new Error('JWT_SECRET is required');
  }
  if (env.nodeEnv === 'production' && env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  return {
    databaseUrl: env.databaseUrl,
    jwtSecret: env.jwtSecret,
  };
}
