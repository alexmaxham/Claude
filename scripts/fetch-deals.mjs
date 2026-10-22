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

// Deals are kept only when their title names a tech product or brand, so a feed covering
// every category (like Popular Deals) still gives a tech-only page. Matched as whole words,
// ignoring case. Leave out words that are common outside tech ("apple", "hp", "switch", "pc" as in
// "10 pc set", "tablets" as in "dishwasher tablets").
const TECH_WORDS = [
  // Computers and parts
  'laptops?', 'chromebooks?', 'macbook', 'imac', 'mac mini', 'mac studio', 'desktops?', 'gaming pcs?', 'pc games?', 'all-in-one pcs?',
  'monitors?', 'ssds?', 'nvme', 'hdds?', 'hard drives?', 'flash drives?', 'usb', 'usb-c', 'thunderbolt',
  'microsd', 'sd cards?', 'memory cards?', 'ram', 'ddr4', 'ddr5', 'gpus?', 'graphics cards?', 'rtx',
  'radeon', 'geforce', 'cpus?', 'processors?', 'ryzen', 'motherboards?', 'keyboards?', 'mice', 'mouse',
  'webcams?', 'printers?', 'scanners?', 'nas',
  // Phones, tablets and wearables
  'iphone', 'ipad', 'tablet', 'android tablets?', 'fire tablets?', 'galaxy tab', 'smartphones?', 'unlocked phones?', 'galaxy', 'pixel', 'android',
  'smartwatch(?:es)?', 'apple watch', 'fitbit', 'garmin', 'airtags?', 'kindle', 'e-readers?',
  // Audio, TV and video
  'tvs?', 'oled', 'qled', '4k', '8k', 'projectors?', 'soundbars?', 'speakers?', 'headphones?', 'earbuds',
  'airpods', 'headsets?', 'earphones?', 'beats', 'bose', 'jbl', 'sonos', 'roku', 'fire tv', 'chromecast',
  'apple tv', 'streaming stick', 'blu-ray', 'cameras?', 'dash ?cams?', 'gopro', 'drones?',
  // Networking and smart home
  'routers?', 'wi-?fi', 'mesh', 'modems?', 'ethernet', 'eero', 'tp-link', 'netgear', 'echo', 'alexa',
  'google home', 'nest', 'ring doorbell', 'video doorbell', 'smart plugs?', 'smart home', 'bluetooth',
  // Power and accessories
  'power banks?', 'chargers?', 'charging', 'hdmi', 'displayport', 'docking station', 'ups',
  // Gaming
  'gaming', 'xbox', 'playstation', 'ps5', 'nintendo', 'steam deck', 'controllers?', 'vr', 'meta quest',
  // Brands that are almost always tech
  'logitech', 'razer', 'corsair', 'anker', 'sandisk', 'samsung', 'sony', 'lenovo', 'dell', 'asus', 'acer',
  'msi', 'alienware', 'nvidia', 'amd', 'intel', 'western digital', 'seagate', 'crucial', 'kingston',
  'microsoft surface', 'surface pro', 'ugreen', 'belkin', 'tcl', 'hisense', 'vizio', 'lg oled', 'lg tv',
];
const TECH_PATTERN = new RegExp(`(?<![\\w-])(?:${TECH_WORDS.join('|')})(?![\\w-])`, 'i');

export function isTechDeal(title) {
  return TECH_PATTERN.test(title);
}

// Slickdeals' store links are encrypted redirects (slickdeals.net/click?...&u3=...), but links to
// Amazon carry the product ID: data-store-slug="amazon" data-aps-asin="B07Q32KX3J". That gives a
// clean product link with no affiliate tag or tracking. Null when the deal has no Amazon link.
export function amazonLinkFrom(html) {
  for (const [a] of html.matchAll(/<a\s[^>]*>/gi)) {
    const asin = a.match(/data-aps-asin=["']([A-Z0-9]{10})["']/i)?.[1];
    if (asin && /data-store-slug=["']amazon["']|data-product-exitwebsite=["']amazon\.com["']/i.test(a)) {
      return `https://www.amazon.com/dp/${asin.toUpperCase()}`;
    }
  }
  return null;
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
    const thumbs = stripHtml(body).match(/Thumbs?\s*(?:Up|Score):?\s*\+?(-?\d+)/i)?.[1];
    const date = new Date(tag(item, 'pubDate'));
    const amazon = amazonLinkFrom(body);
    // Coupon codes are only in Slickdeals' description, so the page shows them on direct links.
    const coupon = body.match(/class=["']code["'][^>]*>\s*(?:<[^>]+>\s*)*([A-Z0-9][A-Z0-9-]{2,29})\s*</i)?.[1] ?? null;
    return [
      {
        title,
        // Amazon deals link straight to the product; others to the Slickdeals deal page.
        link: amazon ?? link,
        thread: link,
        price: priceFromTitle(title),
        store: storeFromTitle(title) || (amazon ? 'Amazon' : ''),
        image: image && /^https:\/\//.test(image) ? decode(image) : null,
        thumbs: thumbs ? Number(thumbs) : null,
        coupon,
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
    const all = parseFeed(await fetchText(feedUrl));
    if (!all.length) throw new Error('the feed had no deals (is the URL an RSS feed?)');
    const deals = all.filter((d) => isTechDeal(d.title));
    if (!deals.length) throw new Error(`none of the feed's ${all.length} deals were tech deals`);
    data = { source: feedUrl, fetchedAt: new Date().toISOString(), deals };
    const direct = deals.filter((d) => d.link !== d.thread).length;
    console.log(`Fetched ${all.length} deals from ${feedUrl}; kept ${deals.length} tech deals, ${direct} with a direct Amazon link`);
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
