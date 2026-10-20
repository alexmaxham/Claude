import { useMemo, useState } from 'react';
import { reviewText, yearReview } from '../core/review';
import type { AppState } from '../core/types';
import { Sheet } from './Sheet';

/** The year at a glance, with a summary you can share. */
export function YearReview({ state, onClose }: { state: AppState; onClose: () => void }) {
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => {
    const ys = new Set(Object.keys(state.stats.completionsByDay).map((d) => Number(d.slice(0, 4))));
    ys.add(thisYear);
    return [...ys].sort((a, b) => b - a);
  }, [state, thisYear]);
  const [year, setYear] = useState(thisYear);
  const [copied, setCopied] = useState(false);
  const r = useMemo(() => yearReview(state, year), [state, year]);
  const peak = Math.max(1, ...r.months);
  const weekday = r.busiestWeekday === null ? '—' : new Date(2026, 0, 4 + r.busiestWeekday).toLocaleDateString(undefined, { weekday: 'long' });

  const share = async () => {
    const text = reviewText(r);
    try {
      if (navigator.share) return await navigator.share({ title: `My ${year} in Tasko`, text });
    } catch {
      return; // cancelled
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked; nothing else to do
    }
  };

  return (
    <Sheet title={`Your ${year}`} onClose={onClose}>
      {years.length > 1 && (
        <div className="chip-row review-years">
          {years.map((y) => (
            <button key={y} className={`chip ${y === year ? 'active' : ''}`} onClick={() => setYear(y)}>
              {y}
            </button>
          ))}
        </div>
      )}
      <div className="review-hero glass-soft">
        <span className="review-big">{r.completed.toLocaleString()}</span>
        <span>quests done on {r.activeDays} day{r.activeDays === 1 ? '' : 's'}</span>
      </div>
      <div className="profile-stats review-stats">
        {[
          [`${r.longestStreak} d`, 'Longest streak'],
          [r.bestDay ? r.bestDay.count : 0, 'Best day'],
          [weekday, 'Busiest day'],
          [r.topCategory ? `${r.topCategory.emoji} ${r.topCategory.name}` : '—', 'Top category'],
          [r.bosses, 'Bosses defeated'],
          [r.trophies.length, 'Trophies won'],
        ].map(([v, l]) => (
          <div key={l} className="stat-card glass-soft">
            <strong>{v}</strong>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <h3>Month by month</h3>
      <div className="review-months glass-soft" role="img" aria-label="Quests completed each month">
        {r.months.map((n, i) => (
          <div key={i} className="review-month">
            <div className="review-bar" style={{ height: `${(n / peak) * 100}%` }} title={`${n}`} />
            <span>{new Date(year, i, 1).toLocaleDateString(undefined, { month: 'narrow' })}</span>
          </div>
        ))}
      </div>
      {r.trophies.length > 0 && (
        <>
          <h3>Trophies this year</h3>
          <p className="review-trophies">{r.trophies.map((t) => `${t.icon} ${t.name}`).join(' · ')}</p>
        </>
      )}
      <div className="form-actions">
        <button className="btn primary" onClick={share}>
          {copied ? '✓ Copied' : '↗︎ Share'}
        </button>
      </div>
    </Sheet>
  );
}
