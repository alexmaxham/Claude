import { getCollection } from 'astro:content';
import type { Device } from './schema';

import { compareSlug } from './names';

export * from './names';

export async function allDevices(): Promise<Device[]> {
  const entries = await getCollection('devices');
  return entries
    .map((e) => ({ ...e.data, slug: e.id }))
    .sort((a, b) => b.announced.localeCompare(a.announced) || a.name.localeCompare(b.name));
}


/** Rivals for a device: same category and form factor first, then closest launch price and date. */
export function rivals(d: Device, devices: Device[], count = 4): Device[] {
  const usd = (x: Device) => (x.price?.currency === 'USD' ? x.price.amount : null);
  const score = (x: Device) => {
    let s = 0;
    if (x.formFactor !== d.formFactor) s += 1000;
    const p1 = usd(d);
    const p2 = usd(x);
    s += p1 !== null && p2 !== null ? Math.abs(p1 - p2) / 10 : 60;
    s += Math.abs(Date.parse(d.announced) - Date.parse(x.announced)) / 864e5 / 10;
    if (x.brand === d.brand) s += 15;
    return s;
  };
  return devices
    .filter((x) => x.slug !== d.slug && x.category === d.category)
    .sort((a, b) => score(a) - score(b))
    .slice(0, count);
}

/** Every pre-rendered comparison: each device paired with its top rivals. */
export function comparePairs(devices: Device[]): [Device, Device][] {
  const seen = new Map<string, [Device, Device]>();
  for (const d of devices) {
    for (const r of rivals(d, devices, 3)) {
      const pair = [d, r].sort((a, b) => a.slug.localeCompare(b.slug)) as [Device, Device];
      seen.set(compareSlug(d, r), pair);
    }
  }
  return [...seen.values()];
}

export function brands(devices: Device[]) {
  const map = new Map<string, Device[]>();
  for (const d of devices) map.set(d.brand, [...(map.get(d.brand) ?? []), d]);
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
