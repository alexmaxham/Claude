// Plain-language verdict lines for a head-to-head page. Pure, so it can be unit-tested.
import { costOver } from './cost';
import { amountValue, formatAmount, formatHotspot, formatPrice, type PlanLite } from './model';

const name = (p: PlanLite) => `${p.carrier.name} ${p.name}`;
/** Lower-cases a leading word ("Unlimited" → "unlimited") but leaves amounts like "50GB" alone. */
const lc = (s: string) => s.replace(/^[A-Z][a-z]/, (m) => m.toLowerCase());

export function verdict(a: PlanLite, b: PlanLite): string[] {
  const out: string[] = [];
  for (const lines of [1, 4]) {
    const ca = costOver(a, lines, 12).total;
    const cb = costOver(b, lines, 12).total;
    const label = lines === 1 ? 'For one line' : 'For a family of four';
    if (ca === cb) out.push(`${label}, both cost about the same over a year (${formatPrice(ca)}).`);
    else {
      const [cheap, dear, diff] = ca < cb ? [a, b, cb - ca] : [b, a, ca - cb];
      out.push(`${label}, ${name(cheap)} costs ${formatPrice(Math.round(diff))} less over a year than ${name(dear)}.`);
    }
  }
  const pa = amountValue(a.premiumData);
  const pb = amountValue(b.premiumData);
  if (pa !== pb) {
    const [more, less] = pa > pb ? [a, b] : [b, a];
    out.push(`${name(more)} has more premium data (${formatAmount(more.premiumData)} vs ${lc(formatAmount(less.premiumData))}), so it's less likely to slow down when the network is busy.`);
  }
  const ha = amountValue(a.hotspot);
  const hb = amountValue(b.hotspot);
  if (ha !== hb) {
    const [more, less] = ha > hb ? [a, b] : [b, a];
    out.push(`${name(more)} has more hotspot (${formatHotspot(more)} vs ${lc(formatHotspot(less))}).`);
  }
  if (a.networks.join() !== b.networks.join()) {
    out.push(`They use different networks: ${name(a)} runs on ${a.networks.join(' or ')}, ${name(b)} on ${b.networks.join(' or ')}. Check coverage where you live.`);
  }
  if (a.taxesIncluded !== b.taxesIncluded) {
    const inc = a.taxesIncluded ? a : b;
    out.push(`${name(inc)} includes taxes and fees in its price; the other adds them on top.`);
  }
  if (a.perks.length !== b.perks.length) {
    const more = a.perks.length > b.perks.length ? a : b;
    out.push(`${name(more)} includes more perks: ${more.perks.join(', ')}.`);
  }
  return out;
}
