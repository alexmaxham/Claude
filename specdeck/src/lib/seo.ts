import type { Crumb } from '../components/Breadcrumbs.astro';

export function breadcrumbLd(items: Crumb[], site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: new URL(c.href, site).href } : {}),
    })),
  };
}
