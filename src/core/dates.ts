/** Local-time day key, e.g. "2026-10-20". */
export function dayKey(time: number | Date = Date.now()): string {
  const d = new Date(time);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Whole days from day key `a` to day key `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86_400_000);
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/** Quick snooze targets: tomorrow, the coming Saturday and next Monday. */
export function snoozeOptions(today = dayKey()): { label: string; day: string }[] {
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return [
    { label: 'Tomorrow', day: addDays(today, 1) },
    { label: dow === 6 || dow === 0 ? 'Next weekend' : 'This weekend', day: addDays(today, (6 - dow + 7) % 7 || 7) },
    { label: 'Next week', day: addDays(today, (8 - dow) % 7 || 7) },
  ];
}
