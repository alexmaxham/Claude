import type { APIRoute } from 'astro';
import { ADS, adsLive } from '../lib/ads';

// Google requires ads.txt at the root of your domain. On GitHub Pages' project URL
// (alexmaxham.github.io/Claude/) this file isn't at the domain root, so it only takes effect once the
// site is on its own domain (build with BASE_PATH=/).
export const GET: APIRoute = () => {
  const body = adsLive() ? `google.com, ${ADS.adsenseClient.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n` : '# Ads are not enabled yet.\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
