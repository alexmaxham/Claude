import { createInitialState, THEMES } from './store';
import type { AppState } from './types';

/**
 * Minimal key/value interface. The web app uses localStorage; a native app can
 * plug in AsyncStorage, MMKV or Capacitor Preferences with the same shape.
 */
export interface KeyValueStore {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

export const STORAGE_KEY = 'questlog:v1';

export async function loadState(store: KeyValueStore): Promise<AppState> {
  try {
    return parseState(await store.getItem(STORAGE_KEY));
  } catch {
    return createInitialState();
  }
}

export function parseState(raw: string | null): AppState {
  try {
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const base = createInitialState();
    // Merge so fields added in later versions get sensible defaults.
    return {
      ...base,
      ...parsed,
      version: 1,
      stats: { ...base.stats, ...parsed.stats },
      theme: THEMES.some((t) => t.id === parsed.theme) ? parsed.theme! : base.theme,
    };
  } catch {
    return createInitialState();
  }
}

export async function saveState(store: KeyValueStore, state: AppState): Promise<void> {
  try {
    await store.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable (e.g. private mode); keep running in memory.
  }
}
