#!/usr/bin/env node
// One-off helper: collects every large image from official press and product pages, so front-facing
// renders can be picked by eye. Saves candidates to render-candidates/<slug>/ with a note of where each came from.
import { writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
// Pages to read for each device. "discover:" entries are index pages; links on them matching the pattern are read too.
const PAGES = {
  'apple-iphone-18-pro': ['https://www.apple.com/newsroom/2026/09/apple-debuts-iphone-18-pro-and-iphone-18-pro-max/', 'https://www.apple.com/iphone-18-pro/'],
  'apple-iphone-18-pro-max': ['https://www.apple.com/newsroom/2026/09/apple-debuts-iphone-18-pro-and-iphone-18-pro-max/'],
  'apple-iphone-duo': ['discover:https://www.apple.com/newsroom/archive/2026/09/|iphone-duo', 'https://www.apple.com/iphone-duo/'],
  'apple-ipad-air-11-m4': ['https://www.apple.com/newsroom/2026/03/apple-introduces-the-new-ipad-air-powered-by-m4/'],
  'apple-ipad-air-13-m4': ['https://www.apple.com/newsroom/2026/03/apple-introduces-the-new-ipad-air-powered-by-m4/'],
  'samsung-galaxy-s26': ['https://news.samsung.com/global/samsung-unveils-galaxy-s26-series-the-most-intuitive-galaxy-ai-phone-yet', 'discover:https://news.samsung.com/global/?s=galaxy+s26|galaxy-s26'],
  'samsung-galaxy-s26-plus': ['https://news.samsung.com/global/samsung-unveils-galaxy-s26-series-the-most-intuitive-galaxy-ai-phone-yet'],
  'samsung-galaxy-s26-ultra': ['https://news.samsung.com/global/samsung-unveils-galaxy-s26-series-the-most-intuitive-galaxy-ai-phone-yet'],
  'samsung-galaxy-z-fold8-ultra': ['https://news.samsung.com/global/samsung-galaxy-z-fold8-ultra-fold8-and-flip8foldables-perfected-for-every-way-of-living', 'https://news.samsung.com/global/galaxy-unpacked-july-2026-a-first-look-at-galaxy-z-fold8-ultra-galaxy-z-fold8-and-galaxy-z-flip8'],
  'samsung-galaxy-z-fold8': ['https://news.samsung.com/global/samsung-galaxy-z-fold8-ultra-fold8-and-flip8foldables-perfected-for-every-way-of-living'],
  'samsung-galaxy-z-flip8': ['https://news.samsung.com/global/samsung-galaxy-z-fold8-ultra-fold8-and-flip8foldables-perfected-for-every-way-of-living'],
  'samsung-galaxy-tab-s12-ultra': ['discover:https://news.samsung.com/global/?s=galaxy+tab+s12|tab-s12'],
  'samsung-galaxy-tab-s12-plus': ['discover:https://news.samsung.com/global/?s=galaxy+tab+s12|tab-s12'],
  'google-pixel-11': ['https://store.google.com/product/pixel_11?hl=en-US', 'discover:https://blog.google/products/pixel/|pixel-11'],
  'google-pixel-11-pro': ['https://store.google.com/product/pixel_11_pro?hl=en-US', 'discover:https://blog.google/products/pixel/|pixel-11'],
  'google-pixel-11-pro-xl': ['https://store.google.com/product/pixel_11_pro?hl=en-US'],
  'google-pixel-11-pro-fold': ['https://store.google.com/product/pixel_11_pro_fold?hl=en-US'],
  'xiaomi-17-ultra': ['https://www.mi.com/global/product/xiaomi-17-ultra/'],
  'xiaomi-pad-8-pro': ['https://www.mi.com/global/product/xiaomi-pad-8-pro/'],
  'oppo-find-x9-ultra': ['https://www.oppo.com/en/smartphones/series-find-x/find-x9-ultra/'],
  'vivo-x300-ultra': ['https://www.vivo.com/en/products/x300-ultra', 'https://www.vivo.com.cn/vivo/x300ultra/'],
  'sony-xperia-1-viii': ['https://www.sony.co.uk/electronics/smartphones/xperia-1m8', 'https://www.sony.net/Products/smartphones/'],
  'motorola-razr-fold': ['https://www.motorola.com/us/smartphones-razr-fold/p', 'https://motorola-global-portal.custhelp.com/'],
  'oneplus-16': ['https://www.oneplus.com/cn/16', 'https://www.oneplus.com/global/16'],
  'oneplus-pad-4': ['https://www.oneplus.com/global/pad-4', 'https://www.oneplus.com/us/pad-4'],
  'honor-magicpad-4': ['https://www.honor.com/uk/tablets/honor-magicpad4/', 'https://www.honor.com/global/tablets/honor-magicpad-4/'],
};

const get = (url) => fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*', 'Accept-Language': 'en-US,en;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });

