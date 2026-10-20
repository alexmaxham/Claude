import type { APIRoute } from 'astro';
import { allDevices } from '../lib/devices';

// Every device's full data, for the compare page and anyone who wants the raw specs.
export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await allDevices()), { headers: { 'Content-Type': 'application/json' } });
