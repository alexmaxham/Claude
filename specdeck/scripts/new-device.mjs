#!/usr/bin/env node
// Creates a new device file with every spec field present and empty, ready to fill in.
// Usage: npm run new-device -- "Samsung" "Galaxy S27 Ultra" phone [bar|book-fold|flip]
import { existsSync, writeFileSync } from 'node:fs';

const [brand, name, category, formFactor] = process.argv.slice(2);
if (!brand || !name || !['phone', 'tablet'].includes(category)) {
  console.error('Usage: npm run new-device -- "<Brand>" "<Model name>" <phone|tablet> [bar|book-fold|flip]');
  console.error('Example: npm run new-device -- "Samsung" "Galaxy S27 Ultra" phone');
  process.exit(1);
}
const form = category === 'tablet' ? 'tablet' : (formFactor ?? 'bar');
if (!['bar', 'book-fold', 'flip', 'tablet'].includes(form)) {
  console.error(`Unknown form factor "${form}". Use bar, book-fold or flip.`);
  process.exit(1);
}

const slugify = (s) => s.toLowerCase().replace(/["″]/g, '').replace(/\+/g, '-plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const slug = name.toLowerCase().startsWith(brand.toLowerCase()) ? slugify(name) : slugify(`${brand} ${name}`);
const file = new URL(`../src/data/devices/${slug}.json`, import.meta.url);
if (existsSync(file)) {
  console.error(`src/data/devices/${slug}.json already exists.`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const device = {
  name,
  brand,
  category,
  formFactor: form,
  announced: today,
  released: null,
  status: 'available',
  markets: null,
  price: null,
  art: ['#c9d3d8', '#56636b'],
  body: { dimensions: null, folded: null, weight_g: null, thickness_mm: null, build: null, colors: [], ip: null, sim: null },
  display: { size_in: null, type: null, resolution: null, ppi: null, refresh: null, refresh_hz: null, peak_nits: null, protection: null, cover: null },
  platform: { os: null, chipset: null, cpu: null, gpu: null, updates: null },
  memory: { ram_gb: [], storage_gb: [], card: null },
  camera: { main: null, ultrawide: null, telephoto: null, video: null },
  selfie: { main: null, video: null },
  battery: { mah: null, wh: null, life: null, wired_w: null, wireless_w: null, reverse: null },
  connectivity: { network: null, wifi: null, bluetooth: null, nfc: null, usb: null, satellite: null },
  features: { biometrics: null, speakers: null, jack: null, stylus: null },
  sources: [],
  checked: today,
  verified: false,
};
writeFileSync(file, JSON.stringify(device, null, 2) + '\n');
console.log(`Created src/data/devices/${slug}.json`);
console.log('Fill in the specs you can confirm, add at least one source URL, then run npm run build to check it.');
