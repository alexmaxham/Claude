import { challengeProgress, currentWeek, hash, weekKey } from './challenges';
import { addDays, dayKey } from './dates';
import {
  ACHIEVEMENTS,
  bossBounty,
  FOCUS_XP_PER_MINUTE,
  FREEZE_EVERY,
  GOAL_BONUS,
  isSurprise,
  levelFromXp,
  MAX_FREEZES,
  missedDays,
  nextStreak,
  xpForTask,
} from './gamification';
import { nextDueDate } from './recurrence';
import type { AppState, Category, GameEvent, Priority, Repeat, Subtask, Task, Template, ThemeId, WeekProgress } from './types';

/** What it takes to make a task; everything but the title is optional. */
export interface NewTask {
  title: string;
  description?: string;
  categoryId?: string | null;
  priority?: Priority;
  dueDate?: string | null;
  repeat?: Repeat | null;
  subtasks?: Subtask[];
  boss?: boolean;
  estimate?: number;
  /** Imports only: a finished task and when it was done. Earns no XP. */
  completedAt?: number | null;
}

export type Action =
  | ({ type: 'addTask' } & NewTask)
  /** Adds a batch, e.g. from an import. Categories are matched by name and created if missing. */
  | { type: 'importTasks'; tasks: (NewTask & { categoryName?: string })[] }
  | { type: 'updateTask'; id: string; patch: TaskPatch }
  | { type: 'toggleTask'; id: string }
  | { type: 'toggleSubtask'; taskId: string; subtaskId: string }
  /** `ids` in their new order; they take over the positions those tasks held between them. */
  | { type: 'reorderTasks'; ids: string[] }
  | { type: 'deleteTask'; id: string }
  | { type: 'restoreTask'; task: Task; index: number }
  | { type: 'clearCompleted' }
  | { type: 'addCategory'; name: string; emoji: string; color: string }
  | { type: 'updateCategory'; id: string; patch: Partial<Omit<Category, 'id'>> }
  | { type: 'deleteCategory'; id: string }
  | { type: 'moveCategory'; id: string; delta: -1 | 1 }
  | { type: 'setDailyGoal'; goal: number }
  | { type: 'setTheme'; theme: ThemeId }
  /** Moves these tasks to `day`, in this order, e.g. after planning the day. */
  | { type: 'planDay'; ids: string[]; day: string }
  | { type: 'focusComplete'; taskId: string | null; minutes: number }
  /** Picks today's double-XP surprise if there isn't one for today yet. */
  | { type: 'rollSurprise' }
  | { type: 'saveTemplate'; template: Omit<Template, 'id'> & { id?: string } }
  | { type: 'deleteTemplate'; id: string }
  | { type: 'reset' }
  /** Replace everything, e.g. with data loaded from the cloud. */
  | { type: 'load'; state: AppState };

export type TaskPatch = Partial<
  Pick<Task, 'title' | 'description' | 'categoryId' | 'priority' | 'dueDate' | 'subtasks' | 'repeat' | 'boss' | 'doing' | 'estimate'>
>;

/** The first five are free; the rest unlock as rewards when you reach their level. */
export const THEMES: { id: ThemeId; name: string; color: string; unlockLevel?: number }[] = [
  { id: 'blue', name: 'Blue', color: '#2f63e0' },
  { id: 'orange', name: 'Orange', color: '#ff8a3d' },
  { id: 'red', name: 'Red', color: '#ff4d5e' },
  { id: 'green', name: 'Green', color: '#2fbf71' },
  { id: 'purple', name: 'Purple', color: '#8b6cff' },
  { id: 'teal', name: 'Teal', color: '#1fc8c0', unlockLevel: 3 },
  { id: 'pink', name: 'Pink', color: '#ff5fa8', unlockLevel: 5 },
  { id: 'gold', name: 'Gold', color: '#f5b82e', unlockLevel: 8 },
  { id: 'midnight', name: 'Midnight', color: '#5b6b9a', unlockLevel: 12 },
];

export function isThemeUnlocked(theme: ThemeId, level: number): boolean {
  return level >= (THEMES.find((t) => t.id === theme)?.unlockLevel ?? 0);
}

/** Sort key for manual ordering. */
export function taskOrder(t: Task): number {
  return t.order ?? -t.createdAt;
}

