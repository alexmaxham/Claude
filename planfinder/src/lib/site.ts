// Site-wide settings. Change SITE_NAME here to rename the site.
export const SITE_NAME = 'bars.';
export const SITE_TAGLINE = 'Compare phone plans from every carrier';

/** Builds a link that works under the configured base path, e.g. href('plans/') → '/Claude/plans/plans/'. */
export function href(path = ''): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return base + path.replace(/^\//, '');
}
