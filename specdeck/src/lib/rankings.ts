import type { Device } from './schema';
import { formatDate, formatNumber, formatPrice } from './specs';

// "Best of" rankings, generated from the device data. Each one becomes /best/<slug>/ once at least
// MIN_RANKED devices qualify, so a ranking appears on its own when enough data comes in.
// Devices whose value is unknown are never ranked; pages say how many were left out.

export const MIN_RANKED = 3;

type Base = {
  slug: string;
  category: Device['category'];
  /** Page heading, e.g. "Phones with the biggest batteries". */
  title: string;
  /** Short label for tiles and links, e.g. "Biggest battery". */
  short: string;
  icon: string;
  /** One sentence on what is measured. */
  intro: string;
  /** What is unknown for left-out devices, e.g. "battery capacity". */
  metric: string;
  /** Narrows the devices considered, beyond the category (e.g. foldables only). */
  pool?: (d: Device) => boolean;
};

/** Ordered by a number. Positions are shown, and devices with the same value share one. */
type Ranked = Base & {
  kind: 'ranked';
  value: (d: Device) => number | null;
  better: 'higher' | 'lower';
  format: (n: number, d: Device) => string;
  /** Known values that still don't belong in the list (e.g. 0 W wireless charging). */
  keep?: (n: number) => boolean;
};

/** A yes/no list (e.g. phones with a headphone jack), newest first, without positions. */
type List = Base & {
  kind: 'list';
  /** True to include, false to leave out, null when unknown. */
  match: (d: Device) => boolean | null;
};

export type Ranking = Ranked | List;

export type Entry = { device: Device; position: number | null; value: string };
export type Built = { ranking: Ranking; entries: Entry[]; missing: Device[]; tied: boolean };

const usd = (d: Device) => (d.price?.currency === 'USD' ? d.price.amount : null);
const maxOf = (ns: number[]) => (ns.length ? Math.max(...ns) : null);
/** Megapixels of the main camera, read from the start of its description ("200 MP, f/1.7"). */
export const mainMp = (d: Device) => {
  const m = d.camera.main?.match(/^(\d+(?:\.\d+)?)\s*MP/);
  return m ? Number(m[1]) : null;
};
const isFoldable = (d: Device) => d.formFactor === 'book-fold' || d.formFactor === 'flip';
const hasCardSlot = (d: Device) => (d.memory.card === null ? null : /microsd/i.test(d.memory.card));
const grams = (n: number) => `${n} g`;
const mah = (n: number) => `${formatNumber(n)} mAh`;
const inches = (n: number) => `${n}"`;
const w = (n: number) => `${n} W`;
const price = (_: number, d: Device) => formatPrice({ ...d.price!, config: undefined })!;

