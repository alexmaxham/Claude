import { useCallback, useMemo, useRef, useState } from 'react';
import { useCloudSync } from './cloud/useCloudSync';
import { AccountSheet, Avatar, SYNC_LABEL } from './components/AccountSheet';
import { CategoryBar, type Filter } from './components/CategoryBar';
import { CategoryManager } from './components/CategoryManager';
import { Header } from './components/Header';
import { QuickAdd } from './components/QuickAdd';
import { TaskEditor } from './components/TaskEditor';
import { TaskItem } from './components/TaskItem';
import { Trophies } from './components/Trophies';
import { dayKey } from './core/dates';
import { ACHIEVEMENTS, levelTitle } from './core/gamification';
import type { GameEvent, Task } from './core/types';
import { chime, confetti, haptic } from './effects';
import { useAppState } from './useAppState';

interface Toast {
  id: number;
  icon: string;
  title: string;
  body?: string;
  undo?: () => void;
}

interface Float {
  id: number;
  x: number;
  y: number;
  text: string;
}

const PREFS_KEY = 'questlog:prefs';

function readPrefs(): { soundOn: boolean; filter: Filter } {
  try {
    return { soundOn: true, filter: 'all', ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { soundOn: true, filter: 'all' };
  }
}

function writePrefs(prefs: { soundOn: boolean; filter: Filter }) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

let nextId = 1;
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

export default function App() {
  const [prefs, setPrefs] = useState(readPrefs);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [pulse, setPulse] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'categories' | 'trophies' | 'account' | null>(null);
  const [showDone, setShowDone] = useState(false);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const soundOn = prefs.soundOn;

  const updatePrefs = (patch: Partial<typeof prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      writePrefs(next);
      return next;
    });
  };

  const pushToast = useCallback((t: Omit<Toast, 'id'>, ms = 3200) => {
    const id = nextId++;
    setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), ms);
  }, []);

  const handleEvents = useCallback(
    (events: GameEvent[]) => {
      const origin = originRef.current ?? { x: innerWidth / 2, y: innerHeight / 3 };
      for (const e of events) {
        switch (e.type) {
          case 'xp': {
            const id = nextId++;
            setFloats((f) => [...f, { id, x: origin.x, y: origin.y, text: `+${e.amount} XP` }]);
            setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1100);
            setPulse((p) => p + 1);
            confetti(origin.x, origin.y, 24);
            haptic(15);
            if (soundOn) chime();
            break;
          }
          case 'goalReached':
            pushToast({ icon: '🎯', title: 'Daily goal reached!', body: `+${e.bonus} bonus XP` });
            confetti(innerWidth / 2, innerHeight / 4, 70);
            break;
          case 'levelUp':
            setLevelUp(e.level);
            setTimeout(() => confetti(innerWidth / 2, innerHeight / 2, 140), 150);
            haptic([20, 40, 20, 40, 60]);
            if (soundOn) chime([523, 659, 784, 1047]);
            break;
          case 'achievement': {
            const a = ACHIEVEMENTS.find((x) => x.id === e.id);
            if (a) pushToast({ icon: a.icon, title: `Trophy unlocked: ${a.name}`, body: a.description }, 4200);
            break;
          }
        }
      }
      originRef.current = null;
    },
    [pushToast, soundOn],
  );

  const [state, dispatch] = useAppState(handleEvents);
  const cloud = useCloudSync(state, dispatch, (msg) => pushToast({ icon: '☁️', title: 'Signed in', body: msg }, 4500));
  const { tasks, categories, stats } = state;
  const today = dayKey();
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Fall back to "all" if the filtered category was deleted.
  const filter: Filter =
    typeof prefs.filter === 'object' && !categoryById.has(prefs.filter.categoryId) ? 'all' : prefs.filter;

  const isToday = (t: Task) => (!t.completedAt && !!t.dueDate && t.dueDate <= today) || (!!t.completedAt && dayKey(t.completedAt) === today);
  const todayCount = tasks.filter((t) => !t.completedAt && isToday(t)).length;

  const visible = tasks.filter((t) =>
    filter === 'all' ? true : filter === 'today' ? isToday(t) : t.categoryId === filter.categoryId,
  );
  const open = visible
    .filter((t) => !t.completedAt)
    .sort(
      (a, b) =>
        (a.dueDate ?? '9999') .localeCompare(b.dueDate ?? '9999') ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        b.createdAt - a.createdAt,
    );
  const done = visible.filter((t) => t.completedAt).sort((a, b) => b.completedAt! - a.completedAt!);
  const activeCategory = typeof filter === 'object' ? categoryById.get(filter.categoryId) : undefined;
  const editing = editingId ? tasks.find((t) => t.id === editingId) : undefined;

  const toggle = (task: Task, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    originRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    dispatch({ type: 'toggleTask', id: task.id });
    if (task.completedAt) haptic(8);
  };

  const remove = (task: Task) => {
    const index = tasks.findIndex((t) => t.id === task.id);
    dispatch({ type: 'deleteTask', id: task.id });
    pushToast(
      { icon: '🗑', title: 'Quest deleted', body: task.title, undo: () => dispatch({ type: 'restoreTask', task, index }) },
      5000,
    );
  };

  const emptyMessage =
    filter === 'today'
      ? { icon: '🌤', text: 'Nothing due today. Add something or enjoy the calm.' }
      : activeCategory
        ? { icon: activeCategory.emoji, text: `No open quests in ${activeCategory.name}.` }
        : { icon: '🗺', text: 'Your quest log is empty. Add your first task above to start earning XP!' };

  return (
    <>
      <div className="backdrop" aria-hidden="true">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="blob b4" />
      </div>

      <main className="app">
        <div className="topbar">
          <h1>
            Quest<span>log</span>
          </h1>
          <div className="topbar-actions">
            {cloud.status === 'signedIn' && cloud.user ? (
              <button
                className={`account-btn sync-${cloud.sync}`}
                onClick={() => setSheet('account')}
                aria-label={`Account: ${cloud.user.email ?? ''}. ${SYNC_LABEL[cloud.sync]}`}
                title={SYNC_LABEL[cloud.sync]}
              >
                <Avatar user={cloud.user} size={38} />
                <span className="sync-dot" />
              </button>
            ) : cloud.status === 'signedOut' ? (
              <button className="signin-btn glass-soft" onClick={() => setSheet('account')}>
                Sign in
              </button>
            ) : null}
            <button className="icon-btn glass-soft" onClick={() => setSheet('trophies')} aria-label="Trophies and settings">
              ⚙︎
            </button>
          </div>
        </div>

        <Header stats={stats} pulse={pulse} onOpenTrophies={() => setSheet('trophies')} />

        <QuickAdd
          categories={categories}
          defaultCategoryId={activeCategory?.id ?? null}
          defaultDue={filter === 'today' ? today : null}
          onAdd={(t) => dispatch({ type: 'addTask', ...t })}
        />

        <CategoryBar
          categories={categories}
          tasks={tasks}
          filter={filter}
          todayCount={todayCount}
          onChange={(f) => updatePrefs({ filter: f })}
          onEdit={() => setSheet('categories')}
        />

        <section aria-label="Tasks">
          {open.length === 0 ? (
            <div className="empty glass-soft">
              <span className="empty-icon">{done.length ? '🎉' : emptyMessage.icon}</span>
              <p>{done.length ? 'All clear! Every quest here is done.' : emptyMessage.text}</p>
            </div>
          ) : (
            <ul className="task-list">
              {open.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  category={categoryById.get(t.categoryId ?? '')}
                  stats={stats}
                  onToggle={toggle}
                  onOpen={(task) => setEditingId(task.id)}
                />
              ))}
            </ul>
          )}

          {done.length > 0 && (
            <div className="done-section">
              <div className="done-header">
                <button className="link-btn" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
                  {showDone ? '▾' : '▸'} Completed ({done.length})
                </button>
                {showDone && (
                  <button className="link-btn muted" onClick={() => dispatch({ type: 'clearCompleted' })}>
                    Clear completed
                  </button>
                )}
              </div>
              {showDone && (
                <ul className="task-list">
                  {done.map((t) => (
                    <TaskItem
                      key={t.id}
                      task={t}
                      category={categoryById.get(t.categoryId ?? '')}
                      stats={stats}
                      onToggle={toggle}
                      onOpen={(task) => setEditingId(task.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <p className="footer-hint muted small">
          Tip: press <kbd>N</kbd> to add a quest. Higher priority and on-time tasks earn more XP; streaks multiply it.
        </p>
      </main>

      {floats.map((f) => (
        <div key={f.id} className="xp-float" style={{ left: f.x, top: f.y }} aria-hidden="true">
          {f.text}
        </div>
      ))}

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast glass">
            <span className="toast-icon">{t.icon}</span>
            <div className="toast-text">
              <strong>{t.title}</strong>
              {t.body && <span className="muted small">{t.body}</span>}
            </div>
            {t.undo && (
              <button
                className="btn"
                onClick={() => {
                  t.undo!();
                  setToasts((ts) => ts.filter((x) => x.id !== t.id));
                }}
              >
                Undo
              </button>
            )}
          </div>
        ))}
      </div>

      {levelUp !== null && (
        <div className="sheet-backdrop center" onClick={() => setLevelUp(null)}>
          <div className="levelup glass" role="dialog" aria-modal="true" aria-label="Level up" onClick={(e) => e.stopPropagation()}>
            <div className="levelup-glow" />
            <div className="levelup-kicker">LEVEL UP</div>
            <div className="levelup-num">{levelUp}</div>
            <div className="levelup-title">{levelTitle(levelUp)}</div>
            <p className="muted">Keep the momentum going!</p>
            <button className="btn primary" onClick={() => setLevelUp(null)} autoFocus>
              Let’s go
            </button>
          </div>
        </div>
      )}

      {editing && (
        <TaskEditor
          task={editing}
          categories={categories}
          onSave={(patch) => dispatch({ type: 'updateTask', id: editing.id, patch })}
          onDelete={() => remove(editing)}
          onClose={() => setEditingId(null)}
        />
      )}
      {sheet === 'categories' && (
        <CategoryManager categories={categories} tasks={tasks} dispatch={dispatch} onClose={() => setSheet(null)} />
      )}
      {sheet === 'account' && (
        <AccountSheet
          api={cloud.api}
          user={cloud.user}
          sync={cloud.sync}
          onSignOut={cloud.signOut}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'trophies' && (
        <Trophies
          stats={stats}
          soundOn={soundOn}
          signedIn={cloud.status === 'signedIn'}
          onToggleSound={() => updatePrefs({ soundOn: !soundOn })}
          dispatch={dispatch}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}
