import { addDays, dayKey } from './dates';
import type { Repeat } from './types';

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKENDS = [0, 6];

function weekday(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function sameDays(days: number[], set: number[]): boolean {
  return [...days].sort().join() === [...set].sort().join();
}

/** The date `months` months after `from`'s month, on day `dom` (clamped to the month's length). */
function monthDay(from: string, months: number, dom: number): string {
  const [y, m] = from.split('-').map(Number);
  const lastDay = new Date(y, m - 1 + months + 1, 0).getDate();
  return dayKey(new Date(y, m - 1 + months, Math.min(dom, lastDay)));
}

/**
 * Due date of the next occurrence of a repeating task completed on `today`.
 * It always lands after both today and the current due date, so finishing late
 * doesn't create an occurrence that's already overdue.
 */
export function nextDueDate(repeat: Repeat, due: string | null, today: string): string {
  const base = due && due > today ? due : today;
  const anchor = due ?? today;
  switch (repeat.kind) {
    case 'daily':
      return addDays(base, Math.max(1, repeat.interval ?? 1));
    case 'weekly': {
      const every = Math.max(1, repeat.interval ?? 1);
      const days = (repeat.days.length ? [...repeat.days] : [weekday(anchor)]).sort();
      // Later in the same (Sunday-start) week, if one of the days is still to come…
      const laterThisWeek = days.find((d) => d > weekday(base));
      if (laterThisWeek !== undefined) return addDays(base, laterThisWeek - weekday(base));
      // …otherwise the first chosen day of the week `every` weeks on.
      const weekStart = addDays(base, -weekday(base));
      return addDays(weekStart, every * 7 + days[0]);
    }
    case 'monthly': {
      const every = Math.max(1, repeat.interval ?? 1);
      const dom = Number(anchor.slice(8, 10));
      for (let months = 0; months <= every + 1; months += months === 0 ? every : 1) {
        const candidate = monthDay(base, months, dom);
        if (candidate > base) return candidate;
      }
      return addDays(base, 30 * every);
    }
    case 'yearly': {
      const [, m, d] = anchor.split('-').map(Number);
      const year = Number(base.slice(0, 4));
      for (const y of [year, year + 1]) {
        const lastDay = new Date(y, m, 0).getDate();
        const candidate = dayKey(new Date(y, m - 1, Math.min(d, lastDay)));
        if (candidate > base) return candidate;
      }
      return addDays(base, 365);
    }
  }
}

const plural = (n: number, unit: string) => (n === 1 ? unit : `${n} ${unit}s`);

export function repeatLabel(repeat: Repeat): string {
  switch (repeat.kind) {
    case 'daily': {
      const n = repeat.interval ?? 1;
      return n === 1 ? 'Every day' : `Every ${plural(n, 'day')}`;
    }
    case 'weekly': {
      const n = repeat.interval ?? 1;
      const days = [...repeat.days].sort();
      if (n === 1 && sameDays(days, WEEKDAYS)) return 'Weekdays';
      if (n === 1 && sameDays(days, WEEKENDS)) return 'Weekends';
      if (n === 1 && days.length === 7) return 'Every day';
      const on = days.length ? ` on ${days.map((d) => DAY_NAMES[d]).join(', ')}` : '';
      return `${n === 1 ? 'Weekly' : `Every ${plural(n, 'week')}`}${on}`;
    }
    case 'monthly': {
      const n = repeat.interval ?? 1;
      return n === 1 ? 'Monthly' : `Every ${plural(n, 'month')}`;
    }
    case 'yearly':
      return 'Yearly';
  }
}

export type RepeatPreset = 'none' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly' | 'custom';

/** Which picker option a schedule corresponds to; anything with an interval is "custom". */
export function repeatPreset(repeat: Repeat | null | undefined): RepeatPreset {
  if (!repeat) return 'none';
  if (repeat.kind === 'yearly') return 'yearly';
  if ((repeat.interval ?? 1) > 1) return 'custom';
  if (repeat.kind === 'weekly') {
    if (sameDays(repeat.days, WEEKDAYS)) return 'weekdays';
    if (sameDays(repeat.days, WEEKENDS)) return 'weekends';
    return 'weekly';
  }
  return repeat.kind;
}
