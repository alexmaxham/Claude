// Site-wide settings. Change SITE_NAME here to rename the site.
export const SITE_NAME = 'SwitchWise';
export const SITE_TAGLINE = 'Compare phone plans and save';
/** Brand colors, also used by the logo and the generated icons (scripts/brand-assets.mjs). */
export const BRAND = { ink: '#13261E', accent: '#C2410C', accentOnDark: '#F59E6B', mint: '#DCEFE2', ground: '#F2F5F1' };

/** Builds a link that works under the configured base path, e.g. href('plans/') → '/Claude/plans/'. */
export function href(path = ''): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return base + path.replace(/^\//, '');
}
