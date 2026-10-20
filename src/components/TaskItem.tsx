import { useState, type CSSProperties } from 'react';
import { dayKey, daysBetween } from '../core/dates';
import { nextStreak, xpForTask } from '../core/gamification';
import type { Category, Stats, Task } from '../core/types';

interface Props {
  task: Task;
  category: Category | undefined;
  stats: Stats;
  onToggle: (task: Task, el: HTMLElement) => void;
  onOpen: (task: Task) => void;
}

export function dueLabel(due: string): { text: string; tone: 'overdue' | 'today' | 'soon' | 'later' } {
  const diff = daysBetween(dayKey(), due);
  if (diff < 0) return { text: diff === -1 ? 'Yesterday' : `${-diff}d overdue`, tone: 'overdue' };
  if (diff === 0) return { text: 'Today', tone: 'today' };
  if (diff === 1) return { text: 'Tomorrow', tone: 'soon' };
  if (diff < 7) {
    const [y, m, d] = due.split('-').map(Number);
    return { text: new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' }), tone: 'soon' };
  }
  const [y, m, d] = due.split('-').map(Number);
  return { text: new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), tone: 'later' };
}

export function TaskItem({ task, category, stats, onToggle, onOpen }: Props) {
  const [popping, setPopping] = useState(false);
  const done = !!task.completedAt;
  // Preview what completing this right now would earn.
  const reward = done ? task.xpAwarded : xpForTask(task, nextStreak(stats));
  const due = task.dueDate ? dueLabel(task.dueDate) : null;

  return (
    <li
      className={`task glass-soft ${done ? 'done' : ''} ${popping ? 'pop' : ''} prio-${task.priority}`}
      style={{ '--cat': category?.color ?? 'var(--muted-color)' } as CSSProperties}
      onAnimationEnd={() => setPopping(false)}
    >
      <button
        className="check"
        aria-label={done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
        aria-pressed={done}
        onClick={(e) => {
          if (!done) setPopping(true);
          onToggle(task, e.currentTarget);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </button>
      <button className="task-main" onClick={() => onOpen(task)}>
        <span className="task-title">{task.title}</span>
        {task.description && <span className="task-desc">{task.description}</span>}
        <span className="task-meta">
          {category && (
            <span className="chip-mini">
              {category.emoji} {category.name}
            </span>
          )}
          {due && !done && <span className={`due due-${due.tone}`}>📅 {due.text}</span>}
          {task.priority !== 'low' && !done && (
            <span className="prio-tag">{task.priority === 'high' ? '‼️ High' : '❗ Medium'}</span>
          )}
        </span>
      </button>
      <span className={`xp-tag ${done ? 'earned' : ''}`}>+{reward} XP</span>
    </li>
  );
}
