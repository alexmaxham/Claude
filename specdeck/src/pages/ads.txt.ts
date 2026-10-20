import type { APIRoute } from 'astro';
import { ADSENSE, adsEnabled } from '../lib/ads';

// Authorizes Google to sell ads on this site (required by AdSense). Empty until a publisher ID is set.
export const GET: APIRoute = () =>
  new Response(
    adsEnabled() ? `google.com, ${ADSENSE.client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n` : '',
    { headers: { 'Content-Type': 'text/plain' } },
  );
