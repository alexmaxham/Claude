import { useState } from 'react';
import { addDays, dayKey } from '../core/dates';
import { ACHIEVEMENTS, levelFromXp } from '../core/gamification';
import { isThemeUnlocked, THEMES, type Action } from '../core/store';
import type { Category, Stats, ThemeId } from '../core/types';
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
  stats: Stats;
  categories: Category[];
  theme: ThemeId;
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

function SettingsPanel({
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
      <div className="setting setting-wrap">
        <span>
          Daily reminder
          <span className="muted small" style={{ display: 'block' }}>
            Lists quests due today. Works while Questlog is open in a tab.
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
  );
}
