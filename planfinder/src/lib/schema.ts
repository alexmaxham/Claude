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
  /** Tile color behind the logo, for logos made for dark backgrounds. Defaults to white. */
  logoBackground: hex.optional(),
  /** Something you must already have to buy this carrier's plans, e.g. its home internet. */
  requires: z.string().optional(),
  website: z.string().url(),
  summary: z.string(),
  /** How the carrier's AutoPay discount works: amount, which payment methods qualify, when it starts. */
  autopayTerms: z.string(),
  /** The carrier's own coverage map. Leave out to use the host network's map. */
  coverageUrl: z.string().url().optional(),
  /** True when the AutoPay discount only starts from the second month (the first month is full price). */
  autopayStartsMonth2: z.boolean().default(false),
  /** Fees on top of the plan price, as listed on the carrier's site. */
  fees: z.object({
    /** Fee added to every line every month (e.g. T-Mobile's $5.49). */
    monthlyPerLine: z.number().min(0).default(0),
    monthlyNote: z.string().optional(),
    /** One-time fee per line (activation, connection), or null when the carrier doesn't list one. */
    oneTimePerLine: z.number().min(0).nullable(),
    oneTimeNote: z.string(),
  }),
});

export const DISCOUNT_GROUPS = ['military', 'first-responders', 'nurses', 'teachers', 'students', 'seniors', 'employer', 'low-income'] as const;
export const discountSchema = z.object({
  id: slug,
  /** Carrier slug, or null for programs not tied to one carrier (e.g. Lifeline). */
  carrier: slug.nullable(),
  groups: z.array(z.enum(DISCOUNT_GROUPS)).min(1),
  title: z.string(),
  details: z.string(),
  sourceUrl: z.string().url(),
  checked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const changeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string(),
  details: z.string(),
  plans: z.array(slug).default([]),
});

export const planSchema = z.object({
  /** Slug of the carrier file in src/data/carriers/. */
  carrier: slug,
  name: z.string(),
  /** A short, plain description of who the plan suits and what stands out. */
  description: z.string().min(40),
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
  /** True when the price already includes taxes and fees (common for prepaid). */
  taxesIncluded: z.boolean().default(false),
  /** e.g. "Pay for 12 months upfront for this price". */
  terms: z.string().optional(),
  highlights: z.array(z.string()).max(4).default([]),
  /** Overrides the carrier's AutoPay terms for this plan (e.g. a plan with no AutoPay discount). */
  autopayTerms: z.string().optional(),
  /** Limited-time offers. They are shown on the plan page but never included in prices. */
  deals: z
    .array(
      z.object({
        title: z.string(),
        details: z.string(),
        /** Last day of the offer (YYYY-MM-DD), if the carrier gives one. */
        ends: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    )
    .default([]),
  /** The carrier page this plan's details came from. */
  sourceUrl: z.string().url(),
  /** Date someone last checked this plan against sourceUrl (YYYY-MM-DD), or null if never. */
  lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export type CarrierData = z.infer<typeof carrierSchema>;
export type PlanData = z.infer<typeof planSchema>;
