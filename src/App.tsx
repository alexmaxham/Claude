import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppearance, type Appearance } from './appearance';
import { useCloudSync } from './cloud/useCloudSync';
import { AccountSheet, Avatar, SYNC_LABEL } from './components/AccountSheet';
import { CategoryBar, type Filter } from './components/CategoryBar';
import { CategoryManager } from './components/CategoryManager';
import { Header } from './components/Header';
import { ProfileSheet } from './components/ProfileSheet';
import { QuickAdd } from './components/QuickAdd';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { TaskEditor } from './components/TaskEditor';
import { TaskItem } from './components/TaskItem';
import { Trophies, type TrophiesTab } from './components/Trophies';
import { WeeklyChallenges } from './components/WeeklyChallenges';
import { WeekStrip } from './components/WeekStrip';
import { describeChallenge } from './core/challenges';
import { dayKey } from './core/dates';
import { ACHIEVEMENTS, levelTitle } from './core/gamification';
import { taskOrder, THEMES } from './core/store';
import type { GameEvent, Task } from './core/types';
import { chime, confetti, haptic } from './effects';
import { useAppState } from './useAppState';
import { useDragReorder } from './useDragReorder';
import { useReminders } from './useReminders';

interface Toast {
  id: number;
  icon: string;
  title: string;
  body?: string;
  action?: { label: string; run: () => void };
}

interface Float {
  id: number;
  x: number;
  y: number;
  text: string;
}

type SortMode = 'smart' | 'due' | 'priority' | 'newest' | 'manual';

const SORTS: { id: SortMode; label: string }[] = [
  { id: 'smart', label: 'Smart' },
  { id: 'due', label: 'Due date' },
  { id: 'priority', label: 'Priority' },
  { id: 'newest', label: 'Newest' },
  { id: 'manual', label: 'My order' },
];

interface Prefs {
  soundOn: boolean;
  filter: Filter;
  sort: SortMode;
  remindersOn: boolean;
  reminderTime: string;
  appearance: Appearance;
}

const PREFS_KEY = 'questlog:prefs';
const DEFAULT_PREFS: Prefs = { soundOn: true, filter: 'all', sort: 'smart', remindersOn: false, reminderTime: '09:00', appearance: 'system' };

function readPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

let nextId = 1;
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const byDue = (a: Task, b: Task) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
const byPriority = (a: Task, b: Task) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
const byNewest = (a: Task, b: Task) => b.createdAt - a.createdAt;
const SORTERS: Record<SortMode, (a: Task, b: Task) => number> = {
  smart: (a, b) => byDue(a, b) || byPriority(a, b) || byNewest(a, b),
  due: (a, b) => byDue(a, b) || byNewest(a, b),
  priority: (a, b) => byPriority(a, b) || byDue(a, b) || byNewest(a, b),
  newest: byNewest,
  manual: (a, b) => taskOrder(a) - taskOrder(b),
};

function matches(t: Task, q: string): boolean {
  return [t.title, t.description ?? '', ...(t.subtasks ?? []).map((s) => s.title)].some((x) => x.toLowerCase().includes(q));
}

