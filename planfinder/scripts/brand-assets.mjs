// Regenerates the PNG icons and the social share image in public/ from the logo.
// Run from planfinder/: node scripts/brand-assets.mjs  (needs Playwright with Chromium installed).
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pub = path.join(root, 'public');
const fontDir = path.join(root, 'node_modules/@fontsource-variable/dm-sans/files');
const font = readdirSync(fontDir).find((f) => f.includes('latin-wght-normal') && f.endsWith('.woff2'));
// Embedded as a data URI: a page opened with setContent can't load file:// fonts.
const fontData = readFileSync(path.join(fontDir, font)).toString('base64');

const INK = '#13261E', ACCENT = '#C2410C', MINT = '#DCEFE2', GROUND = '#F2F5F1';
const bars = (lead = ACCENT) => `
  <rect x="11" y="40" width="8" height="10" rx="2.5" fill="${MINT}"/>
  <rect x="22" y="33" width="8" height="17" rx="2.5" fill="${MINT}"/>
  <rect x="33" y="26" width="8" height="24" rx="2.5" fill="${MINT}"/>
  <rect x="44" y="20" width="8" height="30" rx="2.5" fill="${lead}"/>
  <path d="M43 14.5 L48 9.5 L53 14.5" fill="none" stroke="${lead}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
const page = (body, w, h) => `<!doctype html><html><head><style>
  @font-face { font-family: 'DM Sans'; src: url(data:font/woff2;base64,${fontData}) format('woff2'); font-weight: 100 1000; }
  html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; }
</style></head><body>${body}</body></html>`;

// Square icon: rounded tile (or full-bleed for maskable) with the bars.
const icon = (n, maskable = false) =>
  page(`<svg width="${n}" height="${n}" viewBox="0 0 64 64">
    ${maskable ? `<rect width="64" height="64" fill="${INK}"/><g transform="translate(9.6 9.6) scale(0.7)">${bars()}</g>` : `<rect width="64" height="64" rx="${n >= 180 ? 0 : 14}" fill="${INK}"/>${bars()}`}
  </svg>`, n, n);

const og = page(`<div style="width:1200px;height:630px;box-sizing:border-box;background:${GROUND};font-family:'DM Sans';display:flex;flex-direction:column;justify-content:center;padding:0 96px;gap:28px;position:relative">
  <div style="display:flex;align-items:center;gap:34px">
    <svg width="150" height="150" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${INK}"/>${bars()}</svg>
    <div style="font-size:120px;font-weight:800;letter-spacing:-0.05em;color:${INK};line-height:1">SwitchWise</div>
  </div>
  <div style="font-size:50px;font-weight:700;color:${INK};letter-spacing:-0.02em;line-height:1.15;max-width:1000px">Compare phone plans from every carrier.<br/><span style="color:${ACCENT}">See what you'd really pay.</span></div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:22px;background:${INK}"></div>
</div>`, 1200, 630);

const jobs = [
  ['apple-touch-icon.png', icon(180), 180, 180],
  ['icon-192.png', icon(192), 192, 192],
  ['icon-512.png', icon(512), 512, 512],
  ['icon-maskable-512.png', icon(512, true), 512, 512],
  ['og-image.png', og, 1200, 630],
];
const browser = await chromium.launch();
for (const [file, html, w, h] of jobs) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(pub, file), omitBackground: false });
  await p.close();
  console.log('wrote public/' + file);
}
await browser.close();
