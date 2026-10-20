import { addDays, dayKey } from './dates';
import { ACHIEVEMENTS, levelFromXp } from './gamification';
import type { AppState } from './types';

export interface YearReview {
  year: number;
  completed: number;
  activeDays: number;
  longestStreak: number;
  bestDay: { day: string; count: number } | null;
  /** 0 (Sunday) – 6, the weekday with the most completions. */
  busiestWeekday: number | null;
  /** Completions per month, January first. */
  months: number[];
  topCategory: { name: string; emoji: string; count: number } | null;
  /** XP from the quests finished this year that are still in the list. */
  xp: number;
  bosses: number;
  trophies: { name: string; icon: string }[];
  level: number;
}

/** A year at a glance, from the completion history (which outlives cleared tasks). */
export function yearReview(state: AppState, year = new Date().getFullYear()): YearReview {
  const prefix = `${year}-`;
  const days = Object.entries(state.stats.completionsByDay).filter(([d, n]) => d.startsWith(prefix) && n > 0);
  const months = Array(12).fill(0);
  const weekdays = Array(7).fill(0);
  let bestDay: YearReview['bestDay'] = null;
  for (const [d, n] of days) {
    const [y, m, dd] = d.split('-').map(Number);
    months[m - 1] += n;
    weekdays[new Date(y, m - 1, dd).getDay()] += n;
    if (!bestDay || n > bestDay.count) bestDay = { day: d, count: n };
  }

  // Longest run of consecutive active days inside the year.
  const active = new Set(days.map(([d]) => d));
  let longestStreak = 0;
  for (const d of active) {
    if (active.has(addDays(d, -1))) continue;
    let run = 1;
    while (active.has(addDays(d, run))) run++;
    longestStreak = Math.max(longestStreak, run);
  }

  const doneThisYear = state.tasks.filter((t) => t.completedAt && dayKey(t.completedAt).startsWith(prefix));
  const perCategory = new Map<string, number>();
  for (const t of doneThisYear) if (t.categoryId) perCategory.set(t.categoryId, (perCategory.get(t.categoryId) ?? 0) + 1);
  const [topId, topCount] = [...perCategory.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const topCat = state.categories.find((c) => c.id === topId);

  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const completed = days.reduce((sum, [, n]) => sum + n, 0);

  return {
    year,
    completed,
    activeDays: days.length,
    longestStreak,
    bestDay,
    busiestWeekday: completed ? weekdays.indexOf(Math.max(...weekdays)) : null,
    months,
    topCategory: topCat ? { name: topCat.name, emoji: topCat.emoji, count: topCount! } : null,
    xp: doneThisYear.reduce((sum, t) => sum + t.xpAwarded, 0),
    bosses: doneThisYear.filter((t) => t.boss).length,
    trophies: ACHIEVEMENTS.filter((a) => {
      const at = state.stats.achievements[a.id];
      return at >= start && at < end;
    }).map((a) => ({ name: a.name, icon: a.icon })),
    level: levelFromXp(state.stats.xp).level,
  };
}

/** A few lines to paste into a message or post. */
export function reviewText(r: YearReview): string {
  const weekday = r.busiestWeekday === null ? null : new Date(2026, 0, 4 + r.busiestWeekday).toLocaleDateString(undefined, { weekday: 'long' });
  return [
    `My ${r.year} in Tasko ✨`,
    `✅ ${r.completed.toLocaleString()} quests done on ${r.activeDays} days`,
    `🔥 Longest streak: ${r.longestStreak} day${r.longestStreak === 1 ? '' : 's'}`,
    r.bestDay && `🚀 Best day: ${r.bestDay.count} quests`,
    weekday && `📅 Busiest day: ${weekday}s`,
    r.topCategory && `${r.topCategory.emoji} Top category: ${r.topCategory.name}`,
    r.bosses > 0 && `⚔️ ${r.bosses} boss${r.bosses === 1 ? '' : 'es'} defeated`,
    `🏆 ${r.trophies.length} trophies · Level ${r.level}`,
  ]
    .filter(Boolean)
    .join('\n');
}
