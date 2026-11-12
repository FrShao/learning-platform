export type NodeEnv = 'development' | 'production' | 'test';

export interface S3Env {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  forcePathStyle: boolean;
  /** Public base URL for constructing object URLs when not using signed GETs. */
  publicBaseUrl: string | undefined;
}

export interface AppEnv {
  nodeEnv: NodeEnv;
  logLevel: string;
  databaseUrl: string | undefined;
  jwtSecret: string | undefined;
  port: number;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  /** Local filesystem root for asset blobs when S3 is not configured. */
  assetStorageDir: string;
  /** Max upload size in bytes. */
  maxAssetBytes: number;
  /** Present when S3_* env vars are set for MinIO/S3-compatible storage. */
  s3: S3Env | undefined;
  /** Absolute public API base used to build asset content URLs (optional). */
  publicApiBaseUrl: string | undefined;
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

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'no') return false;
  return fallback;
}

function loadS3(env: Record<string, string | undefined>): S3Env | undefined {
  const endpoint = env['S3_ENDPOINT']?.trim();
  const accessKey = env['S3_ACCESS_KEY']?.trim();
  const secretKey = env['S3_SECRET_KEY']?.trim();
  const bucket = env['S3_BUCKET']?.trim();
  if (!endpoint || !accessKey || !secretKey || !bucket) {
    return undefined;
  }
  return {
    endpoint,
    accessKey,
    secretKey,
    bucket,
    forcePathStyle: parseBool(env['S3_FORCE_PATH_STYLE'], true),
    publicBaseUrl: env['S3_PUBLIC_BASE_URL']?.trim() || undefined,
  };
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
    assetStorageDir: env['ASSET_STORAGE_DIR']?.trim() || '.data/assets',
    maxAssetBytes: parsePositiveInt(env['MAX_ASSET_BYTES'], 5 * 1024 * 1024),
    s3: loadS3(env),
    publicApiBaseUrl: env['PUBLIC_API_BASE_URL']?.trim() || undefined,
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
