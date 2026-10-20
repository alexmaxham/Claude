import { useState } from 'react';
import { addDays, dayKey } from '../core/dates';
import type { Appearance } from '../appearance';
import type { SyncResult } from '../cloud/calendar';
import { authErrorMessage } from '../cloud/errors';
import { ACHIEVEMENTS, levelFromXp, levelTitle, MAX_LEVEL, xpForLevel } from '../core/gamification';
import { toCsv, toJson, toMarkdown, toTodoistCsv } from '../core/export';
import { isThemeUnlocked, THEMES, type Action } from '../core/store';
import type { AppState, Category, Stats, ThemeId } from '../core/types';
import { download } from '../download';
import { notificationsSupported } from '../useReminders';
import { Sheet } from './Sheet';
import { WeeklyChallenges } from './WeeklyChallenges';

export type TrophiesTab = 'trophies' | 'settings';

const TABS: { id: TrophiesTab; label: string; title: string }[] = [
  { id: 'trophies', label: '🏆 Trophies', title: 'Trophies & stats' },
  { id: 'settings', label: '⚙︎ Settings', title: 'Settings' },
];

interface Props {
  initialTab: TrophiesTab;
  state: AppState;
  stats: Stats;
  categories: Category[];
  theme: ThemeId;
  appearance: Appearance;
  onAppearance: (a: Appearance) => void;
  /** Present when signed in: syncs open, dated tasks to Google Calendar. */
  syncCalendar: (() => Promise<SyncResult>) | null;
  soundOn: boolean;
  reminders: { on: boolean; time: string };
  onReminders: (r: { on: boolean; time: string }) => void;
  signedIn: boolean;
  onToggleSound: () => void;
  dispatch: (a: Action) => void;
  onClose: () => void;
}

