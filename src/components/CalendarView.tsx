import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { GoogleEvent } from '../cloud/calendar';
import { addDays, dayKey } from '../core/dates';
import { formatEstimate } from '../core/parse';
import type { NewTask } from '../core/store';
import type { Category, Stats, Task } from '../core/types';
import { useDropDrag } from '../useDropDrag';
import { QuickAdd } from './QuickAdd';

export type CalendarMode = 'month' | 'week';

interface Props {
  tasks: Task[];
  stats: Stats;
  categories: Category[];
  mode: CalendarMode;
  onMode: (m: CalendarMode) => void;
  onAdd: (task: NewTask) => void;
  onMove: (taskId: string, day: string) => void;
  onToggle: (task: Task, el: HTMLElement) => void;
  onOpen: (task: Task) => void;
  renderTask: (task: Task) => ReactNode;
  /** Present when signed in: the user's own Google Calendar events. */
  loadEvents: ((from: string, to: string) => Promise<GoogleEvent[]>) | null;
}

const parse = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** A month of quests (dots per day, the picked day's list beside it) or a week you can drag quests around in. */
export function CalendarView({ tasks, stats, categories, mode, onMode, onAdd, onMove, onToggle, onOpen, renderTask, loadEvents }: Props) {
  const today = dayKey();
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => today.slice(0, 7)); // "2026-10"
  const [showEvents, setShowEvents] = useState(false);
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [y, m] = month.split('-').map(Number);
  const first = dayKey(new Date(y, m - 1, 1));
  // Six Sunday-first weeks always cover the month, so the grid never jumps in height.
  const start = addDays(first, -parse(first).getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weekdays = cells.slice(0, 7).map((d) => parse(d).toLocaleDateString(undefined, { weekday: 'narrow' }));
  const shiftMonth = (n: number) => setMonth(dayKey(new Date(y, m - 1 + n, 1)).slice(0, 7));

  const weekStart = addDays(selected, -parse(selected).getDay());
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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

  const drag = useDropDrag((id, day) => onMove(id, day));

  // Google events for what's on screen.
  const from = mode === 'week' ? week[0] : cells[0];
  const to = mode === 'week' ? week[6] : cells[41];
  useEffect(() => {
    if (!showEvents || !loadEvents) return;
    let live = true;
    setEventsError(null);
    loadEvents(from, to)
      .then((e) => live && setEvents(e))
      .catch((e: Error) => {
        if (!live) return;
        setEventsError(e.message || 'Couldn’t load Google Calendar.');
        setShowEvents(false);
      });
    return () => {
      live = false;
    };
  }, [showEvents, loadEvents, from, to]);
  const eventsOn = (d: string) => (showEvents ? events.filter((e) => e.day === d) : []);

  const head = (
    <div className="calendar-toolbar">
      <div className="segmented calendar-mode" role="radiogroup" aria-label="Calendar view">
        {(['month', 'week'] as const).map((v) => (
          <button key={v} role="radio" aria-checked={mode === v} className={`seg ${mode === v ? 'active' : ''}`} onClick={() => onMode(v)}>
            {v === 'month' ? 'Month' : 'Week'}
          </button>
        ))}
      </div>
      {loadEvents && (
        <button className={`chip ${showEvents ? 'active' : ''}`} onClick={() => setShowEvents((s) => !s)} aria-pressed={showEvents}>
          📆 Google Calendar
        </button>
      )}
      {eventsError && <span className="small error-text">{eventsError}</span>}
    </div>
  );

  if (mode === 'week') {
    const label = `${parse(week[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${parse(week[6]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    return (
      <div className={`calendar-week-page ${drag.draggingId ? 'is-dragging' : ''}`}>
        {head}
        <div className="calendar-head week-head">
          <h2>{label}</h2>
          <div className="calendar-nav">
            {!week.includes(today) && (
              <button className="btn calendar-today" onClick={() => pick(today)}>
                Today
              </button>
            )}
            <button className="icon-btn" onClick={() => pick(addDays(selected, -7))} aria-label="Previous week">‹</button>
            <button className="icon-btn" onClick={() => pick(addDays(selected, 7))} aria-label="Next week">›</button>
          </div>
        </div>
        <div className="week-grid">
          {week.map((d) => {
            const list = tasks.filter((t) => t.dueDate === d || (d === today && !t.completedAt && t.dueDate && t.dueDate < today));
            const mins = list.filter((t) => !t.completedAt).reduce((s, t) => s + (t.estimate ?? 0), 0);
            return (
              <section
                key={d}
                className={`wk-col glass-soft ${d === today ? 'today' : ''} ${drag.over === d ? 'drop-over' : ''} ${d < today ? 'past' : ''}`}
                data-drop-zone={d}
                aria-label={parse(d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              >
                <header className="wk-col-head">
                  <span className="wd">{parse(d).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                  <span className="dn">{parse(d).getDate()}</span>
                  {mins > 0 && <span className="muted small">{formatEstimate(mins)}</span>}
                </header>
                {eventsOn(d).map((e) => (
                  <div key={e.id} className="gcal-event" title="From Google Calendar">
                    {e.time && <span className="gcal-time">{e.time}</span>} {e.title}
                  </div>
                ))}
                <ul className="week-cards">
                  {list.map((t) => {
                    const cat = categories.find((c) => c.id === t.categoryId);
                    return (
                      <li
                        key={t.id}
                        className={`week-card ${t.completedAt ? 'done' : ''} ${t.dueDate! < d ? 'late' : ''} ${drag.draggingId === t.id ? 'dragging' : ''}`}
                        style={{ '--cat': cat?.color ?? 'var(--muted-color)', ...drag.styleFor(t.id) } as CSSProperties}
                      >
                        <button
                          className="mini-check"
                          aria-pressed={!!t.completedAt}
                          aria-label={t.completedAt ? `Mark "${t.title}" as not done` : `Complete "${t.title}"`}
                          onClick={(e) => onToggle(t, e.currentTarget)}
                        >
                          {t.completedAt ? '✓' : ''}
                        </button>
                        <button className="week-card-title" onClick={() => onOpen(t)}>
                          {t.boss && '🐉 '}
                          {t.title}
                        </button>
                        {!t.completedAt && (
                          <span className="drag-handle" title="Drag to another day" aria-hidden="true" onPointerDown={(e) => drag.start(e, t.id)}>
                            ⋮⋮
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {list.length === 0 && eventsOn(d).length === 0 && <p className="week-empty muted small">Free</p>}
              </section>
            );
          })}
        </div>
        <p className="muted small week-tip">Drag a quest by its handle to move it to another day.</p>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      <div className="calendar-left">
        {head}
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
              const frozen = stats.frozenDays.includes(d);
              return (
                <button
                  key={d}
                  className={[
                    'calendar-day',
                    d.slice(0, 7) !== month && 'outside',
                    d === today && 'today',
                    d === selected && 'selected',
                    (stats.completionsByDay[d] ?? 0) > 0 && 'did',
                    frozen && 'frozen',
                  ].filter(Boolean).join(' ')}
                  aria-pressed={d === selected}
                  aria-label={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}: ${n} due${frozen ? ', streak freeze used' : ''}`}
                  onClick={() => pick(d)}
                >
                  <span className="calendar-num">{date.getDate()}</span>
                  <span className={`calendar-dots ${late ? 'late' : ''}`} aria-hidden="true">
                    {frozen ? '🧊' : Array.from({ length: Math.min(n, 3) }, (_, i) => <i key={i} />)}
                    {eventsOn(d).length > 0 && <i className="gcal-dot" />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <section className="calendar-day-list" aria-label="Quests on the selected day">
        <h2 className="calendar-day-title">
          {selected === today ? 'Today' : parse(selected).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          <span className="muted"> · {dayOpen.length + overdue.length} open{doneCount ? ` · ${doneCount} done` : ''}</span>
        </h2>

        {selected >= today && (
          <QuickAdd key={selected} categories={categories} defaultCategoryId={null} defaultDue={selected} onAdd={onAdd} />
        )}

        {eventsOn(selected).length > 0 && (
          <>
            <h3 className="calendar-sub">On your calendar</h3>
            {eventsOn(selected).map((e) => (
              <div key={e.id} className="gcal-event">
                {e.time && <span className="gcal-time">{e.time}</span>} {e.title}
              </div>
            ))}
          </>
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
