import { z } from 'astro/zod';

/** An amount of data in GB, or "unlimited". 0 means none. */
const amount = z.union([z.number().min(0), z.literal('unlimited')]);
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lower-case words joined by hyphens');
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'a 6-digit hex color like #E20074');

export const NETWORKS = ['Verizon', 'AT&T', 'T-Mobile'] as const;
export const KINDS = ['big3', 'mvno', 'prepaid'] as const;

export const carrierSchema = z.object({
  name: z.string(),
  /** big3 = Verizon, AT&T, T-Mobile. mvno = runs on another carrier's network. prepaid = a prepaid brand. */
  kind: z.enum(KINDS),
  /** The networks its plans run on. */
  networks: z.array(z.enum(NETWORKS)).min(1),
  /** Brand color, used for stripes, badges and card headers. */
  color: hex,
  /** Text color that is readable on `color` (white or a dark shade). */
  textOnColor: hex,
  /** Short letters shown when there is no logo file. */
  monogram: z.string().max(4),
  /** File name of the official logo in public/logos/ (SVG or PNG). Leave out until you have it. */
  logo: z.string().regex(/^[a-z0-9-]+\.(svg|png|webp)$/).optional(),
  website: z.string().url(),
  summary: z.string(),
});

export const planSchema = z.object({
  /** Slug of the carrier file in src/data/carriers/. */
  carrier: slug,
  name: z.string(),
  /** Monthly price for one line, with autopay if offered, before taxes and fees. */
  price: z.number().positive(),
  /** Monthly price for one line without autopay, if different. */
  priceWithoutAutopay: z.number().positive().optional(),
  /** Price per line when you have 2, 3 or 4 lines, if the carrier discounts multiple lines. */
  multiLine: z.object({ '2': z.number(), '3': z.number(), '4': z.number() }).partial().optional(),
  /** Which network this plan runs on (some MVNOs let you choose). */
  networks: z.array(z.enum(NETWORKS)).min(1),
  /** High-priority data before speeds may slow when the network is busy. */
  premiumData: amount,
  /** Total data. Most plans are "unlimited"; capped plans give a number. */
  data: amount,
  /** High-speed hotspot data. */
  hotspot: amount,
  /** Extra detail about hotspot, e.g. "unlimited at 5 Mbps". */
  hotspotNote: z.string().optional(),
  /** Streaming services and other perks included at no extra cost. */
  perks: z.array(z.string()),
  international: z.string(),
  billing: z.enum(['postpaid', 'prepaid']),
  /** e.g. "Pay for 12 months upfront for this price". */
  terms: z.string().optional(),
  highlights: z.array(z.string()).max(4).default([]),
  /** The carrier page this plan's details came from. */
  sourceUrl: z.string().url(),
  /** Date someone last checked this plan against sourceUrl (YYYY-MM-DD), or null if never. */
  lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export type CarrierData = z.infer<typeof carrierSchema>;
export type PlanData = z.infer<typeof planSchema>;
