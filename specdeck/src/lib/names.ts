import type { Device } from './schema';

// Pure helpers shared by pages and browser scripts (no astro:content imports here).

export const CATEGORY_PATH = { phone: 'phones', tablet: 'tablets' } as const;
export const CATEGORY_LABEL = { phone: 'Phones', tablet: 'Tablets' } as const;

export const fullName = (d: Pick<Device, 'brand' | 'name'>) =>
  d.name.toLowerCase().startsWith(d.brand.toLowerCase()) ? d.name : `${d.brand} ${d.name}`;
export const deviceUrl = (d: Pick<Device, 'category' | 'slug'>) => `/${CATEGORY_PATH[d.category]}/${d.slug}/`;
export const brandSlug = (brand: string) => brand.toLowerCase().replace(/[^a-z0-9]+/g, '-');
/** Compare pages use slugs in alphabetical order, so each pair has one canonical URL. */
export const compareSlug = (a: Pick<Device, 'slug'>, b: Pick<Device, 'slug'>) =>
  [a.slug, b.slug].sort().join('-vs-');

/** The file name and URL slug for a new device, e.g. "Samsung" + "Galaxy S27+" → "samsung-galaxy-s27-plus". */
export function slugFor(brand: string, name: string): string {
  const slugify = (s: string) =>
    s.toLowerCase().replace(/["″]/g, '').replace(/\+/g, '-plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return name.toLowerCase().startsWith(brand.toLowerCase()) ? slugify(name) : slugify(`${brand} ${name}`);
}
