import type { APIRoute } from 'astro';
import { activeRankings, rankingUrl } from '../lib/rankings';
import { allDevices, brands, brandSlug, comparePairs, compareSlug, deviceUrl } from '../lib/devices';

export const GET: APIRoute = async ({ site }) => {
  const devices = await allDevices();
  const latest = devices.reduce((m, d) => (d.checked > m ? d.checked : m), '');
  const entries: { path: string; lastmod?: string }[] = [
    { path: '/', lastmod: latest },
    { path: '/phones/', lastmod: latest },
    { path: '/tablets/', lastmod: latest },
    { path: '/compare/', lastmod: latest },
    { path: '/brands/', lastmod: latest },
    { path: '/best/', lastmod: latest },
    { path: '/finder/', lastmod: latest },
    { path: '/about/' },
    { path: '/privacy/' },
    ...devices.map((d) => ({ path: deviceUrl(d), lastmod: d.checked })),
    ...activeRankings(devices).map((b) => ({
      path: rankingUrl(b.ranking),
      lastmod: b.entries.reduce((m, e) => (e.device.checked > m ? e.device.checked : m), ''),
    })),
    ...brands(devices).map(([b]) => ({ path: `/brands/${brandSlug(b)}/` })),
    ...comparePairs(devices).map(([a, b]) => ({
      path: `/compare/${compareSlug(a, b)}/`,
      lastmod: a.checked > b.checked ? a.checked : b.checked,
    })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((e) => `  <url><loc>${new URL(e.path, site).href}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`)
  .join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
