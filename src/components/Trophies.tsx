import { useState } from 'react';
import { addDays, dayKey } from '../core/dates';
import { ACHIEVEMENTS, levelFromXp } from '../core/gamification';
import { THEMES, type Action } from '../core/store';
import type { Stats, ThemeId } from '../core/types';
import { Sheet } from './Sheet';

export type TrophiesTab = 'trophies' | 'settings';

const TABS: { id: TrophiesTab; label: string; title: string }[] = [
  { id: 'trophies', label: '🏆 Trophies', title: 'Trophies & stats' },
  { id: 'settings', label: '⚙︎ Settings', title: 'Settings' },
];

interface Props {
  initialTab: TrophiesTab;
  stats: Stats;
  theme: ThemeId;
  soundOn: boolean;
  signedIn: boolean;
  onToggleSound: () => void;
  dispatch: (a: Action) => void;
  onClose: () => void;
}

export function Trophies({ initialTab, stats, theme, soundOn, signedIn, onToggleSound, dispatch, onClose }: Props) {
  const [tab, setTab] = useState(initialTab);

  return (
    <Sheet title={TABS.find((t) => t.id === tab)!.title} onClose={onClose}>
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
          <TrophiesPanel stats={stats} />
        ) : (
          <SettingsPanel
            stats={stats}
            theme={theme}
            soundOn={soundOn}
            signedIn={signedIn}
            onToggleSound={onToggleSound}
            dispatch={dispatch}
            onClose={onClose}
          />
        )}
      </div>
    </Sheet>
  );
}

function TrophiesPanel({ stats }: { stats: Stats }) {
  const level = levelFromXp(stats.xp);
  const today = dayKey();
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const max = Math.max(stats.dailyGoal, ...week.map((d) => stats.completionsByDay[d] ?? 0));

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card glass-soft"><strong>{level.level}</strong><span>Level</span></div>
        <div className="stat-card glass-soft"><strong>{stats.xp}</strong><span>Total XP</span></div>
        <div className="stat-card glass-soft"><strong>{stats.totalCompleted}</strong><span>Completed</span></div>
        <div className="stat-card glass-soft"><strong>{stats.bestStreak}</strong><span>Best streak</span></div>
      </div>

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
        {ACHIEVEMENTS.map((a) => {
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

function SettingsPanel({ stats, theme, soundOn, signedIn, onToggleSound, dispatch, onClose }: Omit<Props, 'initialTab'>) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="settings glass-soft">
      <div className="setting">
        <span>Color</span>
        <div className="theme-swatches" role="radiogroup" aria-label="App color">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={theme === t.id}
              aria-label={t.name}
              title={t.name}
              className={`swatch theme-swatch ${theme === t.id ? 'active' : ''}`}
              style={{ background: t.color }}
              onClick={() => dispatch({ type: 'setTheme', theme: t.id })}
            />
          ))}
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
