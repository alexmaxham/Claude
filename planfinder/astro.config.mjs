// @ts-check
import { defineConfig } from 'astro/config';

// The site is published with the repo's GitHub Pages deploy at https://alexmaxham.github.io/Claude/plans/.
// To host it somewhere else (for example a custom domain), set SITE_URL and BASE_PATH when building:
//   SITE_URL=https://example.com BASE_PATH=/ npm run build
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://alexmaxham.github.io',
  base: process.env.BASE_PATH ?? '/Claude/plans/',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
