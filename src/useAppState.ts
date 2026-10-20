import { useCallback, useEffect, useRef, useState } from 'react';
import { parseState, saveState, STORAGE_KEY } from './core/storage';
import { reduce, type Action } from './core/store';
import type { AppState, GameEvent } from './core/types';

function readInitial(): AppState {
  try {
    return parseState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return parseState(null);
  }
}

/** App state persisted to localStorage, with game events forwarded to `onEvents`. */
export function useAppState(onEvents: (events: GameEvent[], action: Action) => void) {
  const [state, setState] = useState(readInitial);
  const stateRef = useRef(state);
  const onEventsRef = useRef(onEvents);
  onEventsRef.current = onEvents;

  useEffect(() => {
    saveState(localStorage, state);
  }, [state]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = parseState(e.newValue);
      stateRef.current = next;
      setState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const dispatch = useCallback((action: Action) => {
    const result = reduce(stateRef.current, action);
    if (result.state === stateRef.current) return;
    stateRef.current = result.state;
    setState(result.state);
    if (result.events.length) onEventsRef.current(result.events, action);
  }, []);

  return [state, dispatch] as const;
}
