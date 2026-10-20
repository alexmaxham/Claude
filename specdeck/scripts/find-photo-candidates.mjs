#!/usr/bin/env node
// One-off helper: collects candidate product photos for review. For each device without a photo it saves
// up to four candidates to image-candidates/<slug>/, each with a JSON note of its source and license:
//  - the infobox photo of the device's Wikipedia article, only if Commons lists a free license
//  - the best matches on Wikimedia Commons (free licenses only)
//  - the og:image of an official press or product page listed below
// Nothing here is published; chosen photos are added with npm run add-image.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const UA = 'SpecAtlasPhotoFinder/1.0 (https://specdeck-db.web.app; spec database, attribution kept)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const OFFICIAL = {
  'apple-iphone-18-pro': ['https://www.apple.com/newsroom/2026/09/apple-debuts-iphone-18-pro-and-iphone-18-pro-max/', 'https://www.apple.com/iphone-18-pro/'],
  'apple-iphone-18-pro-max': ['https://www.apple.com/iphone-18-pro/'],
  'apple-iphone-duo': ['https://www.apple.com/iphone-duo/'],
  'apple-ipad-air-11-m4': ['https://www.apple.com/newsroom/2026/03/apple-introduces-the-new-ipad-air-powered-by-m4/', 'https://www.apple.com/ipad-air/'],
  'apple-ipad-air-13-m4': ['https://www.apple.com/ipad-air/'],
  'samsung-galaxy-s26': ['https://news.samsung.com/global/samsung-unveils-galaxy-s26-series-the-most-intuitive-galaxy-ai-phone-yet', 'https://www.samsung.com/us/smartphones/galaxy-s26/'],
  'samsung-galaxy-s26-plus': ['https://www.samsung.com/us/smartphones/galaxy-s26-plus/'],
  'samsung-galaxy-s26-ultra': ['https://www.samsung.com/us/smartphones/galaxy-s26-ultra/'],
  'samsung-galaxy-z-fold8-ultra': ['https://www.samsung.com/us/smartphones/galaxy-z-fold8-ultra/'],
  'samsung-galaxy-z-fold8': ['https://www.samsung.com/us/smartphones/galaxy-z-fold8/'],
  'samsung-galaxy-z-flip8': ['https://www.samsung.com/us/smartphones/galaxy-z-flip8/'],
  'samsung-galaxy-tab-s12-ultra': ['https://www.samsung.com/us/tablets/galaxy-tab-s12-ultra/'],
  'samsung-galaxy-tab-s12-plus': ['https://www.samsung.com/us/tablets/galaxy-tab-s12/'],
  'google-pixel-11': ['https://store.google.com/product/pixel_11?hl=en-US'],
  'google-pixel-11-pro': ['https://store.google.com/product/pixel_11_pro?hl=en-US'],
  'google-pixel-11-pro-xl': ['https://store.google.com/product/pixel_11_pro?hl=en-US'],
  'google-pixel-11-pro-fold': ['https://store.google.com/product/pixel_11_pro_fold?hl=en-US'],
  'xiaomi-17-ultra': ['https://www.mi.com/global/product/xiaomi-17-ultra/'],
  'xiaomi-pad-8-pro': ['https://www.mi.com/global/product/xiaomi-pad-8-pro/'],
  'vivo-x300-ultra': ['https://www.vivo.com/en/products/x300-ultra'],
  'oppo-find-x9-ultra': ['https://www.oppo.com/en/smartphones/series-find-x/find-x9-ultra/'],
  'sony-xperia-1-viii': ['https://www.sony.com/electronics/smartphones/xperia-1m8'],
  'motorola-razr-fold': ['https://www.motorola.com/us/smartphones-razr-fold/p'],
  'oneplus-16': ['https://www.oneplus.com/cn/16'],
  'oneplus-pad-4': ['https://www.oneplus.com/global/pad-4'],
  'honor-magicpad-4': ['https://www.honor.com/global/tablets/honor-magicpad4/'],
};
const FREE = /^(CC[ -]?BY|CC0|Public domain|PD)/i;

