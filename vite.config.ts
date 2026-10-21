import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works under any subpath, e.g. GitHub Pages' /Claude/.
  base: './',
  // The Firebase SDK chunk is large but only loaded when cloud sync is configured.
  build: { chunkSizeWarningLimit: 700 },
  // The dividend tracker has its own package and test run.
  test: { exclude: [...configDefaults.exclude, 'dividends/**', 'specdeck/**'] },
});