function imageUrls(html, base) {
  const found = new Set();
  const re = /(?:https?:)?\/\/[^\s"'()<>\\]+?\.(?:png|jpe?g|webp)(?:\?[^\s"'()<>\\]*)?|\/[^\s"'()<>\\]+?\.(?:png|jpe?g|webp)(?:\?[^\s"'()<>\\]*)?/gi;
  for (const m of html.replace(/\\\//g, '/').matchAll(re)) {
    try {
      found.add(new URL(m[0].startsWith('//') ? 'https:' + m[0] : m[0], base).href);
    } catch {}
  }
  // Google Store images have no extension.
  for (const m of html.matchAll(/https:\/\/lh3\.googleusercontent\.com\/[A-Za-z0-9_\-=]+/g)) found.add(m[0] + '=s1600');
  return [...found];
}

async function pagesFor(entry) {
  if (!entry.startsWith('discover:')) return [entry];
  const [url, pattern] = entry.slice(9).split('|');
  const html = await (await get(url)).text();
  const links = [...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => new URL(m[1], url).href).filter((h) => h.includes(pattern));
  return [...new Set(links)].slice(0, 3);
}

const report = [];
for (const [slug, entries] of Object.entries(PAGES)) {
  const notes = [];
  const seen = new Set();
  const outDir = new URL(`../render-candidates/${slug}/`, import.meta.url);
  mkdirSync(outDir, { recursive: true });
  let n = 0;
  for (const entry of entries) {
    let pages = [];
    try {
      pages = await pagesFor(entry);
    } catch (e) {
      notes.push(`discover failed: ${e.message}`);
    }
    for (const page of pages) {
      let html;
      try {
        const res = await get(page);
        if (!res.ok) throw new Error(String(res.status));
        html = await res.text();
      } catch (e) {
        notes.push(`${page}: ${e.message}`);
        continue;
      }
      const urls = imageUrls(html, page).filter((u) => !/(icon|logo|sprite|favicon|avatar|badge|flag|arrow)/i.test(u));
      notes.push(`${page}: ${urls.length} image urls`);
      for (const u of urls) {
        if (n >= 16) break;
        const key = u.replace(/[?#].*$/, '').replace(/(_[0-9]+x[0-9]+|\.large(_2x)?|_big|_small|_inline)/g, '');
        if (seen.has(key)) continue;
        seen.add(key);
        try {
          const res = await get(u);
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          const meta = await sharp(buf).metadata();
          if ((meta.width ?? 0) < 500 && (meta.height ?? 0) < 500) continue;
          n++;
          await sharp(buf).resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).png().toFile(new URL(`${n}.png`, outDir).pathname);
          writeFileSync(new URL(`${n}.json`, outDir), JSON.stringify({ url: u, page, width: meta.width, height: meta.height, alpha: meta.hasAlpha }, null, 2));
        } catch {}
      }
    }
  }
  report.push({ slug, candidates: n, notes });
  console.log(`${slug}: ${n} — ${notes.join(' | ').slice(0, 300)}`);
}
writeFileSync(new URL('../render-candidates/report.json', import.meta.url), JSON.stringify(report, null, 2));