const get = async (url, ua = UA) => {
  const res = await fetch(url, { headers: { 'User-Agent': ua, Accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
};
const json = async (url) => (await get(url)).json();
const strip = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function commonsInfo(fileTitle) {
  const r = await json(`https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`);
  const page = Object.values(r.query?.pages ?? {})[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) return null;
  const m = ii.extmetadata ?? {};
  return {
    url: ii.thumburl ?? ii.url,
    page: ii.descriptionurl,
    width: ii.width,
    height: ii.height,
    license: strip(m.LicenseShortName?.value),
    artist: strip(m.Artist?.value),
    title: fileTitle,
  };
}

async function wikipediaCandidate(name) {
  const r = await json(`https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(name)}&gsrlimit=3&prop=pageimages&piprop=name`);
  const pages = Object.values(r.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  const hit = pages.find((p) => p.pageimage);
  if (!hit) return null;
  const info = await commonsInfo(`File:${hit.pageimage}`);
  return info && { ...info, via: `Wikipedia article "${hit.title}"` };
}

async function commonsCandidates(name) {
  const r = await json(`https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=4&srsearch=${encodeURIComponent(name)}`);
  const out = [];
  for (const s of r.query?.search ?? []) {
    if (!/\.(jpe?g|png|webp)$/i.test(s.title)) continue;
    const info = await commonsInfo(s.title);
    if (info) out.push({ ...info, via: 'Wikimedia Commons search' });
    if (out.length >= 2) break;
  }
  return out;
}

async function officialCandidate(pageUrl) {
  const html = await (await get(pageUrl, BROWSER_UA)).text();
  const img = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i)?.[1];
  if (!img) throw new Error(`no og:image on ${pageUrl}`);
  return { url: new URL(img.replace(/&amp;/g, '&'), pageUrl).href, page: pageUrl, license: 'Manufacturer press/product image', via: 'Official page og:image' };
}

const dir = new URL('../src/data/devices/', import.meta.url);
const report = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const slug = file.replace(/\.json$/, '');
  const d = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
  if (d.image) continue;
  const name = d.name.toLowerCase().startsWith(d.brand.toLowerCase()) ? d.name : `${d.brand} ${d.name}`;
  const found = [];
  const notes = [];
  for (const task of [
    () => wikipediaCandidate(name).then((c) => c && [c]),
    () => commonsCandidates(name),
    ...(OFFICIAL[slug] ?? []).map((u) => () => officialCandidate(u).then((c) => [c])),
  ]) {
    try {
      found.push(...((await task()) ?? []));
    } catch (e) {
      notes.push(e.message);
    }
  }
  const outDir = new URL(`../image-candidates/${slug}/`, import.meta.url);
  mkdirSync(outDir, { recursive: true });
  let n = 0;
  for (const c of found) {
    if (c.license && c.via !== 'Official page og:image' && !FREE.test(c.license)) {
      notes.push(`skipped non-free ${c.title} (${c.license})`);
      continue;
    }
    if (found.slice(0, found.indexOf(c)).some((o) => o.url === c.url)) continue;
    try {
      const buf = Buffer.from(await (await get(c.url, c.via === 'Official page og:image' ? BROWSER_UA : UA)).arrayBuffer());
      n++;
      await sharp(buf).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toFile(new URL(`${n}.webp`, outDir).pathname);
      writeFileSync(new URL(`${n}.json`, outDir), JSON.stringify(c, null, 2));
    } catch (e) {
      notes.push(`download failed ${c.url}: ${e.message}`);
    }
  }
  report.push({ slug, name, candidates: n, notes });
  console.log(`${slug}: ${n} candidate(s)${notes.length ? ` — ${notes.join('; ')}` : ''}`);
}
writeFileSync(new URL('../image-candidates/report.json', import.meta.url), JSON.stringify(report, null, 2));
