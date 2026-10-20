import type { ImageMetadata } from 'astro';
import { join } from 'node:path';
import sharp from 'sharp';
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

/**
 * The render for the to-scale size comparison, with where the device sits on its square canvas.
 * Only upright renders are used: a sideways or open-fold render can't be matched to the height.
 */
export async function scaleImage(d: Device): Promise<{ src: string; x: number; y: number; w: number; h: number } | null> {
  const src = photoFor(d);
  if (!src || !(d.formFactor === 'bar' || d.formFactor === 'tablet')) return null;
  const { info } = await sharp(join(process.cwd(), 'src/assets/devices', d.image!.file)).trim().toBuffer({ resolveWithObject: true });
  if (info.width > info.height * 1.1) return null;
  const left = -(info.trimOffsetLeft ?? 0);
  const top = -(info.trimOffsetTop ?? 0);
  return {
    src: (await getImage({ src, height: Math.min(720, src.height), format: 'webp' })).src,
    x: left / src.width,
    y: top / src.height,
    w: info.width / src.width,
    h: info.height / src.height,
  };
}
