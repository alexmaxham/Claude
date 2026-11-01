import type { APIRoute } from 'astro';
import { getData } from '../lib/data';
import { versusPairs } from '../lib/extras';
import { href } from '../lib/site';

export const GET: APIRoute = async ({ site }) => {
  const { plans, carriers } = await getData();
  const guides = ['savings/', 'discounts/', 'guides/', 'guides/how-much-data/', 'guides/coverage/', 'guides/switching/', 'guides/phone-deals/', 'guides/glossary/', 'vs/', 'changes/', 'privacy/'];
  const paths = [href(), href('plans/'), href('carriers/'), href('about/'), ...guides.map((g) => href(g)), ...plans.map((p) => p.url), ...carriers.map((c) => c.url), ...versusPairs.map(([a, b]) => href(`vs/${a}-vs-${b}/`))];
  const urls = paths.map((p) => `  <url><loc>${new URL(p, site).href}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
