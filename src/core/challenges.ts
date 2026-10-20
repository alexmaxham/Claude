import { addDays, dayKey } from './dates';
import type { Category, Challenge, ChallengeKind, Stats, WeekProgress } from './types';

/** Day key of the Monday that starts the week containing `now`. */
export function weekKey(now = Date.now()): string {
  const today = dayKey(now);
  const dow = new Date(now).getDay(); // 0 = Sunday
  return addDays(today, -((dow + 6) % 7));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Three challenges for a week: always a completion count, plus two others picked by the week. */
export function generateChallenges(key: string, categories: Category[]): Challenge[] {
  const h = hash(key);
  const sizes = [
    { target: 10, reward: 40 },
    { target: 15, reward: 60 },
    { target: 20, reward: 80 },
  ];
  const main: Challenge = { id: `${key}:complete`, kind: 'complete', ...sizes[h % sizes.length] };

  const pool: Challenge[] = [
    { id: `${key}:high`, kind: 'high', target: 3, reward: 50 },
    { id: `${key}:onTime`, kind: 'onTime', target: 5, reward: 50 },
    { id: `${key}:goalDays`, kind: 'goalDays', target: 3, reward: 60 },
  ];
  if (categories.length) {
    const cat = categories[(h >>> 8) % categories.length];
    pool.push({ id: `${key}:category`, kind: 'category', target: 5, categoryId: cat.id, reward: 50 });
  }
  const first = (h >>> 4) % pool.length;
  const second = (first + 1 + ((h >>> 12) % (pool.length - 1))) % pool.length;
  return [main, pool[first], pool[second]];
}

export function freshWeek(key: string, categories: Category[]): WeekProgress {
  return {
    key,
    challenges: generateChallenges(key, categories),
    completed: 0,
    high: 0,
    onTime: 0,
    goalDays: 0,
    byCategory: {},
    claimed: [],
  };
}

/** The current week's progress, starting a new week if the stored one is old. */
export function currentWeek(stats: Stats, categories: Category[], now = Date.now()): WeekProgress {
  const key = weekKey(now);
  return stats.week?.key === key ? stats.week : freshWeek(key, categories);
}

export function challengeProgress(week: WeekProgress, c: Challenge): number {
  const n: Record<ChallengeKind, number> = {
    complete: week.completed,
    high: week.high,
    onTime: week.onTime,
    goalDays: week.goalDays,
    category: week.byCategory[c.categoryId ?? ''] ?? 0,
  };
  return Math.min(n[c.kind], c.target);
}

export function describeChallenge(c: Challenge, categories: Category[]): { icon: string; text: string } {
  switch (c.kind) {
    case 'complete':
      return { icon: '📜', text: `Complete ${c.target} quests` };
    case 'high':
      return { icon: '‼️', text: `Finish ${c.target} high-priority quests` };
    case 'onTime':
      return { icon: '⏰', text: `Finish ${c.target} quests on or before their due date` };
    case 'goalDays':
      return { icon: '🎯', text: `Hit your daily goal on ${c.target} days` };
    case 'category': {
      const cat = categories.find((x) => x.id === c.categoryId);
      return cat
        ? { icon: cat.emoji, text: `Complete ${c.target} quests in ${cat.name}` }
        : { icon: '🗂️', text: `Complete ${c.target} quests in a deleted category` };
    }
  }
}
