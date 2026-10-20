import { useState, type ReactNode } from 'react';
import { addDays, dayKey } from '../core/dates';
import type { Category, Stats, Task } from '../core/types';
import { QuickAdd } from './QuickAdd';

interface Props {
  tasks: Task[];
  stats: Stats;
  categories: Category[];
  onAdd: Parameters<typeof QuickAdd>[0]['onAdd'];
  renderTask: (task: Task) => ReactNode;
}

const parse = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** A month of quests: dots for what's due each day, and the picked day's list below. */
export function CalendarView({ tasks, stats, categories, onAdd, renderTask }: Props) {
  const today = dayKey();
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => today.slice(0, 7)); // "2026-10"

  const [y, m] = month.split('-').map(Number);
  const first = dayKey(new Date(y, m - 1, 1));
  // Six Sunday-first weeks always cover the month, so the grid never jumps in height.
  const start = addDays(first, -parse(first).getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weekdays = cells.slice(0, 7).map((d) => parse(d).toLocaleDateString(undefined, { weekday: 'narrow' }));
  const shiftMonth = (n: number) => setMonth(dayKey(new Date(y, m - 1 + n, 1)).slice(0, 7));

  const open = tasks.filter((t) => !t.completedAt && t.dueDate);
  const dueOn = (d: string) => open.filter((t) => t.dueDate === d).length;

  const dayTasks = tasks.filter((t) => t.dueDate === selected);
  const overdue = selected === today ? open.filter((t) => t.dueDate! < today) : [];
  const dayOpen = dayTasks.filter((t) => !t.completedAt);
  const dayDone = dayTasks.filter((t) => t.completedAt);
  const doneCount = stats.completionsByDay[selected] ?? 0;

  const pick = (d: string) => {
    setSelected(d);
    if (d.slice(0, 7) !== month) setMonth(d.slice(0, 7));
  };

  return (
    <div className="calendar-page">
      <section className="calendar glass" aria-label="Calendar">
        <div className="calendar-head">
          <h2>{parse(first).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <div className="calendar-nav">
            {(selected !== today || month !== today.slice(0, 7)) && (
              <button className="btn calendar-today" onClick={() => pick(today)}>
                Today
              </button>
            )}
            <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
            <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
          </div>
        </div>
        <div className="calendar-grid">
          {weekdays.map((w, i) => (
            <span key={i} className="calendar-wd" aria-hidden="true">{w}</span>
          ))}
          {cells.map((d) => {
            const n = dueOn(d);
            const late = n > 0 && d < today;
            const date = parse(d);
            return (
              <button
                key={d}
                className={[
                  'calendar-day',
                  d.slice(0, 7) !== month && 'outside',
                  d === today && 'today',
                  d === selected && 'selected',
                  (stats.completionsByDay[d] ?? 0) > 0 && 'did',
                ].filter(Boolean).join(' ')}
                aria-pressed={d === selected}
                aria-label={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}: ${n} due`}
                onClick={() => pick(d)}
              >
                <span className="calendar-num">{date.getDate()}</span>
                <span className={`calendar-dots ${late ? 'late' : ''}`} aria-hidden="true">
                  {Array.from({ length: Math.min(n, 3) }, (_, i) => <i key={i} />)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="calendar-day-list" aria-label="Quests on the selected day">
        <h2 className="calendar-day-title">
          {selected === today ? 'Today' : parse(selected).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          <span className="muted"> · {dayOpen.length + overdue.length} open{doneCount ? ` · ${doneCount} done` : ''}</span>
        </h2>

        {selected >= today && (
          <QuickAdd key={selected} categories={categories} defaultCategoryId={null} defaultDue={selected} onAdd={onAdd} />
        )}

        {overdue.length > 0 && (
          <>
            <h3 className="calendar-sub late">Overdue</h3>
            <ul className="task-list">{overdue.map(renderTask)}</ul>
          </>
        )}
        {dayOpen.length > 0 && (
          <>
            {overdue.length > 0 && <h3 className="calendar-sub">Due today</h3>}
            <ul className="task-list">{dayOpen.map(renderTask)}</ul>
          </>
        )}
        {dayOpen.length + overdue.length === 0 && (
          <p className="empty glass-soft calendar-empty">
            {selected < today ? 'Nothing was due this day.' : 'Nothing due. Add a quest for this day above.'}
          </p>
        )}
        {dayDone.length > 0 && (
          <>
            <h3 className="calendar-sub">Completed</h3>
            <ul className="task-list">{dayDone.map(renderTask)}</ul>
          </>
        )}
      </section>
    </div>
  );
}
