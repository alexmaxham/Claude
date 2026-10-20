import { challengeProgress, currentWeek, describeChallenge } from '../core/challenges';
import { addDays, dayKey, daysBetween } from '../core/dates';
import type { Category, Stats } from '../core/types';

/** This week's three challenges with progress bars. */
export function WeeklyChallenges({ stats, categories, compact }: { stats: Stats; categories: Category[]; compact?: boolean }) {
  const week = currentWeek(stats, categories);
  const left = daysBetween(dayKey(), addDays(week.key, 7));

  return (
    <section className={`challenges ${compact ? 'compact glass-soft' : ''}`} aria-label="Weekly challenges">
      {compact && (
        <header className="challenges-head">
          <strong>Weekly challenges</strong>
          <span className="muted small">{left === 1 ? 'Last day' : `${left} days left`}</span>
        </header>
      )}
      <ul>
        {week.challenges.map((c) => {
          const { icon, text } = describeChallenge(c, categories);
          const n = challengeProgress(week, c);
          const claimed = week.claimed.includes(c.id);
          return (
            <li key={c.id} className={`challenge ${claimed ? 'claimed' : ''} ${compact ? '' : 'glass-soft'}`}>
              <span className="challenge-icon" aria-hidden="true">{claimed ? '✅' : icon}</span>
              <div className="challenge-body">
                <div className="challenge-text">
                  <span>{text}</span>
                  <span className="challenge-reward">{claimed ? 'Done' : `+${c.reward} XP`}</span>
                </div>
                <div className="mini-bar" role="progressbar" aria-valuemin={0} aria-valuemax={c.target} aria-valuenow={n} aria-label={text}>
                  <div style={{ width: `${(n / c.target) * 100}%` }} />
                </div>
                <span className="muted small">{n}/{c.target}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
