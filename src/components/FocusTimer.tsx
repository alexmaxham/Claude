import { useCallback, useEffect, useRef, useState } from 'react';
import { FOCUS_XP_PER_MINUTE } from '../core/gamification';
import { ProgressRing } from './ProgressRing';

const KEY = 'tasko:focus';
const LENGTHS = [15, 25, 50];
/** Stopping early still counts if at least this many minutes were done. */
const MIN_CREDIT = 5;

export interface FocusSession {
  taskId: string | null;
  title: string;
  minutes: number;
  /** Set while running. */
  endsAt: number | null;
  /** Set while paused (or before starting): milliseconds left. */
  left: number;
  started: boolean;
}

function read(): FocusSession | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

function write(s: FocusSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * The focus timer's state, kept in localStorage so a reload or a closed tab doesn't lose it.
 * `onComplete` gets the minutes to credit when a session ends.
 */
export function useFocusTimer(onComplete: (taskId: string | null, minutes: number) => void) {
  const [session, setSession] = useState<FocusSession | null>(read);
  const [now, setNow] = useState(Date.now);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const update = useCallback((s: FocusSession | null) => {
    write(s);
    setSession(s);
  }, []);

  useEffect(() => {
    if (!session?.endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [session?.endsAt]);

  const left = session ? (session.endsAt ? Math.max(0, session.endsAt - now) : session.left) : 0;

  // Time's up, possibly while Tasko was closed. The ref stops a second run from paying twice.
  const paid = useRef<number | null>(null);
  useEffect(() => {
    if (!session?.endsAt || session.endsAt > now || paid.current === session.endsAt) return;
    paid.current = session.endsAt;
    update(null);
    onCompleteRef.current(session.taskId, session.minutes);
  }, [session, now, update]);

  // Show the countdown in the tab title.
  useEffect(() => {
    if (!session?.started) return;
    const base = document.title;
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    document.title = `${session.endsAt ? '' : '⏸ '}${m}:${String(s).padStart(2, '0')} · ${session.title}`;
    return () => {
      document.title = base;
    };
  }, [session, left]);

  return {
    session,
    left,
    /** Opens the timer for a task, ready to start. */
    open: (taskId: string | null, title: string) => {
      if (session?.started) return;
      update({ taskId, title, minutes: 25, endsAt: null, left: 25 * 60000, started: false });
    },
    setLength: (minutes: number) => session && !session.started && update({ ...session, minutes, left: minutes * 60000 }),
    start: () => session && update({ ...session, started: true, endsAt: Date.now() + session.left }),
    pause: () => session?.endsAt && update({ ...session, endsAt: null, left: Math.max(0, session.endsAt - Date.now()) }),
    stop: () => {
      if (!session) return;
      const done = Math.floor((session.minutes * 60000 - left) / 60000);
      update(null);
      if (session.started && done >= MIN_CREDIT) onCompleteRef.current(session.taskId, done);
    },
  };
}

type Timer = ReturnType<typeof useFocusTimer>;

/** Floating glass pill with the countdown. */
export function FocusTimer({ timer }: { timer: Timer }) {
  const { session, left } = timer;
  if (!session) return null;
  const total = session.minutes * 60000;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const running = !!session.endsAt;
  const elapsed = Math.floor((total - left) / 60000);

  return (
    <div className={`focus-pill glass ${running ? 'running' : ''}`} role="timer" aria-label="Focus timer">
      <ProgressRing progress={1 - left / total} size={52} stroke={5}>
        <span className="focus-time">{session.started ? `${m}:${String(s).padStart(2, '0')}` : `${session.minutes}`}</span>
      </ProgressRing>
      <div className="focus-body">
        <span className="focus-kicker">{session.started ? (running ? 'Focusing' : 'Paused') : 'Focus session'}</span>
        <strong className="focus-title">{session.title}</strong>
        {!session.started ? (
          <div className="focus-lengths" role="radiogroup" aria-label="Length">
            {LENGTHS.map((l) => (
              <button key={l} role="radio" aria-checked={session.minutes === l} className={`chip ${session.minutes === l ? 'active' : ''}`} onClick={() => timer.setLength(l)}>
                {l} min
              </button>
            ))}
          </div>
        ) : (
          <span className="muted small">
            +{Math.round(session.minutes * FOCUS_XP_PER_MINUTE)} XP when the timer ends
            {elapsed >= MIN_CREDIT ? ` · stop now for ${Math.max(1, Math.round(elapsed * FOCUS_XP_PER_MINUTE))}` : ''}
          </span>
        )}
      </div>
      <div className="focus-controls">
        {!session.started ? (
          <button className="btn primary" onClick={timer.start}>
            Start
          </button>
        ) : running ? (
          <button className="icon-btn" onClick={timer.pause} aria-label="Pause">
            ⏸
          </button>
        ) : (
          <button className="icon-btn" onClick={timer.start} aria-label="Resume">
            ▶
          </button>
        )}
        <button className="icon-btn" onClick={timer.stop} aria-label={session.started ? 'Stop' : 'Close'}>
          ✕
        </button>
      </div>
    </div>
  );
}
