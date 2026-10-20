import { addDays, dayKey } from './dates';
import type { AppState, Priority, Stats, Task } from './types';

export const BASE_XP: Record<Priority, number> = { low: 10, medium: 20, high: 35 };
export const ON_TIME_BONUS = 5;
export const GOAL_BONUS = 25;
/** Extra XP per checked-off subtask when the task is completed. */
export const SUBTASK_BONUS = 3;
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
  xp += (task.subtasks?.filter((s) => s.done).length ?? 0) * SUBTASK_BONUS;
  return Math.round(xp * streakMultiplier(streak));
}

/** The highest level for now; more can be added later by extending TITLES and raising this. */
export const MAX_LEVEL = 100;

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
  /** True at MAX_LEVEL: XP keeps counting but there's no next level yet. */
  max: boolean;
}

// One rank per level so every level-up feels like a promotion. Index 0 is level 1.
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
  'Trailblazer',
  'Pathfinder',
  'Wayfarer',
  'Ranger',
  'Scout',
  'Vanguard',
  'Sentinel',
  'Guardian',
  'Warden',
  'Knight',
  'Paladin',
  'Crusader',
  'Templar',
  'Commander',
  'Captain',
  'Marshal',
  'Warlord',
  'Conqueror',
  'Vanquisher',
  'Gladiator',
  'Hero',
  'Paragon',
  'Exemplar',
  'Virtuoso',
  'Maestro',
  'Sage',
  'Oracle',
  'Mystic',
  'Seer',
  'Archmage',
  'Sorcerer',
  'Enchanter',
  'Alchemist',
  'Artificer',
  'Inventor',
  'Architect',
  'Builder',
  'Forgemaster',
  'Smith of Days',
  'Keeper of Lists',
  'Time Bender',
  'Clock Tamer',
  'Deadline Slayer',
  'Backlog Breaker',
  'Inbox Zero',
  'Flow Rider',
  'Deep Worker',
  'Zen Doer',
  'Unshakeable',
  'Relentless',
  'Indomitable',
  'Juggernaut',
  'Colossus',
  'Behemoth',
  'Leviathan',
  'Phoenix',
  'Dragonheart',
  'Stormbringer',
  'Thunderborn',
  'Starforged',
  'Comet',
  'Supernova',
  'Pulsar',
  'Quasar',
  'Nebula',
  'Galaxy Brain',
  'Cosmic',
  'Celestial',
  'Astral',
  'Ethereal',
  'Eternal',
  'Immortal',
  'Demigod',
  'Ascendant',
  'Transcendent',
  'Luminary',
  'Radiant',
  'Sovereign',
  'Emperor',
  'Overlord',
  'Archon',
  'Paramount',
  'Apex',
  'Pinnacle',
  'Questlord',
];

