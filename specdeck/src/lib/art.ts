// Material 3 Expressive "cookie" shape: a circle with a scalloped edge, as an SVG path in a 100×100 box.
export function cookiePath(points: number, depth: number, rotation = 0): string {
  const steps = 160;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = 50 * (1 - depth + (depth * (Math.cos(points * t) + 1)) / 2);
    const x = 50 + r * Math.cos(t + rotation);
    const y = 50 + r * Math.sin(t + rotation);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d + 'Z';
}

/** Base size in px of the device silhouette for each form factor, before scaling. */
export const SILHOUETTE = {
  bar: { w: 66, h: 132 },
  'book-fold': { w: 112, h: 128 },
  flip: { w: 60, h: 136 },
  tablet: { w: 116, h: 160 },
} as const;

/** A stable small number from a string, so each device gets its own shape rotation. */
export function seed(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

type ArtDevice = { slug: string; formFactor: keyof typeof SILHOUETTE; art: [string, string] };

/** The device illustration as an HTML string, so pages and browser scripts render it the same way. */
export function artHtml(d: ArtDevice, height: number, label: string, shape = true, className = ''): string {
  const base = SILHOUETTE[d.formFactor];
  const scale = (height * 0.74) / base.h;
  const w = Math.round(base.w * scale);
  const h = Math.round(base.h * scale);
  const points = d.formFactor === 'tablet' ? 4 : d.formFactor === 'book-fold' ? 6 : 9;
  const size = Math.round(height * 0.92);
  const cookie = shape
    ? `<svg class="cookie" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path d="${cookiePath(points, 0.12, (seed(d.slug) % 10) / 10)}" fill="currentColor"/></svg>`
    : '';
  return `<div class="art ${className}" style="height:${height}px">${cookie}<div class="device ${d.formFactor}" style="width:${w}px;height:${h}px;background:linear-gradient(150deg,${d.art[0]},${d.art[1]})" role="img" aria-label="${label.replace(/"/g, '&quot;')}"></div></div>`;
}
