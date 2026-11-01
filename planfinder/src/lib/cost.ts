// What a plan really costs over time: the monthly price plus listed fees, one-time charges and a
// full-price first month where AutoPay savings start later. Taxes are left out unless a plan
// includes them, because they depend on where you live.
import { priceFor, type PlanLite } from './model';

export interface Cost {
  lines: number;
  months: number;
  /** Plan price per line per month. */
  perLine: number;
  /** Monthly fee per line on top of the price. */
  monthlyFee: number;
  /** One-time fees for all lines (0 when none are listed). */
  oneTime: number;
  /** False when the carrier doesn't list its one-time fees, so they may be missing. */
  oneTimeKnown: boolean;
  /** Extra paid in the first month for all lines. */
  firstMonthExtra: number;
  total: number;
  /** Total divided by months. */
  perMonth: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function costOver(p: PlanLite, lines: number, months: number): Cost {
  const perLine = priceFor(p, lines).perLine;
  const oneTime = (p.oneTimeFee ?? 0) * lines;
  const firstMonthExtra = p.firstMonthExtra * lines;
  const total = round((perLine + p.monthlyFee) * lines * months + oneTime + firstMonthExtra);
  return {
    lines,
    months,
    perLine,
    monthlyFee: p.monthlyFee,
    oneTime,
    oneTimeKnown: p.oneTimeFee !== null,
    firstMonthExtra,
    total,
    perMonth: round(total / months),
  };
}

/** Plain sentence listing the fees counted in a cost, for notes under tables. */
export function feeSummary(p: PlanLite): string {
  const parts: string[] = [];
  if (p.monthlyFee > 0) parts.push(`$${p.monthlyFee.toFixed(2)}/line monthly fee`);
  if (p.oneTimeFee) parts.push(`$${p.oneTimeFee}/line one-time fee`);
  if (p.firstMonthExtra > 0) parts.push(`first month $${p.firstMonthExtra} more per line (AutoPay savings start in month two)`);
  return parts.length ? `Includes ${parts.join(', ')}.` : 'No extra fees listed.';
}
