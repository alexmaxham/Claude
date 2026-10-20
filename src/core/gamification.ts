import { addDays, dayKey } from './dates';
import type { AppState, Priority, Stats, Task } from './types';

export const BASE_XP: Record<Priority, number> = { low: 10, medium: 20, high: 35 };
export const ON_TIME_BONUS = 5;
export const GOAL_BONUS = 25;
const STREAK_STEP = 0.05;
const MAX_STREAK_STEPS = 10; // caps the multiplier at 1.5x

/** The streak as it should be shown today: it's broken if yesterday was missed. */
export function effectiveStreak(stats: Stats, now = Date.now()): number {
  if (!stats.lastActiveDay) return 0;
  const today = dayKey(now);
  if (stats.lastActiveDay === today || stats.lastActiveDay === addDays(today, -1)) {
    return stats.currentStreak;
  }
  return 0;
}

export function streakMultiplier(streak: number): number {
  return 1 + Math.min(streak, MAX_STREAK_STEPS) * STREAK_STEP;
}

/** Streak after completing something today. */
export function nextStreak(stats: Stats, now = Date.now()): number {
  const today = dayKey(now);
  if (stats.lastActiveDay === today) return stats.currentStreak;
  if (stats.lastActiveDay === addDays(today, -1)) return stats.currentStreak + 1;
  return 1;
}

export function xpForTask(task: Task, streak: number, now = Date.now()): number {
  let xp = BASE_XP[task.priority];
  if (task.dueDate && dayKey(now) <= task.dueDate) xp += ON_TIME_BONUS;
  return Math.round(xp * streakMultiplier(streak));
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return 50 + (level - 1) * 25;
}

export interface LevelInfo {
  level: number;
  intoLevel: number;
  needed: number;
  progress: number; // 0..1
  title: string;
}

// One rank per level so every level-up feels like a promotion.
const TITLES = [
  'Novice',
  'Apprentice',
  'Doer',
  'Go-Getter',
  'Achiever',
  'Finisher',
  'Taskmaster',
  'Productivity Pro',
  'Focus Ninja',
  'Momentum Machine',
  'Champion',
  'Grandmaster',
  'Legend',
  'Titan',
  'Mythic',
];

export function levelTitle(level: number): string {
  return TITLES[Math.min(level - 1, TITLES.length - 1)];
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let rest = Math.max(0, xp);
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  const needed = xpToNext(level);
  return { level, intoLevel: rest, needed, progress: rest / needed, title: levelTitle(level) };
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Checked after every state change; returns true once earned. */
  test: (state: AppState, ctx: { now: number; justCompleted?: Task }) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', name: 'First Step', description: 'Complete your first task', icon: '🌱',
    test: (s) => s.stats.totalCompleted >= 1 },
  { id: 'ten', name: 'On a Roll', description: 'Complete 10 tasks', icon: '🎯',
    test: (s) => s.stats.totalCompleted >= 10 },
  { id: 'fifty', name: 'Half Century', description: 'Complete 50 tasks', icon: '🏅',
    test: (s) => s.stats.totalCompleted >= 50 },
  { id: 'hundred', name: 'Centurion', description: 'Complete 100 tasks', icon: '🏆',
    test: (s) => s.stats.totalCompleted >= 100 },
  { id: 'streak3', name: 'Warming Up', description: 'Reach a 3-day streak', icon: '🔥',
    test: (s) => s.stats.bestStreak >= 3 },
  { id: 'streak7', name: 'Week Warrior', description: 'Reach a 7-day streak', icon: '⚡️',
    test: (s) => s.stats.bestStreak >= 7 },
  { id: 'streak30', name: 'Unstoppable', description: 'Reach a 30-day streak', icon: '🌋',
    test: (s) => s.stats.bestStreak >= 30 },
  { id: 'goal', name: 'Goal Getter', description: 'Hit your daily goal', icon: '🎉',
    test: (s) => s.stats.goalBonusDays.length >= 1 },
  { id: 'bigfish', name: 'Big Fish', description: 'Finish a high-priority task', icon: '🐋',
    test: (_s, c) => c.justCompleted?.priority === 'high' },
  { id: 'early', name: 'Early Bird', description: 'Complete a task before 8am', icon: '🌅',
    test: (_s, c) => !!c.justCompleted && new Date(c.now).getHours() < 8 },
  { id: 'owl', name: 'Night Owl', description: 'Complete a task after 10pm', icon: '🦉',
    test: (_s, c) => !!c.justCompleted && new Date(c.now).getHours() >= 22 },
  { id: 'clear', name: 'Clean Slate', description: 'Clear every open task', icon: '✨',
    test: (s, c) => !!c.justCompleted && s.tasks.length >= 3 && s.tasks.every((t) => t.completedAt) },
  { id: 'level5', name: 'Rising Star', description: 'Reach level 5', icon: '⭐️',
    test: (s) => levelFromXp(s.stats.xp).level >= 5 },
  { id: 'level10', name: 'Superstar', description: 'Reach level 10', icon: '🌟',
    test: (s) => levelFromXp(s.stats.xp).level >= 10 },
  { id: 'organizer', name: 'Organizer', description: 'Create your own category', icon: '🗂️',
    test: (s) => s.categories.some((c) => !c.id.startsWith('default-')) },
];
