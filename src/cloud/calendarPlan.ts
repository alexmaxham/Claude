import { addDays } from '../core/dates';
import { repeatLabel } from '../core/recurrence';
import type { Task } from '../core/types';

/** The parts of a Google Calendar event that sync reads and writes. */
export interface CalendarEvent {
  id?: string;
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
  extendedProperties: { private: { questlog: '1'; taskId: string } };
}

export interface SyncPlan {
  create: CalendarEvent[];
  update: { id: string; event: CalendarEvent }[];
  remove: string[]; // event ids
}

/** The all-day event a task should have, or null if it shouldn't be on the calendar. */
export function eventFor(task: Task): CalendarEvent | null {
  if (task.completedAt || !task.dueDate) return null;
  const lines = [
    task.description,
    task.subtasks?.length ? task.subtasks.map((s) => `${s.done ? '☑' : '☐'} ${s.title}`).join('\n') : '',
    task.repeat ? `Repeats: ${repeatLabel(task.repeat)}` : '',
    'Added by Questlog',
  ].filter(Boolean);
  return {
    summary: task.title,
    description: lines.join('\n\n'),
    start: { date: task.dueDate },
    end: { date: addDays(task.dueDate, 1) }, // all-day events end on the following day
    extendedProperties: { private: { questlog: '1', taskId: task.id } },
  };
}

function same(a: CalendarEvent, b: CalendarEvent): boolean {
  return a.summary === b.summary && (a.description ?? '') === b.description && a.start.date === b.start.date && a.end.date === b.end.date;
}

/**
 * What to change so the calendar matches the task list: one all-day event per open
 * task with a due date. Only events Questlog created (tagged `questlog=1`) are ever
 * touched; duplicates for the same task are removed.
 */
export function planSync(tasks: Task[], existing: CalendarEvent[]): SyncPlan {
  const plan: SyncPlan = { create: [], update: [], remove: [] };
  const byTask = new Map<string, CalendarEvent>();
  for (const e of existing) {
    const taskId = e.extendedProperties?.private?.taskId;
    if (!e.id) continue;
    if (!taskId || byTask.has(taskId)) plan.remove.push(e.id);
    else byTask.set(taskId, e);
  }
  for (const t of tasks) {
    const want = eventFor(t);
    const have = byTask.get(t.id);
    byTask.delete(t.id);
    if (want && !have) plan.create.push(want);
    else if (want && have && !same(want, have)) plan.update.push({ id: have.id!, event: want });
    else if (!want && have) plan.remove.push(have.id!);
  }
  // Events for tasks that no longer exist.
  for (const e of byTask.values()) plan.remove.push(e.id!);
  return plan;
}
