import { dayKey } from './dates';
import { ACHIEVEMENTS, GOAL_BONUS, levelFromXp, nextStreak, xpForTask } from './gamification';
import type { AppState, Category, GameEvent, Priority, Task } from './types';

export type Action =
  | { type: 'addTask'; title: string; categoryId: string | null; priority: Priority; dueDate: string | null }
  | { type: 'updateTask'; id: string; patch: Partial<Pick<Task, 'title' | 'categoryId' | 'priority' | 'dueDate'>> }
  | { type: 'toggleTask'; id: string }
  | { type: 'deleteTask'; id: string }
  | { type: 'restoreTask'; task: Task; index: number }
  | { type: 'clearCompleted' }
  | { type: 'addCategory'; name: string; emoji: string; color: string }
  | { type: 'updateCategory'; id: string; patch: Partial<Omit<Category, 'id'>> }
  | { type: 'deleteCategory'; id: string }
  | { type: 'moveCategory'; id: string; delta: -1 | 1 }
  | { type: 'setDailyGoal'; goal: number }
  | { type: 'reset' };

export const CATEGORY_COLORS = [
  '#ff6b8b', '#ff9f43', '#ffd166', '#4cd97b', '#2ec4b6', '#5ac8fa', '#6c8cff', '#a78bfa', '#f472b6',
];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'default-personal', name: 'Personal', emoji: '🏡', color: '#a78bfa' },
  { id: 'default-work', name: 'Work', emoji: '💼', color: '#5ac8fa' },
  { id: 'default-health', name: 'Health', emoji: '💪', color: '#4cd97b' },
  { id: 'default-errands', name: 'Errands', emoji: '🛒', color: '#ff9f43' },
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
    },
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
      const title = action.title.trim();
      if (!title) return { state, events };
      const task: Task = {
        id: uid(),
        title,
        categoryId: action.categoryId,
        priority: action.priority,
        dueDate: action.dueDate,
        createdAt: now,
        completedAt: null,
        xpAwarded: 0,
      };
      next = { ...state, tasks: [task, ...state.tasks] };
      break;
    }

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
        next = {
          ...state,
          stats,
          tasks: state.tasks.map((t) => (t.id === task.id ? { ...t, completedAt: null, xpAwarded: 0 } : t)),
        };
        break;
      }

      const today = dayKey(now);
      const streak = nextStreak(state.stats, now);
      const xp = xpForTask(task, streak, now);
      const levelBefore = levelFromXp(stats.xp).level;

      stats.xp += xp;
      stats.totalCompleted += 1;
      stats.currentStreak = streak;
      stats.bestStreak = Math.max(stats.bestStreak, streak);
      stats.lastActiveDay = today;
      stats.completionsByDay[today] = (stats.completionsByDay[today] ?? 0) + 1;
      events.push({ type: 'xp', amount: xp, taskId: task.id });

      if (stats.completionsByDay[today] >= stats.dailyGoal && !stats.goalBonusDays.includes(today)) {
        stats.xp += GOAL_BONUS;
        stats.goalBonusDays = [...stats.goalBonusDays, today];
        events.push({ type: 'goalReached', bonus: GOAL_BONUS });
      }

      const levelAfter = levelFromXp(stats.xp).level;
      if (levelAfter > levelBefore) events.push({ type: 'levelUp', level: levelAfter });

      justCompleted = { ...task, completedAt: now, xpAwarded: xp };
      next = {
        ...state,
        stats,
        tasks: state.tasks.map((t) => (t.id === task.id ? justCompleted! : t)),
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

    case 'reset':
      return { state: createInitialState(), events };
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
