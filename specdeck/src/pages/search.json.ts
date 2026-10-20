import type { APIRoute } from 'astro';
import { allDevices } from '../lib/devices';
import { SECTIONS } from '../lib/specs';

// Every spec value as [label, value] per device, for matching searches like "IP68" or "Wi-Fi 7".
// Loaded by the search box the first time someone types.
export const GET: APIRoute = async () => {
  const index = (await allDevices()).map((d) => ({
    slug: d.slug,
    specs: SECTIONS.flatMap((s) => s.rows.map((r) => [r.label, r.value(d)] as const)).filter(
      (x): x is readonly [string, string] => x[1] !== null,
    ),
  }));
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } });
};