export const CATEGORY_COLORS = [
  '#ff6b8b', '#ff9f43', '#ffd166', '#4cd97b', '#2ec4b6', '#5ac8fa', '#6c8cff', '#a78bfa', '#f472b6',
];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'default-personal', name: 'Personal', emoji: '🏡', color: '#a78bfa' },
  { id: 'default-work', name: 'Work', emoji: '💼', color: '#5ac8fa' },
  { id: 'default-health', name: 'Health', emoji: '💪', color: '#4cd97b' },
  { id: 'default-errands', name: 'Errands', emoji: '🛒', color: '#ff9f43' },
];

/** Starter templates; ids starting with "builtin-" mark them as not made by the user. */
export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'builtin-weekly-review',
    name: 'Weekly review',
    emoji: '🗓️',
    categoryId: null,
    priority: 'medium',
    estimate: 30,
    steps: ['Clear inbox', 'Review last week’s calendar', 'Check next week’s calendar', 'Update open quests', 'Pick 3 big goals'],
  },
  {
    id: 'builtin-packing',
    name: 'Packing list',
    emoji: '🧳',
    categoryId: 'default-personal',
    priority: 'medium',
    steps: ['Clothes', 'Toiletries', 'Chargers', 'Passport / ID', 'Medication', 'Snacks'],
  },
  {
    id: 'builtin-morning',
    name: 'Morning routine',
    emoji: '🌅',
    categoryId: 'default-health',
    priority: 'low',
    estimate: 20,
    steps: ['Glass of water', 'Stretch', 'Plan the day'],
  },
  {
    id: 'builtin-project',
    name: 'Big project',
    emoji: '🐉',
    description: 'A boss battle: each step you finish deals damage.',
    categoryId: 'default-work',
    priority: 'high',
    boss: true,
    steps: ['Define the goal', 'Break it into milestones', 'First draft', 'Get feedback', 'Finish and ship'],
  },
];

export function createInitialState(): AppState {
  return {
    version: 1,
    tasks: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    stats: {
      xp: 0,
      totalCompleted: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastActiveDay: null,
      dailyGoal: 3,
      goalBonusDays: [],
      completionsByDay: {},
      achievements: {},
      highCompleted: 0,
      onTimeCompleted: 0,
      repeatCompleted: 0,
      challengesCompleted: 0,
      week: null,
      streakFreezes: 0,
      frozenDays: [],
      bossesDefeated: 0,
      focusMinutes: 0,
      focusSessions: 0,
      surprise: null,
    },
    theme: 'blue',
    templates: BUILTIN_TEMPLATES.map((t) => ({ ...t, steps: [...t.steps] })),
  };
}

export function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export interface ReduceResult {
  state: AppState;
  events: GameEvent[];
}

