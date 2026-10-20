// @ts-check
import { defineConfig } from 'astro/config';

// Set SITE_URL to the production domain when deploying; canonical URLs, the sitemap and
// structured data are all built from it.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://specdeck-db.web.app',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
