// Renders the iPhone app icon and launch screen from the web app's logo, straight
// into the Xcode asset catalogs. Run after changing public/icon-maskable.svg:
//   node scripts/ios-assets.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const assets = new URL('../ios/App/App/Assets.xcassets/', import.meta.url);
const BG = '#04070f';

// App icon: the full-bleed logo (iOS rounds the corners itself), no transparency allowed.
const icon = readFileSync(new URL('../public/icon-maskable.svg', import.meta.url));
await sharp(icon, { density: 1024 })
  .resize(1024, 1024)
  .flatten({ background: BG })
  .png()
  .toFile(new URL('AppIcon.appiconset/AppIcon-512@2x.png', assets).pathname);

// Launch screen: the logo mark on the app's background. The storyboard scales this
// square to fill the screen, so the mark stays small and centered on any iPhone.
const SIZE = 2732;
const MARK = 300;
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${MARK}" height="${MARK}">
  <g fill="none" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M28 76L50 58L72 76" stroke="#2f63e0"/>
    <path d="M28 59L50 41L72 59" stroke="#7b9ef2"/>
    <path d="M28 42L50 24L72 42" stroke="#fff"/>
  </g>
</svg>`;
const splash = await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: BG } })
  .composite([{ input: Buffer.from(mark), gravity: 'center' }])
  .png()
  .toBuffer();
const splashDir = new URL('Splash.imageset/', assets);
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  writeFileSync(new URL(name, splashDir), splash);
}
console.log('Wrote the app icon and launch screen.');
