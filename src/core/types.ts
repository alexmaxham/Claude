// Platform-agnostic domain types. Nothing in src/core touches the DOM or React,
// so this folder can be shared with a future iOS/Android (React Native) app.

export type Priority = 'low' | 'medium' | 'high';

/** The app's accent color, chosen by the user. */
export type ThemeId = 'blue' | 'orange' | 'red' | 'green' | 'purple';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string; // hex, e.g. "#5ac8fa"
}

export interface Task {
  id: string;
  title: string;
  /** Optional longer notes. Missing on tasks created before descriptions existed. */
  description?: string;
  categoryId: string | null;
  priority: Priority;
  dueDate: string | null; // YYYY-MM-DD (local)
  createdAt: number;
  completedAt: number | null;
  /** XP granted when completed, so un-completing can take back exactly that much. */
  xpAwarded: number;
}

export interface Stats {
  xp: number;
  totalCompleted: number;
  currentStreak: number;
  bestStreak: number;
  lastActiveDay: string | null; // YYYY-MM-DD of the last day a task was completed
  dailyGoal: number;
  /** Day keys on which the daily-goal bonus has already been paid out. */
  goalBonusDays: string[];
  /** Completion count per day key, used for the daily goal ring and history. */
  completionsByDay: Record<string, number>;
  achievements: Record<string, number>; // achievement id -> unlocked timestamp
}

export interface AppState {
  version: 1;
  tasks: Task[];
  categories: Category[];
  stats: Stats;
  theme: ThemeId;
}

/** Things the UI should celebrate after an action. */
export type GameEvent =
  | { type: 'xp'; amount: number; taskId: string }
  | { type: 'levelUp'; level: number }
  | { type: 'goalReached'; bonus: number }
  | { type: 'achievement'; id: string };
