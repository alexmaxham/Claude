import type { APIRoute } from 'astro';
import { getData } from '../lib/data';
import { href } from '../lib/site';

export const GET: APIRoute = async ({ site }) => {
  const { plans, carriers } = await getData();
  const paths = [href(), href('plans/'), href('carriers/'), href('about/'), ...plans.map((p) => p.url), ...carriers.map((c) => c.url)];
  const urls = paths.map((p) => `  <url><loc>${new URL(p, site).href}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
