// Fetches Slickdeals' Tech & Electronics RSS feed and writes it as JSON for the deals page
// (public/deals/). Runs in the deploy workflow, since browsers can't read the feed directly
// (no CORS headers).
//
//   node scripts/fetch-deals.mjs dist/deals/deals.json
//
// If the feed can't be read or has no deals, it keeps the copy that's live on the site, so a
// Slickdeals outage never empties the page or fails the deploy.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

// The Tech & Electronics category feed. Set the SLICKDEALS_FEED_URL repository variable
// (Settings → Secrets and variables → Actions → Variables) to use another feed without
// changing code. A URL that isn't a feed yields no deals, which keeps the live copy.
export const FEED_URL = 'https://slickdeals.net/deals/tech/?rss=1';
const LIVE_URL = 'https://alexmaxham.github.io/Claude/deals/deals.json';
const MAX_DEALS = 60;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]).trim() : '';
}

function stripHtml(html) {
  return decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Words that follow a store name in titles ("at Amazon Free Shipping") but aren't part of it.
const STORE_STOP = /^(free|shipping|prime|with|w\/|for|members?|pickup|coupon|code|via|and|\+)$/i;

export function storeFromTitle(title) {
  const matches = [...title.matchAll(/(?:\bat|@)\s+([A-Z0-9][^\s,;()]*(?:\s+[A-Z0-9][^\s,;()]*){0,2})/g)];
  if (!matches.length) return '';
  const words = [];
  for (const w of matches[matches.length - 1][1].split(/\s+/)) {
    if (STORE_STOP.test(w)) break;
    words.push(w);
  }
  return words.join(' ').replace(/\.com$/i, '').replace(/[.:!]+$/, '');
}

export function priceFromTitle(title) {
  const m = title.match(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?/);
  return m ? Number(m[1].replace(/,/g, '') + (m[2] ?? '')) : null;
}

export function parseFeed(xml) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return items.slice(0, MAX_DEALS).flatMap((item) => {
    const title = stripHtml(tag(item, 'title'));
    const link = tag(item, 'link');
    if (!title || !/^https?:\/\//.test(link)) return [];
    const body = tag(item, 'content:encoded') || tag(item, 'description');
    const image =
      body.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ??
      item.match(/<(?:media:content|media:thumbnail|enclosure)[^>]+url=["']([^"']+)["']/i)?.[1] ??
      null;
    const thumbs = stripHtml(body).match(/Thumbs\s*Up:?\s*(\d+)/i)?.[1];
    const date = new Date(tag(item, 'pubDate'));
    return [
      {
        title,
        link,
        price: priceFromTitle(title),
        store: storeFromTitle(title),
        image: image && /^https:\/\//.test(image) ? decode(image) : null,
        thumbs: thumbs ? Number(thumbs) : null,
        published: Number.isNaN(date.getTime()) ? null : date.toISOString(),
      },
    ];
  });
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TechDealsPage/1.0 (+https://alexmaxham.github.io/Claude/deals/)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function main(outPath) {
  const feedUrl = process.env.SLICKDEALS_FEED_URL || FEED_URL;
  let data;
  try {
    const deals = parseFeed(await fetchText(feedUrl));
    if (!deals.length) throw new Error('the feed had no deals (is the URL an RSS feed?)');
    data = { source: feedUrl, fetchedAt: new Date().toISOString(), deals };
    console.log(`Fetched ${deals.length} deals from ${feedUrl}`);
  } catch (err) {
    console.warn(`::warning::Couldn't read the Slickdeals feed (${err.message}). Keeping the live deals.`);
    try {
      data = JSON.parse(await fetchText(LIVE_URL));
      if (!Array.isArray(data.deals)) throw new Error('not a deals file');
    } catch {
      data = { source: feedUrl, fetchedAt: null, deals: [] };
    }
  }
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(data));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const out = process.argv[2];
  if (!out) {
    console.error('Usage: node scripts/fetch-deals.mjs <output.json>');
    process.exit(1);
  }
  await main(out);
}
