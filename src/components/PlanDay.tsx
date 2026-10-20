import { useState } from 'react';
import { addDays, dayKey } from '../core/dates';
import { formatEstimate } from '../core/parse';
import type { Category, Task } from '../core/types';
import { Sheet } from './Sheet';
import { dueLabel } from './TaskItem';

interface Props {
  tasks: Task[];
  categories: Category[];
  hoursPerDay: number;
  onHoursPerDay: (h: number) => void;
  /** `ids` in the order picked, plus the overdue ones left out (to move to tomorrow). */
  onPlan: (ids: string[], moveRest: string[]) => void;
  onClose: () => void;
}

/** Pick today's quests from what's overdue, due today, coming up and undated. */
export function PlanDay({ tasks, categories, hoursPerDay, onHoursPerDay, onPlan, onClose }: Props) {
  const today = dayKey();
  const open = tasks.filter((t) => !t.completedAt);
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = open.filter((t) => t.dueDate === today);
  const soon = open.filter((t) => t.dueDate && t.dueDate > today && t.dueDate <= addDays(today, 7));
  const undated = open.filter((t) => !t.dueDate);
  // Start with what's already due today.
  const [picked, setPicked] = useState<string[]>(() => dueToday.map((t) => t.id));
  const [moveRest, setMoveRest] = useState(true);
  const cat = new Map(categories.map((c) => [c.id, c]));

  const minutes = picked.reduce((sum, id) => sum + (tasks.find((t) => t.id === id)?.estimate ?? 0), 0);
  const unestimated = picked.filter((id) => !tasks.find((t) => t.id === id)?.estimate).length;
  const capacity = hoursPerDay * 60;
  const leftOut = overdue.filter((t) => !picked.includes(t.id)).map((t) => t.id);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const group = (title: string, list: Task[], tone = '') =>
    list.length > 0 && (
      <>
        <h3 className={`plan-group ${tone}`}>{title}</h3>
        <ul className="plan-list">
          {list.map((t) => {
            const n = picked.indexOf(t.id);
            const c = cat.get(t.categoryId ?? '');
            return (
              <li key={t.id}>
                <button className={`plan-item glass-soft ${n >= 0 ? 'picked' : ''}`} aria-pressed={n >= 0} onClick={() => toggle(t.id)}>
                  <span className="plan-num">{n >= 0 ? n + 1 : ''}</span>
                  <span className="plan-title">
                    {t.boss && '🐉 '}
                    {t.title}
                    <span className="muted small">
                      {[c && `${c.emoji} ${c.name}`, t.dueDate && dueLabel(t.dueDate).text, t.estimate && formatEstimate(t.estimate)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </>
    );

  return (
    <Sheet title="Plan my day" onClose={onClose}>
      <p className="muted small plan-intro">Tap quests in the order you want to do them. They’ll be due today, in that order.</p>
      <div className={`plan-budget glass-soft ${minutes > capacity ? 'over' : ''}`}>
        <div>
          <strong>{formatEstimate(minutes) === '0 min' ? 'Nothing timed yet' : `~${formatEstimate(minutes)}`}</strong>
          <span className="muted small">
            {' '}of {hoursPerDay} h{unestimated ? ` · ${unestimated} without an estimate` : ''}
          </span>
          {minutes > capacity && <div className="small warn-text">That’s more than your day holds. Leave something for tomorrow?</div>}
        </div>
        <div className="stepper" aria-label="Hours available today">
          <button className="icon-btn" onClick={() => onHoursPerDay(Math.max(1, hoursPerDay - 1))} aria-label="Fewer hours">−</button>
          <strong>{hoursPerDay} h</strong>
          <button className="icon-btn" onClick={() => onHoursPerDay(Math.min(16, hoursPerDay + 1))} aria-label="More hours">+</button>
        </div>
      </div>
      <div className="mini-bar plan-bar">
        <div style={{ width: `${Math.min(100, (minutes / capacity) * 100)}%` }} />
      </div>

      {group('Overdue', overdue, 'late')}
      {group('Due today', dueToday)}
      {group('Coming up this week', soon)}
      {group('No date', undated)}
      {open.length === 0 && <p className="empty glass-soft">No open quests. Add some first, then plan.</p>}

      {leftOut.length > 0 && (
        <label className="plan-move">
          <input type="checkbox" checked={moveRest} onChange={(e) => setMoveRest(e.target.checked)} />
          Move the {leftOut.length} overdue quest{leftOut.length === 1 ? '' : 's'} I didn’t pick to tomorrow
        </label>
      )}
      <div className="form-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={!picked.length}
          onClick={() => {
            onPlan(picked, moveRest ? leftOut : []);
            onClose();
          }}
        >
          Plan {picked.length || ''} quest{picked.length === 1 ? '' : 's'}
        </button>
      </div>
    </Sheet>
  );
}
