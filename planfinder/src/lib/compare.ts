// Builds the rows of the side-by-side comparison and marks the best value in each row.
import {
  amountValue,
  formatAmount,
  formatHotspot,
  formatNetworks,
  formatPerks,
  formatPrice,
  KIND_LONG,
  type PlanLite,
} from './model';

interface RowDef {
  label: string;
  text: (p: PlanLite) => string;
  /** Numeric value used to find the best plan, and whether higher (1) or lower (-1) wins. */
  value?: (p: PlanLite) => number;
  better?: 1 | -1;
}

const ROWS: RowDef[] = [
  { label: 'Monthly price', text: (p) => `${formatPrice(p.price)}/mo`, value: (p) => p.price, better: -1 },
  { label: 'Network', text: (p) => formatNetworks(p.networks) },
  { label: 'Carrier type', text: (p) => KIND_LONG[p.carrier.kind] },
  { label: 'Premium data', text: (p) => formatAmount(p.premiumData), value: (p) => amountValue(p.premiumData), better: 1 },
  { label: 'Hotspot', text: formatHotspot, value: (p) => amountValue(p.hotspot), better: 1 },
  { label: 'Perks', text: (p) => formatPerks(p.perks), value: (p) => p.perks.length, better: 1 },
  { label: 'International', text: (p) => p.international },
  { label: 'Billing', text: (p) => (p.billing === 'prepaid' ? 'Prepaid' : 'Monthly bill') + (p.terms ? ` · ${p.terms}` : '') },
];

export interface CompareCell {
  text: string;
  best: boolean;
}
export interface CompareRow {
  label: string;
  cells: CompareCell[];
  /** True when every plan has the same value. */
  same: boolean;
}

export function compareRows(plans: PlanLite[]): CompareRow[] {
  return ROWS.map((r) => {
    const texts = plans.map(r.text);
    const same = texts.every((t) => t === texts[0]);
    let best: number | null = null;
    if (r.value && r.better && plans.length >= 2) {
      const vals = plans.map(r.value);
      if (!vals.every((v) => v === vals[0])) best = r.better > 0 ? Math.max(...vals) : Math.min(...vals);
    }
    return {
      label: r.label,
      same,
      cells: plans.map((p, i) => ({ text: texts[i], best: best !== null && r.value!(p) === best })),
    };
  });
}

/** Parses "?plans=a,b,c" into known slugs, dropping unknown and duplicate ones and capping at four. */
export function parsePlanList(value: string | null, known: Set<string>, max = 4): string[] {
  if (!value) return [];
  const out: string[] = [];
  for (const s of value.split(',').map((x) => x.trim())) {
    if (known.has(s) && !out.includes(s)) out.push(s);
    if (out.length === max) break;
  }
  return out;
}
