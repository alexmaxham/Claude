// Platform-agnostic domain types. Nothing in src/core touches the DOM or React,
// so this folder can be shared with a future iOS/Android (React Native) app.

export type Priority = 'low' | 'medium' | 'high';

/** The app's accent color, chosen by the user. */
export type ThemeId = 'blue' | 'orange' | 'red' | 'green' | 'purple' | 'teal' | 'pink' | 'gold' | 'midnight';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

/**
 * How a task comes back after it's completed. Weekly `days` are 0 (Sun) – 6 (Sat).
 * `interval` means "every N days/weeks/months" and defaults to 1.
 */
export type Repeat =
  | { kind: 'daily'; interval?: number }
  | { kind: 'weekly'; days: number[]; interval?: number }
  | { kind: 'monthly'; interval?: number }
  | { kind: 'yearly' };

export type ChallengeKind = 'complete' | 'high' | 'onTime' | 'goalDays' | 'category';

export interface Challenge {
  id: string;
  kind: ChallengeKind;
  target: number;
  categoryId?: string;
  reward: number;
}

/** This week's challenges and the counters that drive them. */
export interface WeekProgress {
  key: string; // day key of the Monday the week starts on
  challenges: Challenge[];
  completed: number;
  high: number;
  onTime: number;
  goalDays: number;
  byCategory: Record<string, number>;
  claimed: string[]; // challenge ids already rewarded
}

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
  subtasks?: Subtask[];
  repeat?: Repeat | null;
  /** Position when sorting manually; lower comes first. Defaults to -createdAt (newest first). */
  order?: number;
  /** For a completed repeating task: the id of the next occurrence it created. */
  spawnedId?: string;
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
  /** Lifetime counters for trophies (un-completing a task takes its counts back). */
  highCompleted: number;
  onTimeCompleted: number;
  repeatCompleted: number;
  challengesCompleted: number;
  week: WeekProgress | null;
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
  | { type: 'achievement'; id: string }
  | { type: 'challenge'; challenge: Challenge }
  | { type: 'themeUnlocked'; theme: ThemeId };
