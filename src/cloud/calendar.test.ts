import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, reduce } from '../core/store';
import { CalendarError, syncCalendar } from './calendar';
import { eventFor } from './calendarPlan';

const NOW = new Date(2026, 9, 20, 12).getTime();

afterEach(() => vi.unstubAllGlobals());

describe('syncCalendar', () => {
  it('lists our events, then creates, updates and deletes through the API', async () => {
    let s = createInitialState();
    for (const [title, due] of [['New', '2026-10-21'], ['Changed', '2026-10-22']] as const) {
      s = reduce(s, { type: 'addTask', title, categoryId: null, priority: 'low', dueDate: due }, NOW).state;
    }
    const changed = s.tasks.find((t) => t.title === 'Changed')!;
    const existing = [
      { ...eventFor(changed)!, id: 'keep', summary: 'Old title' },
      { ...eventFor(changed)!, id: 'gone', extendedProperties: { private: { questlog: '1', taskId: 'deleted' } } },
    ];
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url.split('/events')[1].split('?')[0] || '/'}`);
      if (!init?.method) return new Response(JSON.stringify({ items: existing }), { status: 200 });
      return init.method === 'DELETE' ? new Response(null, { status: 204 }) : new Response('{}', { status: 200 });
    }));

    const result = await syncCalendar('token', s.tasks);
    expect(result).toEqual({ created: 1, updated: 1, removed: 1 });
    expect(calls.sort()).toEqual(['DELETE /gone', 'GET /', 'PATCH /keep', 'POST /']);
  });

  it('explains when the Calendar API is not enabled for the project', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: 'Google Calendar API has not been used in project 123 before or it is disabled.', errors: [{ reason: 'accessNotConfigured' }] } }), { status: 403 }),
    ));
    const err = await syncCalendar('token', []).catch((e) => e);
    expect(err).toBeInstanceOf(CalendarError);
    expect(err.kind).toBe('notEnabled');
  });
});
