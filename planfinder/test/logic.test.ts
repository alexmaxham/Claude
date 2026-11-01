import { describe, expect, it } from 'vitest';
import { compareRows, parsePlanList } from '../src/lib/compare';
import { formatAmount, formatHotspot, type PlanLite } from '../src/lib/model';
import { DEFAULT_ANSWERS, parseAnswers, rankPlans } from '../src/lib/score';

function plan(slug: string, o: Partial<PlanLite> & { kind?: PlanLite['carrier']['kind'] } = {}): PlanLite {
  const { kind = 'mvno', ...rest } = o;
  return {
    slug, name: slug, url: `/plans/${slug}/`,
    carrier: { slug: `${slug}-c`, name: `${slug} Carrier`, kind, color: '#000000', textOnColor: '#FFFFFF', monogram: 'X', logoUrl: null },
    price: 50, networks: ['T-Mobile'], premiumData: 0, data: 'unlimited', hotspot: 0, perks: [],
    international: 'None', billing: 'prepaid', verified: false, ...rest,
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
    const top = rankPlans([cheap, big, perky], { data: 'heavy', priority: 'coverage', hotspot: 'daily' })[0];
    expect(top.plan.carrier.kind).toBe('big3');
  });
  it('favors perks when perks matter most', () => {
    const top = rankPlans([cheap, big, perky], { data: 'average', priority: 'perks', hotspot: 'never' })[0];
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
