export type NodeEnv = 'development' | 'production' | 'test';

export interface AppEnv {
  nodeEnv: NodeEnv;
  logLevel: string;
  databaseUrl: string | undefined;
  jwtSecret: string | undefined;
  port: number;
}

function asNodeEnv(value: string | undefined): NodeEnv {
  if (value === 'production' || value === 'test') {
    return value;
  }
  return 'development';
}

/**
 * Parse shared process env into a typed object. Does not throw on missing secrets
 * so stub apps can boot; production code should validate required fields at the edge.
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
  };
}
