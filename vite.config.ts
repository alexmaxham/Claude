/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works under any subpath, e.g. GitHub Pages' /Claude/.
  base: './',
  // The Firebase SDK chunk is large but only loaded when cloud sync is configured.
  build: { chunkSizeWarningLimit: 700 },
  // planfinder/ and specdeck/ are separate projects with their own tests and configs.
  test: { exclude: ['**/node_modules/**', '**/dist/**', 'planfinder/**', 'specdeck/**'] },
});
