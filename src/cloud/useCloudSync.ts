import { useCallback, useEffect, useRef, useState } from 'react';
import { isPristine, mergeStates } from '../core/merge';
import { parseState } from '../core/storage';
import { createInitialState, uid as makeId, type Action } from '../core/store';
import type { AppState } from '../core/types';
import type { CloudApi, CloudUser } from './api';
import { cloudConfig } from './config';

export type AuthStatus = 'disabled' | 'loading' | 'signedOut' | 'signedIn';
export type SyncStatus = 'connecting' | 'saving' | 'synced' | 'offline' | 'error';

/** Which account the locally cached state belongs to (null = guest data). */
const OWNER_KEY = 'questlog:owner';
const SAVE_DELAY = 800;
const CLIENT_ID = makeId(); // identifies this tab, so we can ignore our own writes

function readOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(uid: string | null) {
  try {
    if (uid) localStorage.setItem(OWNER_KEY, uid);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    // ignore
  }
}

/**
 * Keeps app state in sync with the signed-in user's cloud copy.
 * Guests keep using local storage only; on first sign-in their progress is
 * merged into the account.
 */
export function useCloudSync(state: AppState, dispatch: (a: Action) => void, notify: (msg: string) => void) {
  const [api, setApi] = useState<CloudApi | null>(null);
  const [status, setStatus] = useState<AuthStatus>(cloudConfig ? 'loading' : 'disabled');
  const [user, setUser] = useState<CloudUser | null>(null);
  const [sync, setSync] = useState<SyncStatus>('connecting');

  const stateRef = useRef(state);
  stateRef.current = state;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  /** JSON of the state last loaded from or written to the cloud. */
  const lastJson = useRef<string | null>(null);
  /** Set once the account's data has been loaded, so we never upload before that. */
  const ready = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    (next: AppState) => {
      lastJson.current = JSON.stringify(next);
      dispatch({ type: 'load', state: next });
    },
    [dispatch],
  );

  const save = useCallback(
    async (uid: string, next: AppState) => {
      if (!api) return;
      const json = JSON.stringify(next);
      lastJson.current = json;
      setSync(navigator.onLine ? 'saving' : 'offline');
      try {
        await api.writeState(uid, json, CLIENT_ID);
        if (lastJson.current === json) setSync('synced');
      } catch {
        setSync('error');
      }
    },
    [api],
  );

  // Load the Firebase SDK only when it's configured.
  useEffect(() => {
    if (!cloudConfig) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    import('./api')
      .then(({ createCloud }) => {
        if (cancelled) return;
        const cloud = createCloud(cloudConfig!);
        setApi(cloud);
        unsub = cloud.onUser((u) => {
          if (!u && readOwner()) {
            // Session ended elsewhere (signed out, expired, account removed):
            // don't leave that account's data on this device.
            writeOwner(null);
            lastJson.current = null;
            dispatch({ type: 'load', state: createInitialState() });
          }
          setUser(u);
          setStatus(u ? 'signedIn' : 'signedOut');
        });
      })
      .catch(() => setStatus('signedOut'));
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [dispatch]);

  // Subscribe to the signed-in user's document.
  const uid = user?.uid;
  useEffect(() => {
    if (!api || !uid) return;
    ready.current = false;
    setSync('connecting');
    let first = true;

    const unsub = api.watchState(
      uid,
      (data, meta) => {
        if (meta.pending) return; // echo of our own unsent write
        const owner = readOwner();

        if (first) {
          // Never decide to upload based on possibly stale offline cache.
          const cacheIsEnough = owner === uid && data;
          if (meta.fromCache && !cacheIsEnough) return;
          first = false;

          const local = stateRef.current;
          if (!data) {
            // New account: start it from whatever this device has as a guest.
            const initial = owner === null || owner === uid ? local : createInitialState();
            load(initial);
            save(uid, initial);
          } else {
            const cloud = parseState(data.json);
            if (owner === null && !isPristine(local)) {
              const merged = mergeStates(cloud, local);
              load(merged);
              save(uid, merged);
              notifyRef.current('Your progress on this device was added to your account.');
            } else {
              load(cloud);
              setSync('synced');
            }
          }
          writeOwner(uid);
          ready.current = true;
          return;
        }

        if (!meta.fromCache) setSync((s) => (s === 'saving' ? s : 'synced'));
        // A change from another device or tab. Local edits waiting to be saved win.
        if (!data || data.clientId === CLIENT_ID || saveTimer.current) return;
        const remote = parseState(data.json);
        if (JSON.stringify(remote) !== lastJson.current) load(remote);
      },
      () => setSync('error'),
    );

    return () => {
      unsub();
      ready.current = false;
    };
  }, [api, uid, load, save]);

  // Save local changes (debounced).
  useEffect(() => {
    if (!uid || !ready.current) return;
    if (JSON.stringify(state) === lastJson.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      save(uid, stateRef.current);
    }, SAVE_DELAY);
  }, [state, uid, save]);

  useEffect(() => {
    const offline = () => setSync('offline');
    const online = () => setSync((s) => (s === 'offline' ? 'saving' : s));
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, []);

  const signOut = useCallback(async () => {
    if (!api) return;
    if (saveTimer.current && uid) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      // Send the last edits, but don't hang if offline.
      await Promise.race([save(uid, stateRef.current), new Promise((r) => setTimeout(r, 2500))]);
    }
    ready.current = false;
    await api.signOut();
    // Leave nothing from the account on this device.
    writeOwner(null);
    lastJson.current = null;
    dispatch({ type: 'load', state: createInitialState() });
  }, [api, uid, save, dispatch]);

  return { api, status, user, sync, signOut };
}
