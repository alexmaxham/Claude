import type { APIRoute } from 'astro';
import { changes } from '../lib/extras';
import { href, SITE_NAME } from '../lib/site';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = ({ site }) => {
  const page = new URL(href('changes/'), site).href;
  const items = changes
    .map((c, i) => `    <item>
      <title>${esc(c.title)}</title>
      <description>${esc(c.details)}</description>
      <link>${page}</link>
      <guid isPermaLink="false">${c.date}-${i}-${esc(c.title)}</guid>
      <pubDate>${new Date(c.date + 'T12:00:00Z').toUTCString()}</pubDate>
    </item>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(SITE_NAME)} price changes</title>
    <link>${page}</link>
    <description>Changes to phone plan prices and details tracked by ${esc(SITE_NAME)}.</description>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
