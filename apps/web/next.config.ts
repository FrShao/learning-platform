import type { NextConfig } from 'next';

/** Server-side upstream for same-origin `/v1` rewrites (browser never needs the API host). */
const apiUpstream = (process.env['API_URL'] ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@lp/domain'],
  // Allow opening the dev UI via 127.0.0.1 while Next binds as localhost (and vice versa).
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async rewrites() {
    return [
      { source: '/v1/:path*', destination: `${apiUpstream}/v1/:path*` },
      { source: '/health', destination: `${apiUpstream}/health` },
    ];
  },
};

export default nextConfig;
