#!/usr/bin/env node
// Adds a product render to a device: cuts it out and centers it (scripts/lib/normalize-render.mjs), saves it in src/assets/devices/,
// and records the file, credit and source in the device's JSON file.
// Usage: npm run add-image -- <device-slug> <file-or-url> --credit "Samsung" --source <url> [--alt "..."]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { normalizeRender, RenderError } from './lib/normalize-render.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const credit = flag('credit');
const source = flag('source');
const alt = flag('alt');
const [slug, input] = args;

function fail(msg) {
  console.error(msg);
  console.error('Usage: npm run add-image -- <device-slug> <file-or-url> --credit "Samsung" --source <url> [--alt "..."]');
  process.exit(1);
}
if (!slug || !input) fail('Give the device slug and an image file or URL.');
if (!credit || !source) fail('Give --credit (who owns the photo) and --source (the press page it came from).');
try {
  new URL(source);
} catch {
  fail(`--source must be a full URL, got "${source}".`);
}

const dataFile = new URL(`../src/data/devices/${slug}.json`, import.meta.url);
if (!existsSync(dataFile)) fail(`No device file src/data/devices/${slug}.json.`);

let buffer;
if (/^https?:\/\//.test(input)) {
  const res = await fetch(input);
  if (!res.ok) fail(`Download failed: ${res.status} ${res.statusText}`);
  buffer = Buffer.from(await res.arrayBuffer());
} else {
  if (!existsSync(input)) fail(`File not found: ${input}`);
  buffer = readFileSync(input);
}

// Every device image is cut out, trimmed and centered on the same square canvas, so they all match.
const file = `${slug}.webp`;
const out = new URL(`../src/assets/devices/${file}`, import.meta.url);
try {
  writeFileSync(out, await normalizeRender(buffer));
} catch (e) {
  fail(e instanceof RenderError ? e.message : `Could not read the image: ${e.message}`);
}

const image = { file, ...(alt ? { alt } : {}), credit, source };
const line = `  "image": ${JSON.stringify(image).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, '{ ').replace(/\}$/, ' }')},`;
const text = readFileSync(dataFile, 'utf8');
let next;
if (/^ {2}"image": .*$/m.test(text)) next = text.replace(/^ {2}"image": .*$/m, line);
else if (/^ {2}"art": .*$/m.test(text)) next = text.replace(/^( {2}"art": .*)$/m, `$1\n${line}`);
else fail(`Could not find the "art" line in ${slug}.json to add the image after.`);
JSON.parse(next);
writeFileSync(dataFile, next);

console.log(`Saved src/assets/devices/${file} and updated ${slug}.json.`);
console.log('Run npm run build to check it.');
