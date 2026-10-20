import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import type { Device } from './schema';
import { fullName } from './names';

// Product photos live in src/assets/devices/ and are optimized at build time (resized, converted to WebP).
const files = import.meta.glob<{ default: ImageMetadata }>('../assets/devices/*.{jpg,jpeg,png,webp,avif}', { eager: true });
const byName = new Map(Object.entries(files).map(([path, mod]) => [path.split('/').pop()!, mod.default]));

export function photoFor(d: Device): ImageMetadata | null {
  if (!d.image) return null;
  const meta = byName.get(d.image.file);
  if (!meta) throw new Error(`${d.slug}.json: image file src/assets/devices/${d.image.file} does not exist`);
  return meta;
}

export const photoAlt = (d: Device) => d.image?.alt ?? `${fullName(d)}`;

/** A small WebP used in the compare table, which the browser renders itself. */
export async function thumbUrl(d: Device): Promise<string | null> {
  const src = photoFor(d);
  return src ? (await getImage({ src, height: 208, format: 'webp' })).src : null;
}

/** A 1200px-wide JPEG for link previews and structured data. */
export async function shareImageUrl(d: Device): Promise<string | null> {
  const src = photoFor(d);
  return src ? (await getImage({ src, width: Math.min(1200, src.width), format: 'jpg' })).src : null;
}
