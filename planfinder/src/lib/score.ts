// Ranks plans for the guided finder from three answers. Pure, so it runs in the browser and in tests.
import { amountValue, formatAmount, formatHotspot, formatPrice, priceFor, type PlanLite } from './model';

export type DataUse = 'light' | 'average' | 'heavy';
export type Priority = 'price' | 'coverage' | 'perks';
export type HotspotUse = 'never' | 'sometimes' | 'daily';

export interface Answers {
  data: DataUse;
  priority: Priority;
  hotspot: HotspotUse;
  lines: '1' | '2' | '3' | '4';
}

export const DEFAULT_ANSWERS: Answers = { lines: '1', data: 'average', priority: 'price', hotspot: 'sometimes' };

export const QUESTIONS = [
  {
    key: 'lines',
    label: 'How many lines do you need?',
    options: [
      { value: '1', label: '1 line', hint: 'Just me' },
      { value: '2', label: '2 lines', hint: 'Me plus one' },
      { value: '3', label: '3 lines', hint: 'Small family' },
      { value: '4', label: '4 lines', hint: 'Family plan' },
    ],
  },
  {
    key: 'data',
    label: 'How much data do you use?',
    options: [
      { value: 'light', label: 'Light', hint: 'Mostly on Wi-Fi' },
      { value: 'average', label: 'Average', hint: 'Social, maps, music' },
      { value: 'heavy', label: 'Heavy', hint: 'Video on the go' },
    ],
  },
  {
    key: 'priority',
    label: 'What matters most?',
    options: [
      { value: 'price', label: 'Lowest price', hint: 'Every dollar counts' },
      { value: 'coverage', label: 'Coverage', hint: 'Fast when it’s busy' },
      { value: 'perks', label: 'Perks', hint: 'Streaming included' },
    ],
  },
  {
    key: 'hotspot',
    label: 'Do you use your phone as a hotspot?',
    options: [
      { value: 'never', label: 'Never', hint: 'Not really' },
      { value: 'sometimes', label: 'Sometimes', hint: 'Travel, backup' },
      { value: 'daily', label: 'Every day', hint: 'Laptop or tablet' },
    ],
  },
] as const;

/** Reads answers from URL search params, falling back to the defaults for anything missing or invalid. */
export function parseAnswers(params: URLSearchParams): Answers {
  const out: Answers = { ...DEFAULT_ANSWERS };
  for (const q of QUESTIONS) {
    const v = params.get(q.key);
    if (v && q.options.some((o) => o.value === v)) (out as unknown as Record<string, string>)[q.key] = v;
  }
  return out;
}

export interface Ranked {
  plan: PlanLite;
  score: number;
  why: string;
}

export function scorePlan(p: PlanLite, a: Answers): Ranked {
  const premium = amountValue(p.premiumData);
  const hotspot = amountValue(p.hotspot);
  const lines = Number(a.lines);
  // Rank on what each line actually costs for the number of lines asked for.
  const lp = priceFor(p, lines);
  // Monthly fees (like T-Mobile's per-line fee) count as part of the price.
  const price = lp.perLine + p.monthlyFee;
  let s = 100 - price;
  const why: string[] = [];

  if (a.priority === 'price') {
    s += 100 - price;
    if (price <= 45) {
      why.push(lines > 1 && lp.listed ? `just ${formatPrice(price)} per line with ${lines} lines` : `one of the lowest prices at ${formatPrice(price)}/mo`);
    }
  } else if (a.priority === 'coverage') {
    if (p.carrier.kind === 'big3') {
      s += 35;
      why.push(`direct from ${p.carrier.name}, so you get top priority on its network`);
    }
    if (premium === Infinity) s += 15;
  } else {
    s += p.perks.length * 22;
    if (p.perks.length) why.push(`includes ${p.perks.join(', ')}`);
  }

  if (a.data === 'heavy') {
    s += premium === Infinity ? 30 : premium >= 50 ? 15 : -15;
    if (premium >= 50) why.push(`${p.premiumData === 'unlimited' ? 'unlimited' : formatAmount(p.premiumData)} premium data for streaming`);
  } else if (a.data === 'light') {
    if (price <= 45) {
      s += 15;
      if (a.priority !== 'price') why.push('you won’t pay for data you don’t use');
    }
  } else if (premium >= 35) {
    s += 8;
    if (!why.length) why.push(`${formatAmount(p.premiumData)} of premium data covers typical use`);
  }

  if (a.hotspot === 'daily') {
    s += hotspot >= 50 ? 25 : hotspot >= 15 ? 5 : -20;
    if (hotspot >= 50) why.push(`${formatHotspot(p)} of hotspot`);
  } else if (a.hotspot === 'sometimes') {
    s += hotspot >= 10 ? 10 : -10;
    if (hotspot >= 10 && why.length < 2) why.push(`${formatHotspot(p)} hotspot for when you need it`);
  }

  if (!why.length) why.push(`a solid pick on the ${p.networks.join(' or ')} network`);
  const text = why.slice(0, 2).join(', and ');
  return { plan: p, score: s, why: text.charAt(0).toUpperCase() + text.slice(1) + '.' };
}

/** All plans, best match first. Ties go to the cheaper plan, then by name, so the order is stable. */
/** True when the visitor can buy the plan: it needs nothing extra, or they have what it needs. */
export function canBuy(p: PlanLite, owned: string[] = []): boolean {
  return p.requires === null || owned.includes(p.carrier.slug);
}

/**
 * Plans whose requirements the visitor doesn't meet (e.g. Xfinity Mobile without Xfinity Internet)
 * are kept but always sorted after the ones they can buy.
 */
export function rankPlans(plans: PlanLite[], a: Answers, owned: string[] = []): Ranked[] {
  return plans
    .map((p) => scorePlan(p, a))
    .sort((x, y) => Number(canBuy(y.plan, owned)) - Number(canBuy(x.plan, owned)) || y.score - x.score || priceFor(x.plan, Number(a.lines)).perLine + x.plan.monthlyFee - (priceFor(y.plan, Number(a.lines)).perLine + y.plan.monthlyFee) || x.plan.slug.localeCompare(y.plan.slug));
}
