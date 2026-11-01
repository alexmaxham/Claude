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
  verified: boolean;
}

export const MAX_COMPARE = 4;

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
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export function formatNetworks(networks: string[]): string {
  return networks.join(' or ');
}

export function formatPerks(perks: string[]): string {
  return perks.length ? perks.join(', ') : 'None';
}
