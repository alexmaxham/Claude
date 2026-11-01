// The slim plan record shared by pages and browser scripts. No Astro imports here, so tests and
// client code can use it.

export type Amount = number | 'unlimited';
export type Kind = 'big3' | 'mvno' | 'prepaid';

export interface CarrierLite {
  slug: string;
  name: string;
  kind: Kind;
  color: string;
  textOnColor: string;
  monogram: string;
  /** URL of the logo file, or null to show the monogram. */
  logoUrl: string | null;
  /** Tile color behind the logo (white unless the logo is made for dark backgrounds). */
  logoBackground: string;
}

export interface PlanLite {
  slug: string;
  name: string;
  url: string;
  carrier: CarrierLite;
  price: number;
  priceWithoutAutopay?: number;
  networks: string[];
  premiumData: Amount;
  data: Amount;
  hotspot: Amount;
  hotspotNote?: string;
  perks: string[];
  international: string;
  billing: 'postpaid' | 'prepaid';
  terms?: string;
  /** Price per line with 2, 3 or 4 lines, where the carrier lists one. */
  multiLine?: Partial<Record<'2' | '3' | '4', number>>;
  taxesIncluded: boolean;
  /** AutoPay discount per line per month that is already taken off `price` (0 if none). */
  autopayDiscount: number;
  /** Fee added to each line every month on top of the price (0 if none). */
  monthlyFee: number;
  /** One-time fee per line, or null when the carrier doesn't list one. */
  oneTimeFee: number | null;
  /** Extra charged per line in the first month (when AutoPay savings start from month two). */
  firstMonthExtra: number;
  /** Something you must already have to buy the plan (e.g. the carrier's home internet), or null. */
  requires: string | null;
  verified: boolean;
}

export const MAX_COMPARE = 4;
export const LINE_OPTIONS = [1, 2, 3, 4] as const;
export type Lines = (typeof LINE_OPTIONS)[number];

export interface LinePrice {
  perLine: number;
  total: number;
  /** False when the carrier lists no price for this many lines, so the one-line price is used. */
  listed: boolean;
}

/** Price per line and in total for a number of lines. Falls back to the one-line price when no multi-line price is listed. */
export function priceFor(p: Pick<PlanLite, 'price' | 'multiLine'>, lines: number): LinePrice {
  if (lines <= 1) return { perLine: p.price, total: p.price, listed: true };
  const listedPrice = p.multiLine?.[String(lines) as '2' | '3' | '4'];
  const perLine = listedPrice ?? p.price;
  // Per-line prices like $56.67 are a carrier's round total split three ways, so snap to it.
  const raw = perLine * lines;
  const total = Math.abs(raw - Math.round(raw)) < 0.02 ? Math.round(raw) : Math.round(raw * 100) / 100;
  return { perLine, total, listed: listedPrice !== undefined };
}

export function parseLines(v: string | null | undefined): Lines {
  const n = Number(v);
  return (LINE_OPTIONS as readonly number[]).includes(n) ? (n as Lines) : 1;
}

export const KIND_LABEL: Record<Kind, string> = { big3: 'Big 3', mvno: 'MVNO', prepaid: 'Prepaid' };
export const KIND_LONG: Record<Kind, string> = {
  big3: 'Major carrier',
  mvno: 'MVNO',
  prepaid: 'Prepaid brand',
};

/** Numeric value for comparing amounts; unlimited sorts above everything. */
export function amountValue(a: Amount): number {
  return a === 'unlimited' ? Number.POSITIVE_INFINITY : a;
}

export function formatAmount(a: Amount, none = 'None'): string {
  if (a === 'unlimited') return 'Unlimited';
  if (a <= 0) return none;
  return `${a}GB`;
}

export function formatHotspot(p: Pick<PlanLite, 'hotspot' | 'hotspotNote'>): string {
  return p.hotspotNote ?? formatAmount(p.hotspot);
}

export function formatPrice(n: number): string {
  return Number.isInteger(n)
    ? `$${n.toLocaleString('en-US')}`
    : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNetworks(networks: string[]): string {
  return networks.join(' or ');
}

export function formatPerks(perks: string[]): string {
  return perks.length ? perks.join(', ') : 'None';
}
