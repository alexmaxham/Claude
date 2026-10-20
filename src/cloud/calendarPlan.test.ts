import { describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../core/store';
import type { Task } from '../core/types';
import { eventFor, planSync, type CalendarEvent } from './calendarPlan';

const NOW = new Date(2026, 9, 20, 12).getTime();

function tasks(): Task[] {
  let s = createInitialState();
  const add = (title: string, dueDate: string | null) =>
    (s = reduce(s, { type: 'addTask', title, categoryId: null, priority: 'medium', dueDate }, NOW).state);
  add('Dated', '2026-10-21');
  add('Undated', null);
  add('Done', '2026-10-22');
  s = reduce(s, { type: 'toggleTask', id: s.tasks[0].id }, NOW).state; // completes "Done"
  return s.tasks;
}

const tagged = (id: string, taskId: string, e: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  summary: 'x',
  description: '',
  start: { date: '2026-01-01' },
  end: { date: '2026-01-02' },
  extendedProperties: { private: { questlog: '1', taskId } },
  ...e,
});

describe('calendar sync plan', () => {
  it('makes an all-day event only for open tasks with a due date', () => {
    const [done, undated, dated] = tasks();
    expect(eventFor(done)).toBeNull();
    expect(eventFor(undated)).toBeNull();
    const e = eventFor(dated)!;
    expect(e.start.date).toBe('2026-10-21');
    expect(e.end.date).toBe('2026-10-22');
    expect(e.extendedProperties.private).toEqual({ questlog: '1', taskId: dated.id });
  });

  it('creates, updates, leaves alone and removes the right events', () => {
    const list = tasks();
    const [done, , dated] = list;
    const upToDate = eventFor(dated)!;
    expect(planSync(list, [{ ...upToDate, id: 'e1' }])).toEqual({ create: [], update: [], remove: [] });

    const stale = tagged('e1', dated.id);
    const plan = planSync(list, [stale, tagged('e2', done.id), tagged('e3', 'deleted-task'), tagged('e4', dated.id)]);
    expect(plan.create).toEqual([]);
    expect(plan.update.map((u) => u.id)).toEqual(['e1']);
    expect(plan.remove.sort()).toEqual(['e2', 'e3', 'e4']);

    expect(planSync(list, []).create.map((e) => e.summary)).toEqual(['Dated']);
  });
});
