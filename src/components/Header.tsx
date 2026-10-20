import { dayKey } from '../core/dates';
import { effectiveStreak, levelFromXp, streakMultiplier } from '../core/gamification';
import type { Stats, Task } from '../core/types';
import { ProgressRing } from './ProgressRing';

interface Props {
  stats: Stats;
  pulse: number; // bumps whenever XP is gained, to retrigger the glow animation
  onOpenTrophies: () => void;
  /** Today's double-XP quest, if it's still open. */
  surprise: Task | undefined;
  onSurprise: (task: Task) => void;
}

export function Header({ stats, pulse, onOpenTrophies, surprise, onSurprise }: Props) {
  const level = levelFromXp(stats.xp);
  const streak = effectiveStreak(stats);
  const doneToday = stats.completionsByDay[dayKey()] ?? 0;
  const goalProgress = doneToday / stats.dailyGoal;
  const bonus = Math.round((streakMultiplier(streak) - 1) * 100);

  return (
    <section className="hero glass" aria-label="Your progress">
      <div className="hero-top">
        <button className="level-badge" onClick={onOpenTrophies} aria-label={`Level ${level.level}, open trophies`}>
          <span className={`level-num ${level.level >= 100 ? 'three' : ''}`}>{level.level}</span>
          <span className="level-cap">LVL</span>
        </button>
        <div className="hero-title">
          <div className="hero-rank">{level.title}</div>
          <div className="xp-bar" key={pulse} role="progressbar" aria-valuemin={0} aria-valuemax={level.needed} aria-valuenow={level.intoLevel}>
            <div className="xp-fill" style={{ width: `${level.progress * 100}%` }} />
          </div>
          <div className="xp-text">
            {level.max ? (
              <>
                Max level <span className="muted">· {stats.xp.toLocaleString()} XP total</span>
              </>
            ) : (
              <>
                {level.intoLevel} / {level.needed} XP <span className="muted">to level {level.level + 1}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="hero-stats">
        <div className="stat-pill">
          <span className={`flame ${streak > 0 ? 'lit' : ''}`}>🔥</span>
          <div>
            <strong>{streak}</strong> day{streak === 1 ? '' : 's'}
            <div className="muted small">
              {bonus > 0 ? `+${bonus}% XP bonus` : 'Start a streak'}
              {stats.streakFreezes > 0 && (
                <span className="freeze-count" title={`${stats.streakFreezes} streak freeze${stats.streakFreezes === 1 ? '' : 's'}: each covers a missed day`}>
                  {' '}· 🧊{stats.streakFreezes}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="stat-pill">
          <ProgressRing progress={goalProgress} size={44} stroke={5}>
            {goalProgress >= 1 ? '✓' : doneToday}
          </ProgressRing>
          <div>
            <strong>{Math.min(doneToday, stats.dailyGoal)}/{stats.dailyGoal}</strong> today
            <div className="muted small">{goalProgress >= 1 ? 'Goal smashed!' : 'Daily goal'}</div>
          </div>
        </div>
        <button className="stat-pill trophy-pill" onClick={onOpenTrophies}>
          <span className="big-emoji">🏆</span>
          <div>
            <strong>{Object.keys(stats.achievements).length}</strong>
            <div className="muted small">Trophies</div>
          </div>
        </button>
      </div>

      {surprise && (
        <button className="surprise-banner" onClick={() => onSurprise(surprise)}>
          <span aria-hidden="true">🍀</span>
          <span>
            <strong>Today’s surprise:</strong> {surprise.title}
            <span className="muted"> pays double XP</span>
          </span>
        </button>
      )}
    </section>
  );
}
