import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@lp/config': resolve(root, 'packages/config/src/index.ts'),
      '@lp/domain': resolve(root, 'packages/domain/src/index.ts'),
      '@lp/db': resolve(root, 'packages/db/src/index.ts'),
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '@lp/config': resolve(root, 'packages/config/src/index.ts'),
            '@lp/domain': resolve(root, 'packages/domain/src/index.ts'),
            '@lp/db': resolve(root, 'packages/db/src/index.ts'),
          },
        },
        test: {
          name: 'unit',
          include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
          exclude: ['**/node_modules/**', 'tests/**'],
        },
      },
      {
        resolve: {
          alias: {
            '@lp/config': resolve(root, 'packages/config/src/index.ts'),
            '@lp/domain': resolve(root, 'packages/domain/src/index.ts'),
            '@lp/db': resolve(root, 'packages/db/src/index.ts'),
          },
        },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          exclude: ['**/node_modules/**'],
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'regression',
          include: ['tests/regression/**/*.test.ts'],
          exclude: ['**/node_modules/**'],
        },
      },
    ],
  },
});
