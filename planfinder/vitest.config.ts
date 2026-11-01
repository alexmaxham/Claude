import { defineConfig } from 'vitest/config';

// Own config so vitest doesn't pick up the repo root's vite.config.ts.
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
