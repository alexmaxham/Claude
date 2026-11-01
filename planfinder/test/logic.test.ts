import { describe, expect, it } from 'vitest';
import { compareRows, parsePlanList } from '../src/lib/compare';
import { formatAmount, formatHotspot, parseLines, priceFor, type PlanLite } from '../src/lib/model';
import { DEFAULT_ANSWERS, parseAnswers, rankPlans } from '../src/lib/score';

function plan(slug: string, o: Partial<PlanLite> & { kind?: PlanLite['carrier']['kind'] } = {}): PlanLite {
  const { kind = 'mvno', ...rest } = o;
  return {
    slug, name: slug, url: `/plans/${slug}/`,
    carrier: { slug: `${slug}-c`, name: `${slug} Carrier`, kind, color: '#000000', textOnColor: '#FFFFFF', monogram: 'X', logoUrl: null },
    price: 50, networks: ['T-Mobile'], premiumData: 0, data: 'unlimited', hotspot: 0, perks: [],
    international: 'None', billing: 'prepaid', taxesIncluded: false, autopayDiscount: 0, verified: false, ...rest,
  };
}

describe('formatting', () => {
  it('formats amounts', () => {
    expect(formatAmount('unlimited')).toBe('Unlimited');
    expect(formatAmount(0)).toBe('None');
    expect(formatAmount(35)).toBe('35GB');
  });
  it('prefers the hotspot note', () => {
    expect(formatHotspot({ hotspot: 0, hotspotNote: 'Unlimited at 3G speeds' })).toBe('Unlimited at 3G speeds');
  });
});

describe('finder ranking', () => {
  const cheap = plan('cheap', { price: 25 });
  const big = plan('big', { price: 85, kind: 'big3', premiumData: 'unlimited', hotspot: 60 });
  const perky = plan('perky', { price: 80, kind: 'big3', perks: ['Netflix', 'Hulu', 'Apple TV'], premiumData: 'unlimited', hotspot: 50 });

  it('puts the cheapest plan first when price matters most', () => {
    expect(rankPlans([big, perky, cheap], DEFAULT_ANSWERS)[0].plan.slug).toBe('cheap');
  });
  it('favors major carriers for coverage with heavy data and daily hotspot', () => {
    const top = rankPlans([cheap, big, perky], { lines: '1', data: 'heavy', priority: 'coverage', hotspot: 'daily' })[0];
    expect(top.plan.carrier.kind).toBe('big3');
  });
  it('favors perks when perks matter most', () => {
    const top = rankPlans([cheap, big, perky], { lines: '1', data: 'average', priority: 'perks', hotspot: 'never' })[0];
    expect(top.plan.slug).toBe('perky');
    expect(top.why).toMatch(/Netflix/);
  });
  it('always explains a match in a sentence', () => {
    for (const r of rankPlans([cheap, big, perky], DEFAULT_ANSWERS)) expect(r.why).toMatch(/^[A-Z].*\.$/);
  });
  it('reads answers from the URL and ignores bad values', () => {
    expect(parseAnswers(new URLSearchParams('data=heavy&priority=nope'))).toEqual({ ...DEFAULT_ANSWERS, data: 'heavy' });
  });
});

describe('comparison', () => {
  const a = plan('a', { price: 30, hotspot: 10 });
  const b = plan('b', { price: 45, hotspot: 'unlimited', hotspotNote: 'Unlimited at 5 Mbps' });

  it('marks the lowest price and most hotspot as best', () => {
    const rows = compareRows([a, b]);
    const price = rows.find((r) => r.label === 'Monthly price')!;
    const hotspot = rows.find((r) => r.label === 'Hotspot')!;
    expect(price.cells.map((c) => c.best)).toEqual([true, false]);
    expect(hotspot.cells.map((c) => c.best)).toEqual([false, true]);
  });
  it('marks nothing when every plan ties, and flags the row as the same', () => {
    const perks = compareRows([a, b]).find((r) => r.label === 'Perks')!;
    expect(perks.same).toBe(true);
    expect(perks.cells.some((c) => c.best)).toBe(false);
  });
  it('marks nothing for a single plan', () => {
    expect(compareRows([a]).flatMap((r) => r.cells).some((c) => c.best)).toBe(false);
  });
  it('parses a shared plan list: known slugs only, no repeats, at most four', () => {
    const known = new Set(['a', 'b', 'c', 'd', 'e']);
    expect(parsePlanList('a,zzz,b,a,c,d,e', known)).toEqual(['a', 'b', 'c', 'd']);
    expect(parsePlanList(null, known)).toEqual([]);
  });
});

describe('multi-line pricing', () => {
  const family = plan('family', { price: 65, multiLine: { '2': 55, '4': 30 } });
  const flat = plan('flat', { price: 40 });

  it('uses the listed price per line and multiplies for the total', () => {
    expect(priceFor(family, 4)).toEqual({ perLine: 30, total: 120, listed: true });
    expect(priceFor(family, 1)).toEqual({ perLine: 65, total: 65, listed: true });
  });
  it('falls back to the one-line price when no multi-line price is listed', () => {
    expect(priceFor(family, 3)).toEqual({ perLine: 65, total: 195, listed: false });
  });
  it('re-ranks by the price for the chosen number of lines', () => {
    const one = rankPlans([family, flat], DEFAULT_ANSWERS)[0].plan.slug;
    const four = rankPlans([family, flat], { ...DEFAULT_ANSWERS, lines: '4' })[0];
    expect(one).toBe('flat');
    expect(four.plan.slug).toBe('family');
    expect(four.why).toMatch(/\$30 per line with 4 lines/);
  });
  it('compares per-line and total prices for several lines', () => {
    const rows = compareRows([family, flat], 4);
    expect(rows[0].label).toBe('Per line (4 lines)');
    expect(rows[0].cells.map((c) => c.text)).toEqual(['$30/mo', '$40/mo (no multi-line price listed)']);
    expect(rows[1].label).toBe('Total for 4 lines');
    expect(rows[1].cells.map((c) => c.best)).toEqual([true, false]);
  });
  it('reads the number of lines safely', () => {
    expect(parseLines('3')).toBe(3);
    expect(parseLines('9')).toBe(1);
    expect(parseLines(null)).toBe(1);
  });
});

describe('AutoPay transparency', () => {
  it('shows the AutoPay discount in the comparison, or none', () => {
    const withDiscount = plan('ap', { price: 65, autopayDiscount: 10 });
    const without = plan('none', { price: 25 });
    const row = compareRows([withDiscount, without]).find((r) => r.label === 'AutoPay discount')!;
    expect(row.cells.map((c) => c.text)).toEqual(['$10/line, included in price', 'None (same price either way)']);
  });
});
