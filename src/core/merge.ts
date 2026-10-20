import type { AppState, Stats } from './types';

/** True if the state has nothing worth keeping (fresh install, never used). */
export function isPristine(state: AppState): boolean {
  return state.tasks.length === 0 && state.stats.xp === 0 && state.stats.totalCompleted === 0;
}

/**
 * Combine two independent histories, e.g. guest progress made before signing
 * in with an account that already has data. Tasks and categories are unioned by
 * id; earned XP and completions are added together, streaks keep the best.
 */
export function mergeStates(account: AppState, guest: AppState): AppState {
  if (isPristine(guest)) return account;
  if (isPristine(account)) return guest;

  const taskIds = new Set(account.tasks.map((t) => t.id));
  const catIds = new Set(account.categories.map((c) => c.id));
  const catNames = new Map(account.categories.map((c) => [c.name.trim().toLowerCase(), c.id]));

  // Guest categories with the same name as an account category fold into it.
  const remap = new Map<string, string>();
  const extraCategories = guest.categories.filter((c) => {
    if (catIds.has(c.id)) return false;
    const same = catNames.get(c.name.trim().toLowerCase());
    if (same) {
      remap.set(c.id, same);
      return false;
    }
    return true;
  });

  const extraTasks = guest.tasks
    .filter((t) => !taskIds.has(t.id))
    .map((t) => (t.categoryId && remap.has(t.categoryId) ? { ...t, categoryId: remap.get(t.categoryId)! } : t));

  return {
    ...account,
    tasks: [...extraTasks, ...account.tasks],
    categories: [...account.categories, ...extraCategories],
    stats: mergeStats(account.stats, guest.stats),
  };
}

function mergeStats(a: Stats, b: Stats): Stats {
  const completionsByDay = { ...a.completionsByDay };
  for (const [day, n] of Object.entries(b.completionsByDay)) {
    completionsByDay[day] = (completionsByDay[day] ?? 0) + n;
  }
  const aDay = a.lastActiveDay ?? '';
  const bDay = b.lastActiveDay ?? '';
  // The current streak belongs to whichever history was active most recently.
  const recent = bDay > aDay ? b : a;

  const achievements = { ...b.achievements };
  for (const [id, at] of Object.entries(a.achievements)) {
    achievements[id] = Math.min(at, achievements[id] ?? Infinity);
  }

  return {
    xp: a.xp + b.xp,
    totalCompleted: a.totalCompleted + b.totalCompleted,
    currentStreak: aDay === bDay ? Math.max(a.currentStreak, b.currentStreak) : recent.currentStreak,
    bestStreak: Math.max(a.bestStreak, b.bestStreak),
    lastActiveDay: recent.lastActiveDay,
    dailyGoal: a.dailyGoal,
    goalBonusDays: [...new Set([...a.goalBonusDays, ...b.goalBonusDays])].sort(),
    completionsByDay,
    achievements,
  };
}