export const RANKINGS: Ranking[] = [
  {
    kind: 'ranked', slug: 'biggest-battery-phones', category: 'phone', icon: 'battery_full',
    title: 'Phones with the biggest batteries', short: 'Biggest battery',
    intro: 'Phones ranked by rated battery capacity, as published by the maker.',
    metric: 'battery capacity', value: (d) => d.battery.mah, better: 'higher', format: mah,
  },
  {
    kind: 'ranked', slug: 'lightest-phones', category: 'phone', icon: 'scale',
    title: 'Lightest phones', short: 'Lightest',
    intro: 'Phones ranked by weight, lightest first.',
    metric: 'weight', value: (d) => d.body.weight_g, better: 'lower', format: grams,
  },
  {
    kind: 'ranked', slug: 'thinnest-phones', category: 'phone', icon: 'straighten',
    title: 'Thinnest phones', short: 'Thinnest',
    intro: 'Phones ranked by thickness, thinnest first. Foldables are measured open.',
    metric: 'thickness', value: (d) => d.body.thickness_mm, better: 'lower', format: (n) => `${n} mm`,
  },
  {
    kind: 'ranked', slug: 'biggest-screen-phones', category: 'phone', icon: 'fit_screen',
    title: 'Phones with the biggest screens', short: 'Biggest screen',
    intro: 'Phones ranked by screen size, measured diagonally. Foldables count their main, inner screen.',
    metric: 'screen size', value: (d) => d.display.size_in, better: 'higher', format: inches,
  },
  {
    kind: 'ranked', slug: 'brightest-screen-phones', category: 'phone', icon: 'light_mode',
    title: 'Phones with the brightest screens', short: 'Brightest screen',
    intro: 'Phones ranked by the peak brightness the maker quotes for the main screen.',
    metric: 'peak brightness', value: (d) => d.display.peak_nits, better: 'higher', format: (n) => `${formatNumber(n)} nits`,
  },
  {
    kind: 'ranked', slug: 'fastest-charging-phones', category: 'phone', icon: 'bolt',
    title: 'Phones with the fastest charging', short: 'Fastest charging',
    intro: 'Phones ranked by maximum wired charging power.',
    metric: 'wired charging speed', value: (d) => d.battery.wired_w, better: 'higher', format: w,
  },
  {
    kind: 'ranked', slug: 'fastest-wireless-charging-phones', category: 'phone', icon: 'battery_charging_full',
    title: 'Phones with the fastest wireless charging', short: 'Fastest wireless charging',
    intro: 'Phones ranked by maximum wireless charging power. Phones without wireless charging are not listed.',
    metric: 'wireless charging speed', value: (d) => d.battery.wireless_w, keep: (n) => n > 0, better: 'higher', format: w,
  },
  {
    kind: 'ranked', slug: 'highest-refresh-rate-phones', category: 'phone', icon: 'speed',
    title: 'Phones with the highest refresh rate', short: 'Highest refresh rate',
    intro: 'Phones ranked by the highest refresh rate of the main screen.',
    metric: 'refresh rate', value: (d) => d.display.refresh_hz, better: 'higher', format: (n) => `${n} Hz`,
  },
  {
    kind: 'ranked', slug: 'most-ram-phones', category: 'phone', icon: 'memory',
    title: 'Phones with the most RAM', short: 'Most RAM',
    intro: 'Phones ranked by the most RAM sold in any configuration.',
    metric: 'RAM', value: (d) => maxOf(d.memory.ram_gb), better: 'higher', format: (n) => `${n} GB`,
  },
  {
    kind: 'ranked', slug: 'highest-resolution-camera-phones', category: 'phone', icon: 'photo_camera',
    title: 'Phones with the highest-resolution main camera', short: 'Highest-resolution camera',
    intro: 'Phones ranked by the resolution of the main (wide) camera. More megapixels does not always mean better photos.',
    metric: 'main camera resolution', value: mainMp, better: 'higher', format: (n) => `${n} MP`,
  },
  {
    kind: 'ranked', slug: 'phones-under-800', category: 'phone', icon: 'sell',
    title: 'Phones under $800', short: 'Under $800',
    intro: 'Phones that launched in the US for under $800, cheapest first. Only US launch prices are compared.',
    metric: 'US launch price', value: usd, keep: (n) => n < 800, better: 'lower', format: price,
  },
  {
    kind: 'ranked', slug: 'phones-under-1000', category: 'phone', icon: 'sell',
    title: 'Phones under $1,000', short: 'Under $1,000',
    intro: 'Phones that launched in the US for under $1,000, cheapest first. Only US launch prices are compared.',
    metric: 'US launch price', value: usd, keep: (n) => n < 1000, better: 'lower', format: price,
  },
  {
    kind: 'ranked', slug: 'lightest-foldable-phones', category: 'phone', icon: 'devices_fold', pool: isFoldable,
    title: 'Lightest foldable phones', short: 'Lightest foldables',
    intro: 'Book-style and flip foldables ranked by weight, lightest first.',
    metric: 'weight', value: (d) => d.body.weight_g, better: 'lower', format: grams,
  },
  {
    kind: 'list', slug: 'phones-with-headphone-jack', category: 'phone', icon: 'headphones',
    title: 'Phones with a headphone jack', short: 'Headphone jack',
    intro: 'Phones with a 3.5 mm headphone jack, newest first.',
    metric: 'headphone jack', match: (d) => d.features.jack,
  },
  {
    kind: 'list', slug: 'phones-with-microsd', category: 'phone', icon: 'sd_card',
    title: 'Phones with a microSD slot', short: 'microSD slot',
    intro: 'Phones that take a microSD card for extra storage, newest first.',
    metric: 'card slot', match: hasCardSlot,
  },
  {
    kind: 'ranked', slug: 'biggest-battery-tablets', category: 'tablet', icon: 'battery_full',
    title: 'Tablets with the biggest batteries', short: 'Biggest battery',
    intro: 'Tablets ranked by rated battery capacity in mAh. Tablets rated only in watt-hours are not converted.',
    metric: 'battery capacity in mAh', value: (d) => d.battery.mah, better: 'higher', format: mah,
  },
  {
    kind: 'ranked', slug: 'lightest-tablets', category: 'tablet', icon: 'scale',
    title: 'Lightest tablets', short: 'Lightest',
    intro: 'Tablets ranked by weight, lightest first.',
    metric: 'weight', value: (d) => d.body.weight_g, better: 'lower', format: grams,
  },
  {
    kind: 'ranked', slug: 'biggest-screen-tablets', category: 'tablet', icon: 'fit_screen',
    title: 'Tablets with the biggest screens', short: 'Biggest screen',
    intro: 'Tablets ranked by screen size, measured diagonally.',
    metric: 'screen size', value: (d) => d.display.size_in, better: 'higher', format: inches,
  },
];

const newest = (a: Device, b: Device) => b.announced.localeCompare(a.announced) || a.name.localeCompare(b.name);

export function buildRanking(r: Ranking, devices: Device[]): Built {
  const pool = devices.filter((d) => d.category === r.category && (r.pool?.(d) ?? true));
  if (r.kind === 'list') {
    return {
      ranking: r,
      entries: pool
        .filter((d) => r.match(d) === true)
        .sort(newest)
        .map((d) => ({ device: d, position: null, value: `Announced ${formatDate(d.announced)}` })),
      missing: pool.filter((d) => r.match(d) === null),
      tied: false,
    };
  }
  const known = pool
    .map((d) => ({ d, n: r.value(d) }))
    .filter((x): x is { d: Device; n: number } => x.n !== null);
  const sign = r.better === 'higher' ? -1 : 1;
  const kept = known.filter((x) => r.keep?.(x.n) ?? true).sort((a, b) => sign * (a.n - b.n) || newest(a.d, b.d));
  // Shared positions for equal values: 1, 2, 2, 4.
  const entries = kept.map((x) => ({
    device: x.d,
    position: kept.findIndex((y) => y.n === x.n) + 1,
    value: r.format(x.n, x.d),
  }));
  return {
    ranking: r,
    entries,
    missing: pool.filter((d) => r.value(d) === null),
    tied: entries.some((e, i) => i > 0 && e.position === entries[i - 1].position),
  };
}

/** Every ranking with enough qualifying devices to get a page, in RANKINGS order. */
export function activeRankings(devices: Device[]): Built[] {
  return RANKINGS.map((r) => buildRanking(r, devices)).filter((b) => b.entries.length >= MIN_RANKED);
}

export const rankingUrl = (r: Pick<Ranking, 'slug'>) => `/best/${r.slug}/`;
