import type { CloudUser } from '../cloud/api';
import type { SyncStatus } from '../cloud/useCloudSync';
import { currentWeek } from '../core/challenges';
import { addDays, dayKey } from '../core/dates';
import { ACHIEVEMENTS, effectiveStreak, levelFromXp } from '../core/gamification';
import type { AppState } from '../core/types';
import { Avatar, SYNC_LABEL } from './AccountSheet';
import { Sheet } from './Sheet';

interface Props {
  state: AppState;
  user: CloudUser | null;
  sync: SyncStatus;
  onSignIn: () => void;
  onSignOut: () => Promise<void>;
  onOpenTrophies: () => void;
  onClose: () => void;
}

const WEEKS = 15;

/** Your stats at a glance: level, XP, tasks done, streaks, activity and trophies. */
export function ProfileSheet({ state, user, sync, onSignIn, onSignOut, onOpenTrophies, onClose }: Props) {
  const { stats, tasks, categories } = state;
  const level = levelFromXp(stats.xp);
  const today = dayKey();
  const sum = (days: number) =>
    Array.from({ length: days }, (_, i) => stats.completionsByDay[addDays(today, -i)] ?? 0).reduce((a, b) => a + b, 0);
  const week = currentWeek(stats, categories);
  const earned = ACHIEVEMENTS.filter((a) => stats.achievements[a.id]).sort(
    (a, b) => stats.achievements[b.id] - stats.achievements[a.id],
  );
  const open = tasks.filter((t) => !t.completedAt);

  // Heatmap: columns are weeks (Sunday first), the last one is this week.
  const thisSunday = addDays(today, -new Date().getDay());
  const start = addDays(thisSunday, -(WEEKS - 1) * 7);
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(start, i));
  const peak = Math.max(1, ...cells.map((d) => stats.completionsByDay[d] ?? 0));
  const shade = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / peak) * 4)));

  const byCategory = [
    ...categories.map((c) => ({ label: `${c.emoji} ${c.name}`, color: c.color, id: c.id as string | null })),
    { label: 'No category', color: 'var(--muted-color)', id: null },
  ]
    .map((c) => ({ ...c, n: tasks.filter((t) => (t.categoryId ?? null) === c.id || (c.id === null && !categories.some((x) => x.id === t.categoryId))).length }))
    .filter((c) => c.n > 0);
  const maxCat = Math.max(1, ...byCategory.map((c) => c.n));

  return (
    <Sheet title="Profile" onClose={onClose}>
      <div className="profile-head">
        {user ? <Avatar user={user} size={72} /> : <span className="avatar avatar-initial guest" style={{ width: 72, height: 72, fontSize: 30 }}>?</span>}
        <div className="profile-id">
          <strong className="profile-name">{user ? (user.name ?? user.email) : 'Guest'}</strong>
          <span className="muted small">
            Level {level.level} · {level.title}
          </span>
          {user ? (
            <span className={`sync-line sync-${sync}`}>
              <span className="sync-dot" /> {SYNC_LABEL[sync]}
            </span>
          ) : (
            <span className="muted small">Progress is saved on this device only.</span>
          )}
        </div>
      </div>

      <div className="xp-bar profile-xp" role="progressbar" aria-valuemin={0} aria-valuemax={level.needed} aria-valuenow={level.intoLevel}>
        <div className="xp-fill" style={{ width: `${level.progress * 100}%` }} />
      </div>
      <p className="muted small profile-xp-text">
        {level.max ? `Max level · ${stats.xp.toLocaleString()} XP` : `${level.intoLevel.toLocaleString()} / ${level.needed.toLocaleString()} XP to level ${level.level + 1}`}
      </p>

      <div className="profile-stats">
        {[
          [stats.xp.toLocaleString(), 'Total XP'],
          [stats.totalCompleted.toLocaleString(), 'Tasks done'],
          [sum(7), 'Last 7 days'],
          [sum(30), 'Last 30 days'],
          [effectiveStreak(stats), 'Day streak'],
          [stats.bestStreak, 'Best streak'],
          [stats.onTimeCompleted.toLocaleString(), 'Done on time'],
          [open.length, 'Open now'],
        ].map(([value, label]) => (
          <div key={label} className="stat-card glass-soft">
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <h3>Activity</h3>
      <div className="heatmap glass-soft" role="img" aria-label={`Tasks completed per day over the last ${WEEKS} weeks`}>
        <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)` }}>
          {cells.map((d) => {
            const n = stats.completionsByDay[d] ?? 0;
            return <span key={d} className={`heat h${d > today ? 'f' : shade(n)}`} title={`${d}: ${n} done`} />;
          })}
        </div>
        <div className="heatmap-legend muted small">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((h) => <span key={h} className={`heat h${h}`} />)}
          <span>More</span>
        </div>
      </div>

      {byCategory.length > 0 && (
        <>
          <h3>Tasks by category</h3>
          <div className="cat-bars glass-soft">
            {byCategory.map((c) => (
              <div key={c.label} className="cat-bar-row">
                <span className="cat-bar-label">{c.label}</span>
                <div className="cat-bar"><div style={{ width: `${(c.n / maxCat) * 100}%`, background: c.color }} /></div>
                <span className="cat-bar-n">{c.n}</span>
              </div>
            ))}
            <p className="muted small">Counts the tasks in your list, open and completed.</p>
          </div>
        </>
      )}

      <h3>
        Trophies <span className="muted">{earned.length}/{ACHIEVEMENTS.length}</span>
      </h3>
      <div className="profile-trophies">
        {earned.slice(0, 6).map((a) => (
          <div key={a.id} className="badge glass-soft earned" title={a.description}>
            <span className="badge-icon">{a.icon}</span>
            <strong>{a.name}</strong>
          </div>
        ))}
        {earned.length === 0 && <p className="muted small">Complete your first quest to earn a trophy.</p>}
      </div>
      <div className="profile-meta muted small">
        This week: {week.completed} done · {week.claimed.length}/{week.challenges.length} challenges ·{' '}
        <button className="link-btn inline" onClick={onOpenTrophies}>
          See all trophies
        </button>
      </div>

      <div className="profile-actions">
        {user ? (
          <button className="btn" onClick={async () => { await onSignOut(); onClose(); }}>
            Sign out
          </button>
        ) : (
          <button className="btn primary" onClick={onSignIn}>
            Sign in to sync across devices
          </button>
        )}
      </div>
    </Sheet>
  );
}
