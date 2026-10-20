import type { Device } from './schema';
import { fullName, deviceUrl } from './names';

// Devices drawn to scale side by side, from body.dimensions. Shared by server-rendered pages
// and the browser (compare builder and /size/), so it only uses the device data.

/** Height and width in mm, with the long side as height so everything stands upright. */
export function dims(d: Pick<Device, 'body'>): { h: number; w: number; t: number | null } | null {
  const m = d.body.dimensions?.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)(?:\s*[×x]\s*(\d+(?:\.\d+)?))?/);
  if (!m) return null;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return { h: Math.max(a, b), w: Math.min(a, b), t: m[3] ? Number(m[3]) : null };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n: number) => Math.round(n * 10) / 10;

export function sizeViewHtml(devices: Device[]): string {
  const drawn = devices.map((d) => ({ d, s: dims(d) })).filter((x): x is { d: Device; s: NonNullable<ReturnType<typeof dims>> } => x.s !== null);
  const missing = devices.filter((d) => !dims(d));
  if (!drawn.length) {
    return `<p class="size-none">${missing.length === 1 ? 'This device’s dimensions aren’t' : 'None of these devices’ dimensions are'} confirmed yet, so ${missing.length === 1 ? 'it' : 'they'} can’t be drawn to scale.</p>`;
  }

  const tallest = Math.max(...drawn.map((x) => x.s.h));
  const gap = tallest * 0.08;
  // Each device gets a column at least wide enough for its label.
  const minCol = tallest * 0.42;
  let x = 0;
  const items = drawn.map(({ d, s }) => {
    const img = d.formFactor === 'bar' || d.formFactor === 'tablet' ? d.scaleImage ?? null : null;
    // A render may show the back and front together, so it can be wider than the device.
    const scale = img ? s.h / img.h : 0;
    const artW = img ? img.w * scale : s.w;
    const col = Math.max(artW, minCol);
    const item = { d, s, img, scale, artW, col, x };
    x += col + gap;
    return item;
  });
  const width = x - gap;
  const height = tallest;

  const art = items
    .map(({ d, s, img, scale, artW, col, x }) => {
      const left = x + (col - artW) / 2;
      const top = height - s.h;
      if (img) {
        const W = scale; // canvas width and height in mm (the canvas is square)
        return `<image href="${img.src}" x="${r1(left - img.x * W)}" y="${r1(top - img.y * W)}" width="${r1(W)}" height="${r1(W)}" preserveAspectRatio="xMidYMid meet"><title>${esc(fullName(d))}</title></image>`;
      }
      const rad = Math.min(s.w, s.h) * (d.formFactor === 'tablet' ? 0.05 : 0.12);
      const bezel = d.formFactor === 'tablet' ? 4 : 1.6;
      const id = `g-${d.slug}`;
      const crease =
        d.formFactor === 'book-fold'
          ? `<line x1="${r1(left + s.w / 2)}" y1="${r1(top + bezel)}" x2="${r1(left + s.w / 2)}" y2="${r1(top + s.h - bezel)}" class="crease"/>`
          : d.formFactor === 'flip'
            ? `<line x1="${r1(left + bezel)}" y1="${r1(top + s.h / 2)}" x2="${r1(left + s.w - bezel)}" y2="${r1(top + s.h / 2)}" class="crease"/>`
            : '';
      return `<g><title>${esc(fullName(d))}</title>
        <defs>
          <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${d.art[0]}"/><stop offset="1" stop-color="${d.art[1]}"/></linearGradient>
          <linearGradient id="${id}-s" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb, ${d.art[1]} 55%, #05070a)"/><stop offset=".55" stop-color="${d.art[1]}"/><stop offset="1" stop-color="${d.art[0]}"/></linearGradient>
        </defs>
        <rect x="${r1(left)}" y="${r1(top)}" width="${r1(s.w)}" height="${r1(s.h)}" rx="${r1(rad)}" fill="url(#${id})"/>
        <rect x="${r1(left + 0.5)}" y="${r1(top + 0.5)}" width="${r1(s.w - 1)}" height="${r1(s.h - 1)}" rx="${r1(rad - 0.5)}" class="screen"/>
        <rect x="${r1(left + bezel)}" y="${r1(top + bezel)}" width="${r1(s.w - 2 * bezel)}" height="${r1(s.h - 2 * bezel)}" rx="${r1(Math.max(rad - bezel, 1))}" fill="url(#${id}-s)"/>
        ${crease}</g>`;
    })
    .join('');

  // Empty items between labels stand in for the gaps, so each label sits under its device.
  const labels = items
    .map(({ d, s }) => `<li><a href="${deviceUrl(d)}">${esc(d.name)}</a><span class="num">${s.h} × ${s.w}${s.t ? ` × ${s.t}` : ''} mm</span></li>`)
    .join('<li aria-hidden="true"></li>');
  const cols = items.map((i) => `${r1(i.col)}fr`).join(` ${r1(gap)}fr `);
  const notes = [
    items.some((i) => i.d.formFactor === 'book-fold' || i.d.formFactor === 'flip') ? 'Foldables are drawn open.' : '',
    missing.length
      ? `Not drawn because ${missing.length === 1 ? 'its dimensions aren’t' : 'their dimensions aren’t'} confirmed: ${missing.map((d) => `<a href="${deviceUrl(d)}">${esc(fullName(d))}</a>`).join(', ')}.`
      : '',
  ].filter(Boolean);

  return `<figure class="sizeview" style="--ratio:${r1(width / height)}">
    <svg viewBox="0 0 ${r1(width)} ${r1(height)}" role="img" aria-label="${esc(`Drawn to scale: ${items.map((i) => `${fullName(i.d)}, ${i.s.h} by ${i.s.w} mm`).join('; ')}`)}">${art}</svg>
    <ul class="sizelabels" style="grid-template-columns:${cols}">${labels}</ul>
    ${notes.length ? `<figcaption>${notes.join(' ')}</figcaption>` : ''}
  </figure>`;
}
