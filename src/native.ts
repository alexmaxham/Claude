// The iPhone app (Capacitor) runs this same web app in a WKWebView. This module is
// the only place that talks to native plugins; on the web every function is a no-op
// or falls back to the browser API, so the rest of the app doesn't need to care.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { addDays, dayKey } from './core/dates';
import type { Task } from './core/types';

export const isNative = Capacitor.isNativePlatform();

/** Every key the app stores starts with this (the app's original name). */
const KEY_PREFIX = 'questlog:';

/**
 * iOS may clear a web view's localStorage when the device is low on space, so the
 * app keeps a copy of its keys in native storage (UserDefaults) and restores any
 * that went missing before the first render. Writes go to both.
 */
export async function setUpDurableStorage(): Promise<void> {
  if (!isNative) return;
  try {
    const { keys } = await Preferences.keys();
    for (const key of keys) {
      if (!key.startsWith(KEY_PREFIX) || localStorage.getItem(key) !== null) continue;
      const { value } = await Preferences.get({ key });
      if (value !== null) localStorage.setItem(key, value);
    }
  } catch {
    // Native storage unavailable; carry on with localStorage alone.
  }
  const { setItem, removeItem } = Storage.prototype;
  Storage.prototype.setItem = function (key: string, value: string) {
    setItem.call(this, key, value);
    if (this === localStorage && key.startsWith(KEY_PREFIX)) void Preferences.set({ key, value }).catch(() => {});
  };
  Storage.prototype.removeItem = function (key: string) {
    removeItem.call(this, key);
    if (this === localStorage && key.startsWith(KEY_PREFIX)) void Preferences.remove({ key }).catch(() => {});
  };
}

/** Hides the launch screen once the app has painted. */
export function hideSplash() {
  if (isNative) requestAnimationFrame(() => void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {}));
}

/** Light text on the dark appearance, dark text on the light one. */
export function setStatusBar(light: boolean) {
  if (isNative) void StatusBar.setStyle({ style: light ? Style.Light : Style.Dark }).catch(() => {});
}

/**
 * Taptic Engine feedback. Takes the same vibration patterns the web uses: a long
 * pattern (level up) is a success notification, a short tap a light or medium impact.
 */
export function nativeHaptic(pattern: number | number[]) {
  const run = Array.isArray(pattern)
    ? Haptics.notification({ type: NotificationType.Success })
    : Haptics.impact({ style: pattern >= 15 ? ImpactStyle.Medium : ImpactStyle.Light });
  void run.catch(() => {});
}

export async function requestNativeNotifications(): Promise<boolean> {
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return true;
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  } catch {
    return false;
  }
}

/** Notification ids 1000–1006, one per day of the coming week. */
const REMINDER_IDS = Array.from({ length: 7 }, (_, i) => 1000 + i);

/**
 * Schedules the daily reminder for the next seven days as real iOS notifications,
 * so they arrive even when Tasko is closed. Each lists what will be due that day
 * as things stand now; it's rescheduled whenever tasks change or the app opens.
 */
export async function scheduleNativeReminders(tasks: Task[], enabled: boolean, time: string): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: REMINDER_IDS.map((id) => ({ id })) });
    if (!enabled || (await LocalNotifications.checkPermissions()).display !== 'granted') return;
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const notifications = [];
    for (let i = 0; i < REMINDER_IDS.length; i++) {
      const key = addDays(dayKey(now), i);
      const [y, m, d] = key.split('-').map(Number);
      const at = new Date(y, m - 1, d, hours, minutes);
      if (at <= now) continue;
      const due = tasks.filter((t) => !t.completedAt && t.dueDate && t.dueDate <= key);
      if (!due.length) continue;
      const names = due.slice(0, 3).map((t) => t.title).join(', ');
      notifications.push({
        id: REMINDER_IDS[i],
        title: `${due.length} quest${due.length === 1 ? '' : 's'} due today`,
        body: due.length > 3 ? `${names} and ${due.length - 3} more` : names,
        schedule: { at, allowWhileIdle: true },
        threadIdentifier: 'tasko-daily',
      });
    }
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch {
    // Notifications unavailable; reminders are best-effort.
  }
}
