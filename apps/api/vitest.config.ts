import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
    pool: 'threads',
    poolOptions: {
      threads: { singleThread: true }, // single thread so the integration tests share one db
    },
    testTimeout: 20_000,
  },
});