/** Pure state transition. Returns the new state plus anything worth celebrating. */
export function reduce(state: AppState, action: Action, now = Date.now()): ReduceResult {
  const events: GameEvent[] = [];
  let next = state;
  let justCompleted: Task | undefined;

  switch (action.type) {
    case 'addTask': {
      const task = makeTask(action, now);
      if (!task) return { state, events };
      next = { ...state, tasks: [task, ...state.tasks] };
      break;
    }

    case 'importTasks': {
      const categories = [...state.categories];
      const byName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
      const added: Task[] = [];
      action.tasks.forEach((t, i) => {
        let categoryId = t.categoryId ?? null;
        const name = t.categoryName?.trim();
        if (name) {
          categoryId = byName.get(name.toLowerCase()) ?? null;
          if (!categoryId) {
            categoryId = uid();
            byName.set(name.toLowerCase(), categoryId);
            categories.push({ id: categoryId, name, emoji: '📥', color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length] });
          }
        }
        // Keep the file's order: earlier rows come first when sorted by newest.
        const task = makeTask({ ...t, categoryId }, now - i);
        if (task) added.push(task);
      });
      if (!added.length) return { state, events };
      next = { ...state, categories, tasks: [...added, ...state.tasks] };
      break;
    }

    case 'planDay': {
      const ids = action.ids.filter((id) => state.tasks.some((t) => t.id === id && !t.completedAt));
      if (!ids.length) return { state, events };
      const planned = new Set(ids);
      next = {
        ...state,
        tasks: state.tasks.map((t) => (planned.has(t.id) ? { ...t, dueDate: action.day } : t)),
      };
      // Their order in the plan becomes their manual order.
      next = reduce(next, { type: 'reorderTasks', ids }, now).state;
      break;
    }

    case 'focusComplete': {
      const minutes = Math.max(1, Math.min(180, Math.round(action.minutes)));
      const xp = Math.max(1, Math.round(minutes * FOCUS_XP_PER_MINUTE));
      const levelBefore = levelFromXp(state.stats.xp).level;
      const stats = {
        ...state.stats,
        xp: state.stats.xp + xp,
        focusMinutes: state.stats.focusMinutes + minutes,
        focusSessions: state.stats.focusSessions + 1,
      };
      events.push({ type: 'focusDone', minutes, xp });
      levelEvents(levelBefore, stats.xp, events);
      next = {
        ...state,
        stats,
        tasks: state.tasks.map((t) => (t.id === action.taskId ? { ...t, focusMinutes: (t.focusMinutes ?? 0) + minutes } : t)),
      };
      break;
    }

    case 'rollSurprise': {
      const today = dayKey(now);
      const current = state.stats.surprise;
      if (current?.day === today && state.tasks.some((t) => t.id === current.taskId)) return { state, events };
      // Prefer something due by today, so the surprise is something you'd actually do.
      const open = state.tasks.filter((t) => !t.completedAt);
      const due = open.filter((t) => t.dueDate && t.dueDate <= today);
      const pool = (due.length ? due : open).map((t) => t.id).sort();
      const surprise = pool.length ? { day: today, taskId: pool[hash(today) % pool.length] } : null;
      if (!surprise && !current) return { state, events };
      next = { ...state, stats: { ...state.stats, surprise } };
      break;
    }

    case 'saveTemplate': {
      const name = action.template.name.trim();
      if (!name) return { state, events };
      const template: Template = { ...action.template, name, id: action.template.id ?? uid() };
      const exists = state.templates.some((t) => t.id === template.id);
      next = {
        ...state,
        templates: exists ? state.templates.map((t) => (t.id === template.id ? template : t)) : [...state.templates, template],
      };
      break;
    }

    case 'deleteTemplate':
      next = { ...state, templates: state.templates.filter((t) => t.id !== action.id) };
      break;

    case 'updateTask':
      next = {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      };
      break;

    case 'toggleTask': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return { state, events };
      const stats = { ...state.stats, completionsByDay: { ...state.stats.completionsByDay } };

      if (task.completedAt) {
        // Undo: take back exactly what was granted so toggling can't farm XP.
        const day = dayKey(task.completedAt);
        stats.xp = Math.max(0, stats.xp - task.xpAwarded);
        stats.totalCompleted = Math.max(0, stats.totalCompleted - 1);
        stats.completionsByDay[day] = Math.max(0, (stats.completionsByDay[day] ?? 0) - 1);
        Object.assign(stats, countLifetime(stats, task, -1));
        if (task.boss) stats.bossesDefeated = Math.max(0, stats.bossesDefeated - 1);
        if (stats.week && weekKey(task.completedAt) === stats.week.key) {
          stats.week = countCompletion(stats.week, task, -1);
        }
        // A repeating task's next occurrence goes away again, unless it's been worked on.
        const spawned = task.spawnedId ? state.tasks.find((t) => t.id === task.spawnedId) : undefined;
        const dropSpawned = spawned && !spawned.completedAt && !spawned.subtasks?.some((s) => s.done);
        next = {
          ...state,
          stats,
          tasks: state.tasks
            .filter((t) => !(dropSpawned && t.id === spawned.id))
            .map((t) => (t.id === task.id ? { ...t, completedAt: null, xpAwarded: 0, spawnedId: undefined } : t)),
        };
        break;
      }

      const today = dayKey(now);
      const streak = nextStreak(state.stats, now);
      const surprise = isSurprise(state.stats, task, now);
      const xp = xpForTask(task, streak, now, surprise);
      const levelBefore = levelFromXp(stats.xp).level;

      // Missed days the streak survived use up freezes.
      const missed = state.stats.lastActiveDay && streak > 1 ? missedDays(state.stats, now) : 0;
      if (missed > 0) {
        stats.streakFreezes -= missed;
        stats.frozenDays = [...stats.frozenDays, ...Array.from({ length: missed }, (_, i) => addDays(today, -missed + i))];
        events.push({ type: 'freezeUsed', days: missed });
      }
      // Every FREEZE_EVERY days of streak earns a freeze.
      if (streak > state.stats.currentStreak && streak % FREEZE_EVERY === 0 && stats.streakFreezes < MAX_FREEZES) {
        stats.streakFreezes += 1;
        events.push({ type: 'freezeEarned', total: stats.streakFreezes });
      }

      stats.xp += xp;
      stats.totalCompleted += 1;
      stats.currentStreak = streak;
      stats.bestStreak = Math.max(stats.bestStreak, streak);
      stats.lastActiveDay = today;
      stats.completionsByDay[today] = (stats.completionsByDay[today] ?? 0) + 1;
      events.push({ type: 'xp', amount: xp, taskId: task.id });
      if (surprise) events.push({ type: 'surprise', bonus: Math.round(xp / 2) });
      if (task.boss) {
        stats.bossesDefeated += 1;
        events.push({ type: 'bossDefeated', taskId: task.id, bounty: bossBounty(task) });
      }
      Object.assign(stats, countLifetime(stats, { ...task, completedAt: now }, 1));

      let week = countCompletion(currentWeek(state.stats, state.categories, now), { ...task, completedAt: now }, 1);

      if (stats.completionsByDay[today] >= stats.dailyGoal && !stats.goalBonusDays.includes(today)) {
        stats.xp += GOAL_BONUS;
        stats.goalBonusDays = [...stats.goalBonusDays, today];
        week = { ...week, goalDays: week.goalDays + 1 };
        events.push({ type: 'goalReached', bonus: GOAL_BONUS });
      }

      for (const c of week.challenges) {
        if (!week.claimed.includes(c.id) && challengeProgress(week, c) >= c.target) {
          week = { ...week, claimed: [...week.claimed, c.id] };
          stats.xp += c.reward;
          stats.challengesCompleted += 1;
          events.push({ type: 'challenge', challenge: c });
        }
      }
      stats.week = week;

      levelEvents(levelBefore, stats.xp, events);

      let tasks = state.tasks;
      let spawnedId: string | undefined;
      if (task.repeat) {
        const occurrence: Task = {
          ...task,
          id: uid(),
          dueDate: nextDueDate(task.repeat, task.dueDate, today),
          subtasks: task.subtasks?.map((s) => ({ ...s, done: false })),
          doing: undefined,
          focusMinutes: undefined,
          createdAt: now,
          completedAt: null,
          xpAwarded: 0,
          spawnedId: undefined,
        };
        spawnedId = occurrence.id;
        tasks = [occurrence, ...tasks];
      }

      justCompleted = { ...task, completedAt: now, xpAwarded: xp, doing: undefined, ...(spawnedId ? { spawnedId } : {}) };
      next = {
        ...state,
        stats,
        tasks: tasks.map((t) => (t.id === task.id ? justCompleted! : t)),
      };
      break;
    }

    case 'toggleSubtask': {
      const task = state.tasks.find((t) => t.id === action.taskId);
      const sub = task?.subtasks?.find((s) => s.id === action.subtaskId);
      if (!task || !sub) return { state, events };
      if (task.boss && !sub.done && !task.completedAt) {
        const maxHp = task.subtasks!.length;
        events.push({ type: 'bossHit', taskId: task.id, hp: task.subtasks!.filter((s) => !s.done).length - 1, maxHp });
      }
      next = {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId
            ? { ...t, subtasks: t.subtasks?.map((s) => (s.id === action.subtaskId ? { ...s, done: !s.done } : s)) }
            : t,
        ),
      };
      break;
    }

    case 'reorderTasks': {
      const byId = new Map(state.tasks.map((t) => [t.id, t]));
      const ids = action.ids.filter((id) => byId.has(id));
      const slots = ids.map((id) => taskOrder(byId.get(id)!)).sort((a, b) => a - b);
      // Equal slots (e.g. tasks created in the same millisecond) would make the order ambiguous.
      for (let i = 1; i < slots.length; i++) if (slots[i] <= slots[i - 1]) slots[i] = slots[i - 1] + 0.001;
      const newOrder = new Map(ids.map((id, i) => [id, slots[i]]));
      next = {
        ...state,
        tasks: state.tasks.map((t) => (newOrder.has(t.id) ? { ...t, order: newOrder.get(t.id)! } : t)),
      };
      break;
    }

    case 'deleteTask':
      next = { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
      break;

    case 'restoreTask': {
      if (state.tasks.some((t) => t.id === action.task.id)) return { state, events };
      const tasks = [...state.tasks];
      tasks.splice(Math.min(action.index, tasks.length), 0, action.task);
      next = { ...state, tasks };
      break;
    }

    case 'clearCompleted':
      next = { ...state, tasks: state.tasks.filter((t) => !t.completedAt) };
      break;

    case 'addCategory': {
      const name = action.name.trim();
      if (!name) return { state, events };
      next = {
        ...state,
        categories: [...state.categories, { id: uid(), name, emoji: action.emoji || '📌', color: action.color }],
      };
      break;
    }

    case 'updateCategory':
      next = {
        ...state,
        categories: state.categories.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };
      break;

    case 'deleteCategory':
      // Tasks are kept; they just become uncategorized.
      next = {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
        tasks: state.tasks.map((t) => (t.categoryId === action.id ? { ...t, categoryId: null } : t)),
      };
      break;

    case 'moveCategory': {
      const i = state.categories.findIndex((c) => c.id === action.id);
      const j = i + action.delta;
      if (i < 0 || j < 0 || j >= state.categories.length) return { state, events };
      const categories = [...state.categories];
      [categories[i], categories[j]] = [categories[j], categories[i]];
      next = { ...state, categories };
      break;
    }

    case 'setDailyGoal':
      next = { ...state, stats: { ...state.stats, dailyGoal: Math.max(1, Math.min(20, Math.round(action.goal))) } };
      break;

    case 'setTheme':
      if (!isThemeUnlocked(action.theme, levelFromXp(state.stats.xp).level)) return { state, events };
      next = { ...state, theme: action.theme };
      break;

    case 'reset':
      // Erases progress, not the look the user picked.
      return { state: { ...createInitialState(), theme: state.theme }, events };

    case 'load':
      return { state: action.state, events };
  }

  // Award any newly earned achievements.
  const unlocked = ACHIEVEMENTS.filter(
    (a) => !next.stats.achievements[a.id] && a.test(next, { now, justCompleted }),
  );
  if (unlocked.length) {
    const achievements = { ...next.stats.achievements };
    for (const a of unlocked) {
      achievements[a.id] = now;
      events.push({ type: 'achievement', id: a.id });
    }
    next = { ...next, stats: { ...next.stats, achievements } };
  }

  return { state: next, events };
}

