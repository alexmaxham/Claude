import { addDays, dayKey } from '../core/dates';
import type { Task } from '../core/types';

interface Props {
  tasks: Task[];
  selectedDay: string | null;
  onSelect: (day: string | null) => void;
}

/** The next seven days with how many open quests are due on each; tap a day to filter. */
export function WeekStrip({ tasks, selectedDay, onSelect }: Props) {
  const today = dayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const open = tasks.filter((t) => !t.completedAt && t.dueDate);
  const count = (d: string) => open.filter((t) => (d === today ? t.dueDate! <= today : t.dueDate === d)).length;

  return (
    <nav className="week-strip glass-soft" aria-label="Upcoming week">
      {days.map((d) => {
        const [y, m, dd] = d.split('-').map(Number);
        const date = new Date(y, m - 1, dd);
        const n = count(d);
        const active = selectedDay === d;
        return (
          <button
            key={d}
            className={`week-day-btn ${active ? 'active' : ''} ${d === today ? 'today' : ''}`}
            aria-pressed={active}
            aria-label={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}: ${n} due`}
            onClick={() => onSelect(active ? null : d)}
          >
            <span className="wd">{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
            <span className="dn">{dd}</span>
            <span className="dots" aria-hidden="true">
              {n > 0 ? (n > 3 ? <span className="dot-count">{n}</span> : Array.from({ length: n }, (_, i) => <i key={i} />)) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
