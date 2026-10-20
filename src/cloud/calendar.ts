import type { Task } from '../core/types';
import { planSync, type CalendarEvent } from './calendarPlan';

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export class CalendarError extends Error {
  constructor(
    message: string,
    readonly kind: 'notEnabled' | 'auth' | 'other',
  ) {
    super(message);
  }
}

async function call<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  });
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
  if (res.status === 410 || (res.status === 404 && init?.method === 'DELETE')) return undefined as T; // already gone
  const body = await res.json().catch(() => ({}));
  const reason: string = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? '';
  const message: string = body?.error?.message ?? `Google Calendar returned ${res.status}`;
  if (reason === 'accessNotConfigured' || /has not been used|is disabled/.test(message)) {
    throw new CalendarError('The Google Calendar API isn’t enabled for this Firebase project yet.', 'notEnabled');
  }
  if (res.status === 401 || res.status === 403) throw new CalendarError(message, 'auth');
  throw new CalendarError(message, 'other');
}

async function listOurEvents(token: string): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken = '';
  do {
    const q = new URLSearchParams({ privateExtendedProperty: 'questlog=1', maxResults: '2500', showDeleted: 'false' });
    if (pageToken) q.set('pageToken', pageToken);
    const page = await call<{ items?: CalendarEvent[]; nextPageToken?: string }>(token, `${BASE}?${q}`);
    events.push(...(page.items ?? []));
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return events;
}

/** Runs `jobs` a few at a time so a big first sync doesn't hit Google's rate limits. */
async function runLimited(jobs: (() => Promise<unknown>)[], limit = 4) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, jobs.length) }, async () => {
      while (next < jobs.length) await jobs[next++]();
    }),
  );
}

export interface SyncResult {
  created: number;
  updated: number;
  removed: number;
}

/** Makes the user's primary Google Calendar match their open, dated tasks. */
export async function syncCalendar(token: string, tasks: Task[]): Promise<SyncResult> {
  const plan = planSync(tasks, await listOurEvents(token));
  await runLimited([
    ...plan.create.map((e) => () => call(token, BASE, { method: 'POST', body: JSON.stringify(e) })),
    ...plan.update.map(({ id, event }) => () => call(token, `${BASE}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(event) })),
    ...plan.remove.map((id) => () => call(token, `${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })),
  ]);
  return { created: plan.create.length, updated: plan.update.length, removed: plan.remove.length };
}