function makeTask(t: NewTask, now: number): Task | null {
  const title = t.title.trim();
  if (!title) return null;
  const description = t.description?.trim();
  const estimate = t.estimate && t.estimate > 0 ? Math.round(t.estimate) : undefined;
  return {
    id: uid(),
    title,
    ...(description ? { description } : {}),
    ...(t.subtasks?.length ? { subtasks: t.subtasks } : {}),
    ...(t.repeat ? { repeat: t.repeat } : {}),
    ...(t.boss ? { boss: true } : {}),
    ...(estimate ? { estimate } : {}),
    categoryId: t.categoryId ?? null,
    priority: t.priority ?? 'medium',
    dueDate: t.dueDate ?? null,
    createdAt: now,
    completedAt: t.completedAt ?? null,
    xpAwarded: 0,
  };
}

/** Level-up and theme-unlock events for XP going from a level to `xpAfter`. */
function levelEvents(levelBefore: number, xpAfter: number, events: GameEvent[]) {
  const levelAfter = levelFromXp(xpAfter).level;
  if (levelAfter <= levelBefore) return;
  events.push({ type: 'levelUp', level: levelAfter });
  for (const t of THEMES) {
    if (t.unlockLevel && t.unlockLevel > levelBefore && t.unlockLevel <= levelAfter) {
      events.push({ type: 'themeUnlocked', theme: t.id });
    }
  }
}

