import { useEffect, useRef } from 'react';
import { dayKey } from './core/dates';
import type { Task } from './core/types';
import { isNative, requestNativeNotifications, scheduleNativeReminders } from './native';

const LAST_KEY = 'questlog:lastReminder';

export function notificationsSupported(): boolean {
  return isNative || (typeof window !== 'undefined' && 'Notification' in window);
}

/** Asks for permission to show notifications; true once they're allowed. */
export async function requestNotifications(): Promise<boolean> {
  if (isNative) return requestNativeNotifications();
  return (Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()) === 'granted';
}

/**
 * Once a day, at or after `time` (HH:MM, local), shows a browser notification
 * listing quests due today or overdue. On the web this runs only while the app is
 * open in a tab; there's no server to push notifications when it's closed. The
 * iPhone app schedules real local notifications instead.
 */
export function useReminders(tasks: Task[], enabled: boolean, time: string) {
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    if (!isNative) return;
    // Debounced, since tasks change on every edit.
    const id = setTimeout(() => void scheduleNativeReminders(tasks, enabled, time), 1000);
    return () => clearTimeout(id);
  }, [tasks, enabled, time]);

  useEffect(() => {
    if (isNative || !enabled || !notificationsSupported()) return;
    const check = () => {
      if (Notification.permission !== 'granted') return;
      const now = new Date();
      const today = dayKey(now);
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      let last: string | null = null;
      try {
        last = localStorage.getItem(LAST_KEY);
      } catch {
        // ignore
      }
      if (hhmm < time || last === today) return;
      const due = tasksRef.current.filter((t) => !t.completedAt && t.dueDate && t.dueDate <= today);
      try {
        localStorage.setItem(LAST_KEY, today);
      } catch {
        // ignore
      }
      if (!due.length) return;
      const names = due.slice(0, 3).map((t) => t.title).join(', ');
      new Notification(`${due.length} quest${due.length === 1 ? '' : 's'} due today`, {
        body: due.length > 3 ? `${names} and ${due.length - 3} more` : names,
        icon: 'icon.svg',
        tag: 'tasko-daily',
      });
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [enabled, time]);
}
