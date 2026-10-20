import { addDays, dayKey } from './dates';
import type { Repeat } from './types';

function weekday(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * Due date of the next occurrence of a repeating task completed on `today`.
 * It always lands after both today and the current due date, so finishing late
 * doesn't create an occurrence that's already overdue.
 */
export function nextDueDate(repeat: Repeat, due: string | null, today: string): string {
  const base = due && due > today ? due : today;
  switch (repeat.kind) {
    case 'daily':
      return addDays(base, 1);
    case 'weekly': {
      const days = repeat.days.length ? repeat.days : [weekday(due ?? today)];
      for (let i = 1; i <= 7; i++) {
        const d = addDays(base, i);
        if (days.includes(weekday(d))) return d;
      }
      return addDays(base, 7);
    }
    case 'monthly': {
      const dom = Number((due ?? today).slice(8, 10));
      const [y, m] = base.split('-').map(Number);
      for (let i = 0; i <= 2; i++) {
        const lastDay = new Date(y, m + i, 0).getDate(); // m is 1-based, so this is month m + i
        const candidate = dayKey(new Date(y, m - 1 + i, Math.min(dom, lastDay)));
        if (candidate > base) return candidate;
      }
      return addDays(base, 30);
    }
  }
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function repeatLabel(repeat: Repeat): string {
  switch (repeat.kind) {
    case 'daily':
      return 'Daily';
    case 'monthly':
      return 'Monthly';
    case 'weekly': {
      const days = [...repeat.days].sort();
      if (days.join() === '1,2,3,4,5') return 'Weekdays';
      if (days.length === 7) return 'Daily';
      return days.length ? days.map((d) => DAY_NAMES[d]).join(', ') : 'Weekly';
    }
  }
}

export { DAY_NAMES };