export function levelTitle(level: number): string {
  return TITLES[Math.min(level - 1, TITLES.length - 1)];
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let rest = Math.max(0, xp);
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  if (level === MAX_LEVEL) return { level, intoLevel: rest, needed: rest, progress: 1, title: levelTitle(level), max: true };
  const needed = xpToNext(level);
  return { level, intoLevel: rest, needed, progress: rest / needed, title: levelTitle(level), max: false };
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
  { id: 'level20', name: 'Seasoned', description: 'Reach level 20', icon: '🎖️',
    test: (s) => levelFromXp(s.stats.xp).level >= 20 },
  { id: 'level30', name: 'Elite', description: 'Reach level 30', icon: '💎',
    test: (s) => levelFromXp(s.stats.xp).level >= 30 },
  { id: 'level50', name: 'Halfway Hero', description: 'Reach level 50', icon: '🗻',
    test: (s) => levelFromXp(s.stats.xp).level >= 50 },
  { id: 'level75', name: 'Living Legend', description: 'Reach level 75', icon: '🌠',
    test: (s) => levelFromXp(s.stats.xp).level >= 75 },
  { id: 'level100', name: 'Questlord', description: 'Reach level 100', icon: '👑',
    test: (s) => levelFromXp(s.stats.xp).level >= MAX_LEVEL },
  { id: 'c250', name: 'Veteran', description: 'Complete 250 tasks', icon: '🛡️',
    test: (s) => s.stats.totalCompleted >= 250 },
  { id: 'c500', name: 'Quest Machine', description: 'Complete 500 tasks', icon: '⚙️',
    test: (s) => s.stats.totalCompleted >= 500 },
  { id: 'c1000', name: 'Thousand Quests', description: 'Complete 1,000 tasks', icon: '🏛️',
    test: (s) => s.stats.totalCompleted >= 1000 },
  { id: 'streak14', name: 'Fortnight Force', description: 'Reach a 14-day streak', icon: '💥',
    test: (s) => s.stats.bestStreak >= 14 },
  { id: 'streak60', name: 'Iron Will', description: 'Reach a 60-day streak', icon: '🦾',
    test: (s) => s.stats.bestStreak >= 60 },
  { id: 'streak100', name: 'Century Streak', description: 'Reach a 100-day streak', icon: '💯',
    test: (s) => s.stats.bestStreak >= 100 },
  { id: 'streak365', name: 'Year of Quests', description: 'Reach a 365-day streak', icon: '🗓️',
    test: (s) => s.stats.bestStreak >= 365 },
  { id: 'goal7', name: 'Goal Streaker', description: 'Hit your daily goal on 7 days', icon: '🏹',
    test: (s) => s.stats.goalBonusDays.length >= 7 },
  { id: 'goal30', name: 'Goal Machine', description: 'Hit your daily goal on 30 days', icon: '🎰',
    test: (s) => s.stats.goalBonusDays.length >= 30 },
  { id: 'day5', name: 'High Five', description: 'Complete 5 tasks in one day', icon: '🖐️',
    test: (s) => Object.values(s.stats.completionsByDay).some((n) => n >= 5) },
  { id: 'day10', name: 'Overachiever', description: 'Complete 10 tasks in one day', icon: '🚀',
    test: (s) => Object.values(s.stats.completionsByDay).some((n) => n >= 10) },
  { id: 'high10', name: 'Heavy Lifter', description: 'Finish 10 high-priority tasks', icon: '🏋️',
    test: (s) => s.stats.highCompleted >= 10 },
  { id: 'high50', name: 'Boss Slayer', description: 'Finish 50 high-priority tasks', icon: '🐉',
    test: (s) => s.stats.highCompleted >= 50 },
  { id: 'ontime25', name: 'Punctual', description: 'Finish 25 tasks on or before their due date', icon: '⏰',
    test: (s) => s.stats.onTimeCompleted >= 25 },
  { id: 'ontime100', name: 'Clockwork', description: 'Finish 100 tasks on time', icon: '🕰️',
    test: (s) => s.stats.onTimeCompleted >= 100 },
  { id: 'steps3', name: 'Step by Step', description: 'Complete a task with 3+ steps all done', icon: '🪜',
    test: (_s, c) => !!c.justCompleted?.subtasks && c.justCompleted.subtasks.length >= 3 && c.justCompleted.subtasks.every((x) => x.done) },
  { id: 'steps8', name: 'Master Planner', description: 'Complete a task with 8+ steps all done', icon: '🗺️',
    test: (_s, c) => !!c.justCompleted?.subtasks && c.justCompleted.subtasks.length >= 8 && c.justCompleted.subtasks.every((x) => x.done) },
  { id: 'repeat10', name: 'Creature of Habit', description: 'Complete 10 repeating tasks', icon: '🔁',
    test: (s) => s.stats.repeatCompleted >= 10 },
  { id: 'repeat100', name: 'Ritualist', description: 'Complete 100 repeating tasks', icon: '🧭',
    test: (s) => s.stats.repeatCompleted >= 100 },
  { id: 'challenge1', name: 'Challenger', description: 'Complete a weekly challenge', icon: '🏁',
    test: (s) => s.stats.challengesCompleted >= 1 },
  { id: 'challenge10', name: 'Challenge Champion', description: 'Complete 10 weekly challenges', icon: '🥇',
    test: (s) => s.stats.challengesCompleted >= 10 },
  { id: 'sweep', name: 'Clean Sweep', description: 'Complete all three challenges in one week', icon: '🧹',
    test: (s) => !!s.stats.week && s.stats.week.claimed.length >= s.stats.week.challenges.length },
  { id: 'weekend', name: 'Weekend Warrior', description: 'Complete a task on a Saturday or Sunday', icon: '🏖️',
    test: (_s, c) => !!c.justCompleted && [0, 6].includes(new Date(c.now).getDay()) },
  { id: 'reward', name: 'Fresh Coat', description: 'Switch to a theme you unlocked', icon: '🎨',
    test: (s) => ['teal', 'pink', 'gold', 'midnight'].includes(s.theme) },
  { id: 'organizer', name: 'Organizer', description: 'Create your own category', icon: '🗂️',
    test: (s) => s.categories.some((c) => !c.id.startsWith('default-')) },
];