function dayTitle(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function App() {
  const [prefs, setPrefs] = useState(readPrefs);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [pulse, setPulse] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'categories' | 'account' | 'profile' | 'shortcuts' | TrophiesTab | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const soundOn = prefs.soundOn;

  const updatePrefs = (patch: Partial<Prefs>) => {
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

  // Set once the reducer exists, so event handlers can dispatch (e.g. "Use it" on a new theme).
  const dispatchRef = useRef<(a: Parameters<typeof dispatch>[0]) => void>(() => {});
  const categoriesRef = useRef<typeof state.categories>([]);

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
          case 'challenge': {
            const { text } = describeChallenge(e.challenge, categoriesRef.current);
            pushToast({ icon: '🏁', title: 'Weekly challenge complete!', body: `${text} · +${e.challenge.reward} XP` }, 4500);
            confetti(innerWidth / 2, innerHeight / 4, 90);
            break;
          }
          case 'levelUp':
            setLevelUp(e.level);
            setTimeout(() => confetti(innerWidth / 2, innerHeight / 2, 140), 150);
            haptic([20, 40, 20, 40, 60]);
            if (soundOn) chime([523, 659, 784, 1047]);
            break;
          case 'themeUnlocked': {
            const t = THEMES.find((x) => x.id === e.theme)!;
            pushToast(
              {
                icon: '🎨',
                title: `New theme unlocked: ${t.name}`,
                body: 'Find it in Settings',
                action: { label: 'Use it', run: () => dispatchRef.current({ type: 'setTheme', theme: t.id }) },
              },
              6000,
            );
            break;
          }
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
  dispatchRef.current = dispatch;
  categoriesRef.current = state.categories;
  const cloud = useCloudSync(state, dispatch, (msg) => pushToast({ icon: '☁️', title: 'Signed in', body: msg }, 4500));
  const { tasks, categories, stats, theme } = state;
  useReminders(tasks, prefs.remindersOn, prefs.reminderTime);
  useAppearance(prefs.appearance);

  // The stylesheet picks its accent colors from this attribute.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const today = dayKey();
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Fall back to "all" if the filtered category was deleted or the picked day has passed.
  const filter: Filter =
    typeof prefs.filter === 'object' &&
    ('categoryId' in prefs.filter ? !categoryById.has(prefs.filter.categoryId) : prefs.filter.day < today)
      ? 'all'
      : prefs.filter;
  const activeCategory = typeof filter === 'object' && 'categoryId' in filter ? categoryById.get(filter.categoryId) : undefined;
  const activeDay = typeof filter === 'object' && 'day' in filter ? filter.day : null;

  const isToday = (t: Task) => (!t.completedAt && !!t.dueDate && t.dueDate <= today) || (!!t.completedAt && dayKey(t.completedAt) === today);
  const todayCount = tasks.filter((t) => !t.completedAt && isToday(t)).length;

  const q = query.trim().toLowerCase();
  // Search looks through everything; otherwise the sidebar filter applies.
  const visible = q
    ? tasks.filter((t) => matches(t, q))
    : tasks.filter((t) =>
        filter === 'all'
          ? true
          : filter === 'today'
            ? isToday(t)
            : activeDay
              ? activeDay === today
                ? isToday(t)
                : t.dueDate === activeDay
              : t.categoryId === activeCategory?.id,
      );
  const open = visible.filter((t) => !t.completedAt).sort(SORTERS[prefs.sort]);
  const done = visible.filter((t) => t.completedAt).sort((a, b) => b.completedAt! - a.completedAt!);
  const editing = editingId ? tasks.find((t) => t.id === editingId) : undefined;
  const navigable = showDone ? [...open, ...done] : open;

  const drag = useDragReorder(
    open.map((t) => t.id),
    (ids) => {
      if (prefs.sort !== 'manual') updatePrefs({ sort: 'manual' });
      dispatch({ type: 'reorderTasks', ids });
    },
    (id, categoryId) => {
      const task = tasks.find((t) => t.id === id);
      if (!task || task.categoryId === categoryId) return;
      dispatch({ type: 'updateTask', id, patch: { categoryId } });
      const cat = categoryById.get(categoryId);
      if (cat) pushToast({ icon: cat.emoji, title: `Moved to ${cat.name}`, body: task.title });
    },
  );

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
      {
        icon: '🗑',
        title: 'Quest deleted',
        body: task.title,
        action: { label: 'Undo', run: () => dispatch({ type: 'restoreTask', task, index }) },
      },
      5000,
    );
  };

  // Keyboard shortcuts. Ignored while typing or while a sheet or dialog is open.
  const keyState = useRef({ navigable, selectedId, toggle, blocked: false });
  keyState.current = { navigable, selectedId, toggle, blocked: !!(sheet || editing || levelUp !== null) };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keyState.current;
      const target = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || k.blocked) return;
      if (target.closest('input, textarea, select, [contenteditable]')) {
        if (e.key === 'Escape' && target === searchRef.current) {
          setQuery('');
          searchRef.current?.blur();
        }
        return;
      }
      const list = k.navigable;
      const index = list.findIndex((t) => t.id === k.selectedId);
      const selected = index >= 0 ? list[index] : undefined;
      const move = (delta: number) => {
        if (!list.length) return;
        const next = index < 0 ? (delta > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, index + delta));
        setSelectedId(list[next].id);
      };

      if (e.key === 'j' || (e.key === 'ArrowDown' && selected)) {
        e.preventDefault();
        move(1);
      } else if (e.key === 'k' || (e.key === 'ArrowUp' && selected)) {
        e.preventDefault();
        move(-1);
      } else if ((e.key === 'x' || e.key === ' ') && selected) {
        e.preventDefault();
        const check = document.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(selected.id)}"] .check`);
        if (check) k.toggle(selected, check);
        // Completing hides the row (unless completed ones are shown), so move to its neighbor.
        if (!selected.completedAt && !list.slice(index + 1).length) setSelectedId(list[index - 1]?.id ?? null);
        else if (!selected.completedAt) setSelectedId(list[index + 1].id);
      } else if ((e.key === 'e' || e.key === 'Enter') && selected) {
        e.preventDefault();
        setEditingId(selected.id);
      } else if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === '?') {
        e.preventDefault();
        setSheet('shortcuts');
      } else if (e.key === 'Escape') {
        setSelectedId(null);
        setQuery('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    document.querySelector(`[data-task-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const listTitle = q
    ? `Results for “${query.trim()}”`
    : filter === 'all'
      ? 'All quests'
      : filter === 'today'
        ? 'Today'
        : activeDay
          ? dayTitle(activeDay)
          : `${activeCategory!.emoji} ${activeCategory!.name}`;

  const emptyMessage = q
    ? { icon: '🔍', text: 'No open quests match your search.' }
    : filter === 'today'
      ? { icon: '🌤', text: 'Nothing due today. Add something or enjoy the calm.' }
      : activeDay
        ? { icon: '📅', text: `Nothing due on ${dayTitle(activeDay)}.` }
        : activeCategory
          ? { icon: activeCategory.emoji, text: `No open quests in ${activeCategory.name}.` }
          : { icon: '🗺', text: 'Your quest log is empty. Add your first task above to start earning XP!' };

  const renderTask = (t: Task, draggable: boolean) => (
    <TaskItem
      key={t.id}
      task={t}
      category={categoryById.get(t.categoryId ?? '')}
      stats={stats}
      selected={selectedId === t.id}
      onDragStart={draggable ? drag.start : undefined}
      dragStyle={draggable ? drag.styleFor(t.id) : undefined}
      dragging={drag.draggingId === t.id}
      onToggle={toggle}
      onOpen={(task) => {
        setSelectedId(task.id);
        setEditingId(task.id);
      }}
    />
  );

  return (
    <>
      <div className="backdrop" aria-hidden="true">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="blob b4" />
      </div>

      <main className={`app ${drag.draggingId ? 'is-dragging' : ''}`}>
        <div className="topbar">
          <h1>
            Quest<span>log</span>
          </h1>
          <div className="topbar-actions">
            {cloud.status === 'signedIn' && cloud.user ? (
              <button
                className={`account-btn sync-${cloud.sync}`}
                onClick={() => setSheet('profile')}
                aria-label={`Profile: ${cloud.user.email ?? ''}. ${SYNC_LABEL[cloud.sync]}`}
                title={SYNC_LABEL[cloud.sync]}
              >
                <Avatar user={cloud.user} size={38} />
                <span className="sync-dot" />
              </button>
            ) : cloud.status === 'signedOut' ? (
              <>
                <button className="signin-btn glass-soft" onClick={() => setSheet('account')}>
                  Sign in
                </button>
                <button className="icon-btn glass-soft guest-btn" onClick={() => setSheet('profile')} aria-label="Profile">
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M4.8 19.5c1.3-3.3 4-5 7.2-5s5.9 1.7 7.2 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </button>
              </>
            ) : null}
            <button className="icon-btn glass-soft" onClick={() => setSheet('settings')} aria-label="Settings">
              ⚙︎
            </button>
          </div>
        </div>

        {/* On phones these two wrappers vanish (display: contents) and their children
            stack in one column; on wide screens they become a sidebar and a main column. */}
        <aside className="sidebar">
          <Header stats={stats} pulse={pulse} onOpenTrophies={() => setSheet('trophies')} />

          <CategoryBar
            categories={categories}
            tasks={tasks}
            filter={filter}
            todayCount={todayCount}
            onChange={(f) => updatePrefs({ filter: f })}
            onEdit={() => setSheet('categories')}
            dropTarget={drag.overCategory}
          />

          <WeekStrip tasks={tasks} selectedDay={activeDay} onSelect={(day) => updatePrefs({ filter: day ? { day } : 'all' })} />

          <WeeklyChallenges stats={stats} categories={categories} compact />

          <p className="footer-hint muted small">
            Press <kbd>N</kbd> to add, <kbd>/</kbd> to search, <kbd>J</kbd>/<kbd>K</kbd> to move, <kbd>X</kbd> to complete.{' '}
            <button className="link-btn inline" onClick={() => setSheet('shortcuts')}>
              All shortcuts (<kbd>?</kbd>)
            </button>
          </p>
        </aside>

        <div className="main-col">
          <QuickAdd
            categories={categories}
            defaultCategoryId={activeCategory?.id ?? null}
            defaultDue={filter === 'today' ? today : activeDay}
            onAdd={(t) => dispatch({ type: 'addTask', ...t })}
          />

          <section className="tasks" aria-label="Tasks">
            <div className="list-toolbar">
              <h2 className="list-title">
                {listTitle}
                <span className="muted"> · {open.length} open</span>
              </h2>
              <div className="list-tools">
                <label className="search glass-soft">
                  <span aria-hidden="true">🔍</span>
                  <input
                    ref={searchRef}
                    type="search"
                    placeholder="Search quests…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search quests"
                  />
                </label>
                <label className="sort glass-soft">
                  <span className="sr-only">Sort by</span>
                  <span aria-hidden="true">↕︎</span>
                  <select value={prefs.sort} onChange={(e) => {
                      updatePrefs({ sort: e.target.value as SortMode });
                      e.target.blur(); // hand the keyboard back to the list shortcuts
                    }} aria-label="Sort by">
                    {SORTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {open.length === 0 ? (
              <div className="empty glass-soft">
                <span className="empty-icon">{done.length && !q ? '🎉' : emptyMessage.icon}</span>
                <p>{done.length && !q ? 'All clear! Every quest here is done.' : emptyMessage.text}</p>
              </div>
            ) : (
              <ul className="task-list">{open.map((t) => renderTask(t, true))}</ul>
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
                {showDone && <ul className="task-list">{done.map((t) => renderTask(t, false))}</ul>}
              </div>
            )}
          </section>
        </div>
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
            {t.action && (
              <button
                className="btn"
                onClick={() => {
                  t.action!.run();
                  setToasts((ts) => ts.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
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
      {sheet === 'shortcuts' && <ShortcutsHelp onClose={() => setSheet(null)} />}
      {sheet === 'profile' && (
        <ProfileSheet
          state={state}
          user={cloud.user}
          sync={cloud.sync}
          onSignIn={() => setSheet('account')}
          onSignOut={cloud.signOut}
          onOpenTrophies={() => setSheet('trophies')}
          onClose={() => setSheet(null)}
        />
      )}
      {(sheet === 'trophies' || sheet === 'settings') && (
        <Trophies
          key={sheet}
          initialTab={sheet}
          state={state}
          stats={stats}
          appearance={prefs.appearance}
          onAppearance={(appearance) => updatePrefs({ appearance })}
          syncCalendar={cloud.status === 'signedIn' && cloud.api ? () => cloud.api!.syncGoogleCalendar(tasks) : null}
          categories={categories}
          theme={theme}
          soundOn={soundOn}
          reminders={{ on: prefs.remindersOn, time: prefs.reminderTime }}
          onReminders={(r) => updatePrefs({ remindersOn: r.on, reminderTime: r.time })}
          signedIn={cloud.status === 'signedIn'}
          onToggleSound={() => updatePrefs({ soundOn: !soundOn })}
          dispatch={dispatch}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}
