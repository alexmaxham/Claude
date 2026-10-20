import { z } from 'astro/zod';

// One JSON file in src/data/devices/ per device, validated against this schema at build time.
// Unknown values are null (shown as "Not confirmed" on the site), never guessed.

const text = z.string().nullable().default(null);
const num = z.number().nullable().default(null);
const flag = z.boolean().nullable().default(null);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Use YYYY-MM-DD, or YYYY-MM when the day is unknown');
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex color like #7f9a78');

export const deviceSchema = z.object({
  name: z.string().min(1),
  brand: z.string().min(1),
  category: z.enum(['phone', 'tablet']),
  formFactor: z.enum(['bar', 'book-fold', 'flip', 'tablet']),
  announced: date,
  released: date.nullable().default(null),
  status: z.enum(['available', 'upcoming', 'discontinued']).default('available'),
  /** Where it is sold, when that is narrower than worldwide (e.g. "China only"). */
  markets: text,
  price: z
    .object({
      amount: z.number().positive(),
      currency: z.string().length(3),
      /** The configuration the price is for, e.g. "12 GB / 256 GB". */
      config: z.string().optional(),
    })
    .nullable()
    .default(null),
  /** Two colors for the generated device illustration: highlight, then shadow. */
  art: z.tuple([hex, hex]),
  /** Product photo in src/assets/devices/. Without one, the generated illustration is shown. */
  image: z
    .object({
      file: z.string().regex(/^[a-z0-9-]+\.(jpg|jpeg|png|webp|avif)$/, 'A file name in src/assets/devices/, e.g. "google-pixel-11-pro.webp"'),
      alt: z.string().optional(),
      /** Who owns the photo, shown under it, e.g. "Samsung". */
      credit: z.string().min(1),
      /** Where the photo came from (a press kit or newsroom page). */
      source: z.string().url(),
    })
    .nullable()
    .default(null),

  body: z
    .object({
      dimensions: text,
      folded: text,
      weight_g: num,
      thickness_mm: num,
      build: text,
      colors: z.array(z.string()).default([]),
      ip: text,
      sim: text,
    })
    .default({}),
  display: z
    .object({
      size_in: num,
      type: text,
      resolution: text,
      /** Leave null to have it calculated from size and resolution. */
      ppi: num,
      refresh: text,
      refresh_hz: num,
      peak_nits: num,
      protection: text,
      /** Foldables: the outside screen, e.g. '6.5", 1080 × 2520'. */
      cover: text,
    })
    .default({}),
  platform: z
    .object({ os: text, chipset: text, cpu: text, gpu: text, updates: text })
    .default({}),
  memory: z
    .object({
      ram_gb: z.array(z.number()).default([]),
      storage_gb: z.array(z.number()).default([]),
      card: text,
    })
    .default({}),
  camera: z
    .object({ main: text, ultrawide: text, telephoto: text, video: text })
    .default({}),
  selfie: z.object({ main: text, video: text }).default({}),
  battery: z
    .object({
      mah: num,
      /** Some makers (Apple tablets) publish watt-hours instead of mAh. */
      wh: num,
      /** Use this when the maker publishes only playback time. */
      life: text,
      wired_w: num,
      /** 0 means no wireless charging. */
      wireless_w: num,
      reverse: text,
    })
    .default({}),
  connectivity: z
    .object({
      network: text,
      wifi: text,
      bluetooth: text,
      nfc: flag,
      usb: text,
      satellite: text,
    })
    .default({}),
  features: z
    .object({ biometrics: text, speakers: text, jack: flag, stylus: text })
    .default({}),

  /** Where the values came from. At least one is required. */
  sources: z.array(z.string().url()).min(1),
  /** When the values were last checked against the sources. */
  checked: date,
  /** True once every value has been checked against the manufacturer's own spec sheet. */
  verified: z.boolean().default(false),
  notes: z.string().optional(),
});

export type DeviceData = z.infer<typeof deviceSchema>;
export type Device = DeviceData & {
  slug: string;
  /** URL of a small optimized photo, added at build time for the compare table. */
  thumb?: string | null;
};