export function Trophies({ initialTab, stats, categories, ...settings }: Props) {
  const [tab, setTab] = useState(initialTab);

  return (
    <Sheet title={TABS.find((t) => t.id === tab)!.title} onClose={settings.onClose}>
      <div className="segmented sheet-tabs" role="tablist" aria-label="Section">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={`seg ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'trophies' ? (
          <TrophiesPanel stats={stats} categories={categories} />
        ) : (
          <SettingsPanel stats={stats} {...settings} />
        )}
      </div>
    </Sheet>
  );
}

function TrophiesPanel({ stats, categories }: { stats: Stats; categories: Category[] }) {
  const level = levelFromXp(stats.xp);
  const today = dayKey();
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const max = Math.max(stats.dailyGoal, ...week.map((d) => stats.completionsByDay[d] ?? 0));

  return (
    <>
        <div className="stat-grid">
          <div className="stat-card glass-soft"><strong>{level.level}</strong><span>Level</span></div>
          <div className="stat-card glass-soft"><strong>{stats.xp.toLocaleString()}</strong><span>Total XP</span></div>
          <div className="stat-card glass-soft"><strong>{stats.totalCompleted}</strong><span>Completed</span></div>
          <div className="stat-card glass-soft"><strong>{stats.bestStreak}</strong><span>Best streak</span></div>
        </div>

        <h3>Level milestones</h3>
        <Milestones xp={stats.xp} />

        <h3>This week’s challenges</h3>
        <WeeklyChallenges stats={stats} categories={categories} />

        <h3>Last 7 days</h3>
        <div className="week glass-soft" role="img" aria-label="Tasks completed over the last 7 days">
          {week.map((d) => {
            const n = stats.completionsByDay[d] ?? 0;
            const [y, m, dd] = d.split('-').map(Number);
            return (
              <div key={d} className={`week-col ${n >= stats.dailyGoal ? 'hit' : n > 0 ? 'some' : ''}`}>
                <span className="week-n">{n || ''}</span>
                <div className="week-bar" style={{ height: `${(n / max) * 100}%` }} />
                <span className="week-day">{new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              </div>
            );
          })}
        </div>

        <h3>
          Achievements <span className="muted">{Object.keys(stats.achievements).length}/{ACHIEVEMENTS.length}</span>
        </h3>
        <div className="badges">
          {/* Earned first (in the order they were defined), then the ones still to get. */}
          {[...ACHIEVEMENTS].sort((a, b) => Number(!stats.achievements[a.id]) - Number(!stats.achievements[b.id])).map((a) => {
            const at = stats.achievements[a.id];
            return (
              <div key={a.id} className={`badge glass-soft ${at ? 'earned' : 'locked'}`} title={a.description}>
                <span className="badge-icon">{at ? a.icon : '🔒'}</span>
                <strong>{a.name}</strong>
                <span className="muted small">{a.description}</span>
              </div>
            );
          })}
        </div>
    </>
  );
}

/** Big levels ahead (and behind) with the XP still needed and what each one unlocks. */
function Milestones({ xp }: { xp: number }) {
  const current = levelFromXp(xp).level;
  const rewards = new Map<number, string[]>();
  const add = (level: number, what: string) => rewards.set(level, [...(rewards.get(level) ?? []), what]);
  for (const t of THEMES) if (t.unlockLevel) add(t.unlockLevel, `${t.name} theme`);
  for (const a of ACHIEVEMENTS) if (a.level) add(a.level, `${a.icon} ${a.name}`);
  for (const l of [25]) if (!rewards.has(l)) add(l, levelTitle(l));
  const levels = [...rewards.keys()].sort((a, b) => a - b);
  const upcoming = levels.filter((l) => l > current);
  const reached = levels.filter((l) => l <= current);

  return (
    <div className="milestones glass-soft">
      {upcoming.slice(0, 5).map((l, i) => {
        const need = xpForLevel(l);
        const left = Math.max(0, need - xp);
        return (
          <div key={l} className={`milestone ${i === 0 ? 'next' : ''}`}>
            <div className="milestone-level">
              <span className="milestone-num">{l}</span>
              <span className="muted small">{levelTitle(l)}</span>
            </div>
            <div className="milestone-body">
              <div className="milestone-text">
                <span>{rewards.get(l)!.join(' · ')}</span>
                <strong>{left.toLocaleString()} XP to go</strong>
              </div>
              <div className="mini-bar" role="progressbar" aria-valuemin={0} aria-valuemax={need} aria-valuenow={xp} aria-label={`Progress to level ${l}`}>
                <div style={{ width: `${Math.min(100, (xp / need) * 100)}%` }} />
              </div>
            </div>
          </div>
        );
      })}
      {upcoming.length === 0 && <p className="muted small milestone-done">You’ve reached level {MAX_LEVEL}. Every milestone is yours.</p>}
      {reached.length > 0 && (
        <p className="muted small milestone-done">
          Reached: {reached.map((l) => `Lv ${l}`).join(', ')}
        </p>
      )}
    </div>
  );
}

const APPEARANCES: { id: Appearance; label: string }[] = [
  { id: 'system', label: 'Auto' },
  { id: 'light', label: '☀︎ Light' },
  { id: 'dark', label: '☾ Dark' },
];

function ExportButtons({ state }: { state: AppState }) {
  const stamp = new Date().toISOString().slice(0, 10);
  const formats = [
    { label: 'Todoist', hint: 'CSV template', run: () => download(`tasko-todoist-${stamp}.csv`, toTodoistCsv(state), 'text/csv') },
    { label: 'Spreadsheet', hint: 'CSV', run: () => download(`tasko-${stamp}.csv`, toCsv(state), 'text/csv', { bom: true }) },
    { label: 'Checklist', hint: 'Markdown', run: () => download(`tasko-${stamp}.md`, toMarkdown(state), 'text/markdown') },
    { label: 'Backup', hint: 'JSON', run: () => download(`tasko-backup-${stamp}.json`, toJson(state), 'application/json') },
  ];
  return (
    <div className="export-grid">
      {formats.map((f) => (
        <button key={f.label} className="btn export-btn" onClick={f.run}>
          <strong>{f.label}</strong>
          <span className="muted small">{f.hint}</span>
        </button>
      ))}
    </div>
  );
}

const CALENDAR_API_URL = 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=questlog2-e03f9';

function CalendarSync({ sync }: { sync: (() => Promise<SyncResult>) | null }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; notEnabled?: boolean } | null>(null);

  const run = async () => {
    if (!sync) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await sync();
      const parts = [r.created && `${r.created} added`, r.updated && `${r.updated} updated`, r.removed && `${r.removed} removed`].filter(Boolean);
      setResult(parts.length ? `Synced: ${parts.join(', ')}.` : 'Already up to date.');
    } catch (e) {
      const kind = (e as { kind?: string }).kind;
      if (kind === 'notEnabled') setError({ text: (e as Error).message, notEnabled: true });
      else if ((e as { code?: string }).code) {
        const msg = authErrorMessage(e);
        if (msg) setError({ text: msg });
      } else setError({ text: (e as Error).message || 'Couldn’t sync with Google Calendar.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="setting setting-wrap">
      <span>
        Google Calendar
        <span className="muted small" style={{ display: 'block' }}>
          {sync
            ? 'Adds each open quest with a due date to your calendar as an all-day event, and removes ones you’ve finished.'
            : 'Sign in to sync your quests to Google Calendar.'}
        </span>
        {result && <span className="small success-text" style={{ display: 'block' }}>{result}</span>}
        {error && (
          <span className="small error-text" style={{ display: 'block' }}>
            {error.text}{' '}
            {error.notEnabled && (
              <a href={CALENDAR_API_URL} target="_blank" rel="noreferrer">
                Enable it here
              </a>
            )}
          </span>
        )}
      </span>
      <button className="btn" disabled={!sync || busy} onClick={run}>
        {busy ? 'Syncing…' : 'Sync now'}
      </button>
    </div>
  );
}

function SettingsPanel({
  state,
  appearance,
  onAppearance,
  syncCalendar,
  stats,
  theme,
  soundOn,
  signedIn,
  reminders,
  onReminders,
  onToggleSound,
  dispatch,
  onClose,
}: Omit<Props, 'initialTab' | 'categories'>) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const level = levelFromXp(stats.xp).level;

  const toggleReminders = async () => {
    setNotifyError(null);
    if (reminders.on) return onReminders({ ...reminders, on: false });
    if (!notificationsSupported()) return setNotifyError('This browser doesn’t support notifications.');
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return setNotifyError('Notifications are blocked. Allow them for this site in your browser settings.');
    onReminders({ ...reminders, on: true });
  };

  return (
    <>
    <div className="settings glass-soft">
      <div className="setting">
        <span>Color</span>
        <div className="theme-swatches" role="radiogroup" aria-label="App color">
          {THEMES.map((t) => {
            const locked = !isThemeUnlocked(t.id, level);
            const label = locked ? `${t.name}, unlocks at level ${t.unlockLevel}` : t.name;
            return (
              <button
                key={t.id}
                role="radio"
                aria-checked={theme === t.id}
                aria-disabled={locked}
                aria-label={label}
                title={label}
                className={`swatch theme-swatch ${theme === t.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
                style={{ background: t.color }}
                onClick={() => !locked && dispatch({ type: 'setTheme', theme: t.id })}
              >
                {locked && <span className="lock">🔒</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="setting">
        <span>Appearance</span>
        <div className="segmented appearance" role="radiogroup" aria-label="Appearance">
          {APPEARANCES.map((a) => (
            <button
              key={a.id}
              role="radio"
              aria-checked={appearance === a.id}
              className={`seg ${appearance === a.id ? 'active' : ''}`}
              onClick={() => onAppearance(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <div className="setting setting-wrap">
        <span>
          Daily reminder
          <span className="muted small" style={{ display: 'block' }}>
            Lists quests due today. Works while Tasko is open in a tab.
          </span>
          {notifyError && <span className="small error-text" style={{ display: 'block' }}>{notifyError}</span>}
        </span>
        <div className="reminder-controls">
          {reminders.on && (
            <input
              type="time"
              className="text-input time-input"
              value={reminders.time}
              onChange={(e) => e.target.value && onReminders({ ...reminders, time: e.target.value })}
              aria-label="Reminder time"
            />
          )}
          <button className={`toggle ${reminders.on ? 'on' : ''}`} role="switch" aria-checked={reminders.on} onClick={toggleReminders} aria-label="Daily reminder">
            <span />
          </button>
        </div>
      </div>
      <div className="setting">
        <span>Daily goal</span>
        <div className="stepper">
          <button className="icon-btn" onClick={() => dispatch({ type: 'setDailyGoal', goal: stats.dailyGoal - 1 })} aria-label="Decrease daily goal">−</button>
          <strong>{stats.dailyGoal}</strong>
          <button className="icon-btn" onClick={() => dispatch({ type: 'setDailyGoal', goal: stats.dailyGoal + 1 })} aria-label="Increase daily goal">+</button>
        </div>
      </div>
      <div className="setting">
        <span>Sounds</span>
        <button className={`toggle ${soundOn ? 'on' : ''}`} role="switch" aria-checked={soundOn} onClick={onToggleSound} aria-label="Sounds">
          <span />
        </button>
      </div>
      <div className="setting">
        <span>
          Reset all data
          {signedIn && <span className="muted small" style={{ display: 'block' }}>Also erases it from your account</span>}
        </span>
        {confirmReset ? (
          <span className="confirm-inline">
            <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
            <button className="btn danger" onClick={() => { dispatch({ type: 'reset' }); onClose(); }}>Erase everything</button>
          </span>
        ) : (
          <button className="btn danger" onClick={() => setConfirmReset(true)}>Reset</button>
        )}
      </div>
    </div>

    <h3>Connected apps</h3>
    <div className="settings glass-soft">
      <CalendarSync sync={syncCalendar} />
    </div>

    <h3>Export your tasks</h3>
    <p className="muted small export-intro">
      Take your quests to another app. <strong>Todoist</strong>: create a project, then ⋯ → Import from template.{' '}
      <strong>Spreadsheet</strong> opens in Excel, Numbers or Google Sheets. <strong>Checklist</strong> pastes into
      Things, Notion, Obsidian or Apple Notes. <strong>Backup</strong> keeps everything, including your progress.
    </p>
    <ExportButtons state={state} />
    </>
  );
}
