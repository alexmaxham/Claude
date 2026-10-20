import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppearance, type Appearance } from './appearance';
import { useCloudSync } from './cloud/useCloudSync';
import { AccountSheet, Avatar, SYNC_LABEL } from './components/AccountSheet';
import { CategoryBar, type Filter } from './components/CategoryBar';
import { CategoryManager } from './components/CategoryManager';
import { Header } from './components/Header';
import { LogoMark, Wordmark } from './components/Logo';
import { Board, type Column } from './components/Board';
import { CalendarView, type CalendarMode } from './components/CalendarView';
import { CommandPalette, type Command } from './components/CommandPalette';
import { FocusTimer, useFocusTimer } from './components/FocusTimer';
import { ImportSheet } from './components/ImportSheet';
import { PlanDay } from './components/PlanDay';
import { Templates } from './components/Templates';
import { YearReview } from './components/YearReview';
import { ProfileView } from './components/ProfileView';
import { QuickAdd } from './components/QuickAdd';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { TaskEditor } from './components/TaskEditor';
import { TaskItem } from './components/TaskItem';
import { TabBar, type Tab } from './components/TabBar';
import { Trophies, TrophiesPanel, type TrophiesTab } from './components/Trophies';
import { WeeklyChallenges } from './components/WeeklyChallenges';
import { WeekStrip } from './components/WeekStrip';
import { describeChallenge } from './core/challenges';
import { addDays, dayKey } from './core/dates';
import { ACHIEVEMENTS, isSurprise, levelTitle } from './core/gamification';
import { formatEstimate } from './core/parse';
import { taskOrder, THEMES, uid, type NewTask } from './core/store';
import type { GameEvent, Task, Template } from './core/types';
import { chime, confetti, haptic } from './effects';
import { isNative } from './native';
import { useAppState } from './useAppState';
import { useDragReorder } from './useDragReorder';
import { useDropDrag } from './useDropDrag';
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
  /** Wide screens: the side menu is folded down to icons. */
  railCollapsed: boolean;
  view: 'list' | 'board';
  calendarMode: CalendarMode;
  /** Hours you have for quests in a day, for Plan my day and the over-planned warning. */
  hoursPerDay: number;
}

// Storage keys keep the app's original name so existing data and settings carry over.
const PREFS_KEY = 'questlog:prefs';
const DEFAULT_PREFS: Prefs = { soundOn: true, filter: 'all', sort: 'smart', remindersOn: false, reminderTime: '09:00', appearance: 'system', railCollapsed: false, view: 'list', calendarMode: 'month', hoursPerDay: 6 };

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

