import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Material Symbols Rounded, inlined as SVG at build time (server only).
const require = createRequire(import.meta.url);
const cache = new Map<string, string>();

export function iconPath(name: string, fill = false): string {
  const key = `${name}${fill ? '-fill' : ''}`;
  if (!cache.has(key)) {
    const file = require.resolve(`@material-symbols/svg-400/rounded/${key}.svg`);
    const d = readFileSync(file, 'utf8').match(/<path d="([^"]+)"/)?.[1];
    if (!d) throw new Error(`Icon "${key}" has no path`);
    cache.set(key, d);
  }
  return cache.get(key)!;
}

export function iconSvg(name: string, size = 20): string {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 -960 960 960" aria-hidden="true" fill="currentColor"><path d="${iconPath(name)}"/></svg>`;
}

export function iconMap(names: string[], size = 20): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n, iconSvg(n, size)]));
}
