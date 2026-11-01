// Loads carriers and plans at build time and turns them into the records pages use.
import { existsSync } from 'node:fs';
import { getCollection } from 'astro:content';
import type { CarrierData, PlanData } from './schema';
import type { CarrierLite, PlanLite } from './model';
import { href } from './site';

export interface Carrier extends CarrierData {
  slug: string;
  url: string;
  lite: CarrierLite;
}
export interface Plan extends PlanData {
  slug: string;
  url: string;
  carrierInfo: Carrier;
  lite: PlanLite;
}

let cache: Promise<{ carriers: Carrier[]; plans: Plan[] }> | null = null;

async function load() {
  const carrierEntries = await getCollection('carriers');
  const carriers: Carrier[] = carrierEntries.map(({ id, data }) => {
    if (data.logo && !existsSync(new URL(`../../public/logos/${data.logo}`, import.meta.url))) {
      throw new Error(`Carrier "${id}" names logo "${data.logo}", but public/logos/${data.logo} does not exist.`);
    }
    const lite: CarrierLite = {
      slug: id,
      name: data.name,
      kind: data.kind,
      color: data.color,
      textOnColor: data.textOnColor,
      monogram: data.monogram,
      logoUrl: data.logo ? href(`logos/${data.logo}`) : null,
    };
    return { ...data, slug: id, url: href(`carriers/${id}/`), lite };
  });
  const bySlug = new Map(carriers.map((c) => [c.slug, c]));

  const planEntries = await getCollection('plans');
  const plans: Plan[] = planEntries.map(({ id, data }) => {
    const carrierInfo = bySlug.get(data.carrier);
    if (!carrierInfo) throw new Error(`Plan "${id}" names carrier "${data.carrier}", which has no file in src/data/carriers/.`);
    const url = href(`plans/${id}/`);
    const lite: PlanLite = {
      slug: id,
      name: data.name,
      url,
      carrier: carrierInfo.lite,
      price: data.price,
      priceWithoutAutopay: data.priceWithoutAutopay,
      networks: data.networks,
      premiumData: data.premiumData,
      data: data.data,
      hotspot: data.hotspot,
      hotspotNote: data.hotspotNote,
      perks: data.perks,
      international: data.international,
      billing: data.billing,
      terms: data.terms,
      multiLine: data.multiLine,
      taxesIncluded: data.taxesIncluded,
      autopayDiscount: data.priceWithoutAutopay ? Math.round((data.priceWithoutAutopay - data.price) * 100) / 100 : 0,
      verified: data.lastVerified !== null,
    };
    return { ...data, slug: id, url, carrierInfo, lite, autopayTerms: data.autopayTerms ?? carrierInfo.autopayTerms };
  });
  plans.sort((a, b) => a.price - b.price || a.slug.localeCompare(b.slug));
  carriers.sort((a, b) => ['big3', 'mvno', 'prepaid'].indexOf(a.kind) - ['big3', 'mvno', 'prepaid'].indexOf(b.kind) || a.name.localeCompare(b.name));
  return { carriers, plans };
}

export function getData() {
  cache ??= load();
  return cache;
}

export function planTitle(p: Pick<Plan, 'name' | 'carrierInfo'>): string {
  return `${p.carrierInfo.name} ${p.name}`;
}