const TABS: Tab[] = ['tasks', 'trophies', 'calendar', 'profile'];
const TAB_TITLES: Record<Tab, string> = { tasks: 'Tasks', trophies: 'Trophies', calendar: 'Calendar', profile: 'Profile' };

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
  const [sheet, setSheet] = useState<
    'categories' | 'account' | 'shortcuts' | 'plan' | 'templates' | 'import' | 'review' | 'palette' | TrophiesTab | null
  >(null);
  const [tab, setTab] = useState<Tab>('tasks');
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
          case 'bossHit': {
            const id = nextId++;
            setFloats((f) => [...f, { id, x: origin.x, y: origin.y, text: '⚔️ −1 HP' }]);
            setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1100);
            confetti(origin.x, origin.y, 14);
            haptic([10, 30, 10]);
            if (soundOn) chime([392, 330]);
            if (e.hp === 0) pushToast({ icon: '🐉', title: 'The boss is out of HP!', body: 'Complete the quest to claim the bounty.' }, 4500);
            break;
          }
          case 'bossDefeated':
            pushToast({ icon: '⚔️', title: 'Boss defeated!', body: `+${e.bounty} XP bounty` }, 4500);
            setTimeout(() => confetti(innerWidth / 2, innerHeight / 3, 160), 120);
            haptic([30, 50, 30, 50, 80]);
            break;
          case 'freezeEarned':
            pushToast({ icon: '🧊', title: 'Streak freeze earned', body: `It covers a missed day. You have ${e.total}.` }, 4500);
            break;
          case 'freezeUsed':
            pushToast({ icon: '🧊', title: 'Your streak survived', body: `${e.days === 1 ? 'A streak freeze' : `${e.days} streak freezes`} covered the missed day${e.days === 1 ? '' : 's'}.` }, 4500);
            break;
          case 'surprise':
            pushToast({ icon: '🍀', title: 'Surprise! Double XP', body: `+${e.bonus} bonus XP` });
            break;
          case 'focusDone':
            pushToast({ icon: '🎧', title: `Focus session done: ${formatEstimate(e.minutes)}`, body: `+${e.xp} XP` }, 4500);
            confetti(innerWidth / 2, innerHeight / 3, 60);
            setPulse((p) => p + 1);
            if (soundOn) chime([523, 784, 1047]);
            if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('Focus session done', { body: `${formatEstimate(e.minutes)} · +${e.xp} XP`, icon: './icon-192.png' });
            }
            break;
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

  const focus = useFocusTimer((taskId, minutes) => dispatch({ type: 'focusComplete', taskId, minutes }));
  const startFocus = (task: Task | null) => {
    if (focus.session?.started) return pushToast({ icon: '🎧', title: 'A focus session is already running' });
    focus.open(task?.id ?? null, task?.title ?? 'Focus');
  };

  // Pick today's surprise when the day changes or the surprise quest goes away.
  const surpriseKey = `${dayKey()}:${tasks.length}:${state.stats.surprise?.taskId ?? ''}`;
  useEffect(() => {
    dispatch({ type: 'rollSurprise' });
  }, [surpriseKey, dispatch]);
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && dispatch({ type: 'rollSurprise' });
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [dispatch]);

  // The stylesheet sizes the page around the side menu from these classes.
  useLayoutEffect(() => {
    document.documentElement.classList.add('with-tabbar');
    document.documentElement.classList.toggle('rail-collapsed', prefs.railCollapsed);
  }, [prefs.railCollapsed]);

  const changeTab = (next: Tab) => {
    // Tapping the current tab again scrolls back to the top, like iOS.
    if (next === tab) return window.scrollTo({ top: 0, behavior: 'smooth' });
    haptic(6);
    setTab(next);
    setSelectedId(null);
    window.scrollTo(0, 0);
  };
  const openTrophies = () => changeTab('trophies');
  const toggleRail = () => updatePrefs({ railCollapsed: !prefs.railCollapsed });

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

  const boardDrag = useDropDrag((id, zone, at) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const column = zone as Column;
    const wasDone = !!task.completedAt;
    if (column === 'done') {
      if (wasDone) return;
      originRef.current = at;
      return dispatch({ type: 'toggleTask', id });
    }
    if (wasDone) dispatch({ type: 'toggleTask', id });
    if (!!task.doing !== (column === 'doing')) dispatch({ type: 'updateTask', id, patch: { doing: column === 'doing' } });
  });

  const toggleStep = (task: Task, subtaskId: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    originRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    dispatch({ type: 'toggleSubtask', taskId: task.id, subtaskId });
  };

  const snooze = (task: Task, day = addDays(today, 1), label = 'tomorrow') => {
    const before = task.dueDate;
    dispatch({ type: 'updateTask', id: task.id, patch: { dueDate: day } });
    haptic(8);
    pushToast(
      {
        icon: '💤',
        title: `Snoozed to ${label}`,
        body: task.title,
        action: { label: 'Undo', run: () => dispatch({ type: 'updateTask', id: task.id, patch: { dueDate: before } }) },
      },
      5000,
    );
  };

  const addFromTemplate = (t: Template) => {
    const due = filter === 'today' ? today : activeDay;
    dispatch({
      type: 'addTask',
      title: t.name,
      description: t.description,
      categoryId: t.categoryId && categoryById.has(t.categoryId) ? t.categoryId : (activeCategory?.id ?? null),
      priority: t.priority,
      dueDate: due,
      estimate: t.estimate,
      boss: t.boss,
      subtasks: t.steps.map((title) => ({ id: uid(), title, done: false })),
    });
    pushToast({ icon: t.emoji, title: 'Added from template', body: t.name });
  };

  const plan = (ids: string[], moveRest: string[]) => {
    dispatch({ type: 'planDay', ids, day: today });
    for (const id of moveRest) dispatch({ type: 'updateTask', id, patch: { dueDate: addDays(today, 1) } });
    updatePrefs({ filter: 'today', sort: 'manual', view: 'list' });
    changeTab('tasks');
    pushToast({ icon: '☀️', title: 'Your day is planned', body: `${ids.length} quest${ids.length === 1 ? '' : 's'} for today, in your order` });
  };

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
  const keyState = useRef({ navigable, selectedId, toggle, blocked: false, onTasks: true, changeTab, toggleRail, startFocus, snooze, updatePrefs, prefs });
  keyState.current = {
    navigable,
    selectedId,
    toggle,
    blocked: !!(sheet || editing || levelUp !== null),
    onTasks: tab === 'tasks',
    changeTab,
    toggleRail,
    startFocus,
    snooze,
    updatePrefs,
    prefs,
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keyState.current;
      const target = e.target as HTMLElement;
      // ⌘K / Ctrl+K opens the command menu from anywhere, even a text field.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        return setSheet((s) => (s === 'palette' ? null : s ?? 'palette'));
      }
      if (e.metaKey || e.ctrlKey || e.altKey || k.blocked) return;
      if (target.closest('input, textarea, select, [contenteditable]')) {
        if (e.key === 'Escape' && target === searchRef.current) {
          setQuery('');
          searchRef.current?.blur();
        }
        return;
      }
      // 1–4 switch sections and [ folds the side menu, from any section.
      const n = Number(e.key);
      if (n >= 1 && n <= TABS.length) return k.changeTab(TABS[n - 1]);
      if (e.key === '[') return k.toggleRail();
      if (e.key === '?') {
        e.preventDefault();
        return setSheet('shortcuts');
      }
      if (e.key === 'p') return setSheet('plan');
      if (e.key === 't') return setSheet('templates');
      if (!k.onTasks) return;
      if (e.key === 'b') return k.updatePrefs({ view: k.prefs.view === 'board' ? 'list' : 'board' });

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
      } else if (e.key === 'f' && selected) {
        k.startFocus(selected);
      } else if (e.key === 's' && selected && !selected.completedAt) {
        k.snooze(selected);
        setSelectedId(list[index + 1]?.id ?? list[index - 1]?.id ?? null);
      } else if ((e.key === 'e' || e.key === 'Enter') && selected) {
        e.preventDefault();
        setEditingId(selected.id);
      } else if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
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
          : { icon: 'logo', text: 'Your quest log is empty. Add your first task above to start earning XP!' };

  const onBoard = tab === 'tasks' && prefs.view === 'board';
  // Time planned for today, to warn when it's more than the day holds.
  const todayMinutes = tasks.filter((t) => !t.completedAt && t.dueDate && t.dueDate <= today).reduce((sum, t) => sum + (t.estimate ?? 0), 0);
  const listMinutes = open.reduce((sum, t) => sum + (t.estimate ?? 0), 0);
  const surpriseTask = tasks.find((t) => !t.completedAt && isSurprise(stats, t));
  const loadEvents = useMemo(
    () => (cloud.status === 'signedIn' && cloud.api ? (from: string, to: string) => cloud.api!.googleEvents(from, to) : null),
    [cloud.status, cloud.api],
  );

  const commands: Command[] = [
    { id: 'add', icon: '➕', label: 'New quest', shortcut: 'N', keywords: 'add create task', run: () => { changeTab('tasks'); setTimeout(() => document.querySelector<HTMLInputElement>('.main-col .quick-input')?.focus(), 50); } },
    { id: 'plan', icon: '☀️', label: 'Plan my day', shortcut: 'P', keywords: 'today schedule', run: () => setSheet('plan') },
    { id: 'templates', icon: '📋', label: 'Add from a template', shortcut: 'T', keywords: 'checklist', run: () => setSheet('templates') },
    { id: 'focus', icon: '🎧', label: 'Start a focus session', shortcut: 'F', keywords: 'timer pomodoro', run: () => startFocus(tasks.find((t) => t.id === selectedId && !t.completedAt) ?? null) },
    { id: 'board', icon: '🗂️', label: prefs.view === 'board' ? 'Show as a list' : 'Show as a board', shortcut: 'B', keywords: 'kanban columns view', run: () => { changeTab('tasks'); updatePrefs({ view: prefs.view === 'board' ? 'list' : 'board' }); } },
    { id: 'today', icon: '🌤', label: 'Show today', keywords: 'filter', run: () => { changeTab('tasks'); updatePrefs({ filter: 'today' }); } },
    { id: 'all', icon: '✨', label: 'Show all quests', keywords: 'filter', run: () => { changeTab('tasks'); updatePrefs({ filter: 'all' }); } },
    ...TABS.map((t, i) => ({ id: `tab-${t}`, icon: ['✅', '🏆', '📅', '👤'][i], label: `Go to ${TAB_TITLES[t]}`, shortcut: String(i + 1), run: () => changeTab(t) })),
    { id: 'week', icon: '🗓️', label: 'Calendar: week view', keywords: 'drag schedule', run: () => { updatePrefs({ calendarMode: 'week' }); changeTab('calendar'); } },
    { id: 'review', icon: '✨', label: 'Year in review', keywords: 'stats summary share', run: () => setSheet('review') },
    { id: 'import', icon: '📥', label: 'Import quests', keywords: 'todoist csv reminders backup', run: () => setSheet('import') },
    { id: 'settings', icon: '⚙︎', label: 'Settings', keywords: 'preferences export theme', run: () => setSheet('settings') },
    { id: 'appearance', icon: '🌓', label: 'Switch light / dark', keywords: 'theme appearance mode', run: () => updatePrefs({ appearance: document.documentElement.dataset.scheme === 'light' ? 'dark' : 'light' }) },
    { id: 'categories', icon: '🏷️', label: 'Edit categories', run: () => setSheet('categories') },
    { id: 'shortcuts', icon: '⌨️', label: 'Keyboard shortcuts', shortcut: '?', run: () => setSheet('shortcuts') },
  ];
  const renderTask = (t: Task, draggable: boolean) => (
    <TaskItem
      key={t.id}
      task={t}
      category={categoryById.get(t.categoryId ?? '')}
      stats={stats}
      selected={selectedId === t.id}
      onDragStart={onBoard ? boardDrag.start : draggable ? drag.start : undefined}
      dragStyle={onBoard ? boardDrag.styleFor(t.id) : draggable ? drag.styleFor(t.id) : undefined}
      dragging={(onBoard ? boardDrag.draggingId : drag.draggingId) === t.id}
      onToggle={toggle}
      onSnooze={(task) => snooze(task)}
      onFocus={startFocus}
      onStep={toggleStep}
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

      <main className={`app has-tabbar ${drag.draggingId || boardDrag.draggingId ? 'is-dragging' : ''} ${onBoard ? 'board-view' : ''}`}>
        <div className="topbar">
          {tab !== 'tasks' ? (
            <h1 className="page-title">{TAB_TITLES[tab]}</h1>
          ) : (
            <h1 className="brand">
              <LogoMark size={34} />
              <Wordmark />
            </h1>
          )}
          <div className="topbar-actions">
            {/* The iPhone app leaves these to the Profile tab; on the web they keep sign-in in reach. */}
            {isNative ? null : cloud.status === 'signedIn' && cloud.user ? (
              <button
                className={`account-btn sync-${cloud.sync}`}
                onClick={() => changeTab('profile')}
                aria-label={`Profile: ${cloud.user.email ?? ''}. ${SYNC_LABEL[cloud.sync]}`}
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
            <button className="icon-btn glass-soft" onClick={() => setSheet('palette')} aria-label="Commands and search" title="Commands (⌘K)">
              ⌘
            </button>
            <button className="icon-btn glass-soft" onClick={() => setSheet('settings')} aria-label="Settings">
              ⚙︎
            </button>
          </div>
        </div>

        {tab === 'trophies' && (
          <div className="page">
            <TrophiesPanel stats={stats} categories={categories} />
          </div>
        )}
        {tab === 'calendar' && (
          <CalendarView
            tasks={tasks}
            stats={stats}
            categories={categories}
            mode={prefs.calendarMode}
            onMode={(calendarMode) => updatePrefs({ calendarMode })}
            onAdd={(t: NewTask) => dispatch({ type: 'addTask', ...t })}
            onMove={(id, day) => dispatch({ type: 'updateTask', id, patch: { dueDate: day } })}
            onToggle={toggle}
            onOpen={(t) => setEditingId(t.id)}
            renderTask={(t) => renderTask(t, false)}
            loadEvents={loadEvents}
          />
        )}
        {tab === 'profile' && (
          <div className="page">
            <ProfileView
              state={state}
              user={cloud.user}
              sync={cloud.sync}
              onOpenAccount={() => setSheet('account')}
              onSignOut={cloud.signOut}
              onOpenTrophies={openTrophies}
              onYearReview={() => setSheet('review')}
            />
          </div>
        )}

        {tab === 'tasks' && (
          <>
            {/* On phones these two wrappers vanish (display: contents) and their children
                stack in one column; on wide screens they become a sidebar and a main column. */}
            <aside className="sidebar">
              <Header
                stats={stats}
                pulse={pulse}
                onOpenTrophies={openTrophies}
                surprise={surpriseTask}
                onSurprise={(t) => {
                  setSelectedId(t.id);
                  setEditingId(t.id);
                }}
              />

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
                onTemplates={() => setSheet('templates')}
              />

              <div className="tools-row">
                <button className="chip tool-chip" onClick={() => setSheet('plan')}>
                  ☀️ Plan my day
                </button>
                <button className="chip tool-chip" onClick={() => setSheet('templates')}>
                  📋 Templates
                </button>
                <button className="chip tool-chip" onClick={() => startFocus(null)}>
                  🎧 Focus
                </button>
                <div className="segmented view-toggle" role="radiogroup" aria-label="View">
                  {(['list', 'board'] as const).map((v) => (
                    <button key={v} role="radio" aria-checked={prefs.view === v} className={`seg ${prefs.view === v ? 'active' : ''}`} onClick={() => updatePrefs({ view: v })}>
                      {v === 'list' ? '☰ List' : '▦ Board'}
                    </button>
                  ))}
                </div>
              </div>

              {(filter === 'today' || activeDay === today) && !q && todayMinutes > prefs.hoursPerDay * 60 && (
                <div className="overplan glass-soft" role="status">
                  <span aria-hidden="true">⏳</span>
                  <span>
                    About <strong>{formatEstimate(todayMinutes)}</strong> planned for today, more than your {prefs.hoursPerDay} h.{' '}
                    <button className="link-btn inline" onClick={() => setSheet('plan')}>
                      Re-plan
                    </button>{' '}
                    or snooze something (swipe left, or 💤).
                  </span>
                </div>
              )}

              <section className="tasks" aria-label="Tasks">
                <div className="list-toolbar">
                  <h2 className="list-title">
                    {listTitle}
                    <span className="muted">
                      {' '}· {open.length} open{listMinutes > 0 ? ` · ~${formatEstimate(listMinutes)}` : ''}
                    </span>
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

                {onBoard ? (
                  <Board open={open} done={done} over={boardDrag.over} renderTask={(t) => renderTask(t, false)} />
                ) : open.length === 0 ? (
                  <div className="empty glass-soft">
                    <span className="empty-icon">
                      {done.length && !q ? '🎉' : emptyMessage.icon === 'logo' ? <LogoMark size={56} /> : emptyMessage.icon}
                    </span>
                    <p>{done.length && !q ? 'All clear! Every quest here is done.' : emptyMessage.text}</p>
                  </div>
                ) : (
                  <ul className="task-list">{open.map((t) => renderTask(t, true))}</ul>
                )}

                {!onBoard && done.length > 0 && (
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
          </>
        )}
      </main>

      <FocusTimer timer={focus} />

      <TabBar tab={tab} onChange={changeTab} dueCount={todayCount} collapsed={prefs.railCollapsed} onToggleCollapsed={toggleRail} />

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
            <div className="levelup-mark"><LogoMark size={64} /></div>
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
          onFocus={() => startFocus(editing)}
          onSaveTemplate={(template) => {
            dispatch({ type: 'saveTemplate', template });
            pushToast({ icon: '📋', title: 'Saved as a template', body: template.name });
          }}
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
          onDeleteAccount={cloud.deleteAccount}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'shortcuts' && <ShortcutsHelp onClose={() => setSheet(null)} />}
      {sheet === 'plan' && (
        <PlanDay
          tasks={tasks}
          categories={categories}
          hoursPerDay={prefs.hoursPerDay}
          onHoursPerDay={(hoursPerDay) => updatePrefs({ hoursPerDay })}
          onPlan={plan}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'templates' && (
        <Templates templates={state.templates} categories={categories} onUse={addFromTemplate} dispatch={dispatch} onClose={() => setSheet(null)} />
      )}
      {sheet === 'import' && (
        <ImportSheet dispatch={dispatch} onDone={(title) => pushToast({ icon: '📥', title })} onClose={() => setSheet(null)} />
      )}
      {sheet === 'review' && <YearReview state={state} onClose={() => setSheet(null)} />}
      {sheet === 'palette' && (
        <CommandPalette
          commands={commands}
          tasks={tasks}
          onOpenTask={(t) => {
            changeTab('tasks');
            setSelectedId(t.id);
            setEditingId(t.id);
          }}
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
          onImport={() => setSheet('import')}
          dispatch={dispatch}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}