/** Adjust this week's counters for a task being completed (+1) or un-completed (-1). */
function countCompletion(week: WeekProgress, task: Task, delta: 1 | -1): WeekProgress {
  const add = (n: number) => Math.max(0, n + delta);
  const onTime = !!task.dueDate && !!task.completedAt && dayKey(task.completedAt) <= task.dueDate;
  const byCategory = { ...week.byCategory };
  if (task.categoryId) byCategory[task.categoryId] = add(byCategory[task.categoryId] ?? 0);
  return {
    ...week,
    completed: add(week.completed),
    high: task.priority === 'high' ? add(week.high) : week.high,
    onTime: onTime ? add(week.onTime) : week.onTime,
    byCategory,
  };
}

/** Lifetime trophy counters after a task is completed (+1) or un-completed (-1). */
function countLifetime(stats: AppState['stats'], task: Task, delta: 1 | -1) {
  const add = (n: number) => Math.max(0, n + delta);
  const onTime = !!task.dueDate && !!task.completedAt && dayKey(task.completedAt) <= task.dueDate;
  return {
    highCompleted: task.priority === 'high' ? add(stats.highCompleted) : stats.highCompleted,
    onTimeCompleted: onTime ? add(stats.onTimeCompleted) : stats.onTimeCompleted,
    repeatCompleted: task.repeat ? add(stats.repeatCompleted) : stats.repeatCompleted,
  };
}
