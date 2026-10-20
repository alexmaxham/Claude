import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { dayKey, daysBetween } from '../core/dates';
import { isSurprise, nextStreak, xpForTask } from '../core/gamification';
import { formatEstimate } from '../core/parse';
import { repeatLabel } from '../core/recurrence';
import type { Category, Stats, Task } from '../core/types';

interface Props {
  task: Task;
  category: Category | undefined;
  stats: Stats;
  selected?: boolean;
  /** Present when the task can be dragged; starts a drag from the handle. */
  onDragStart?: (e: PointerEvent<HTMLElement>, id: string) => void;
  dragStyle?: CSSProperties;
  dragging?: boolean;
  onToggle: (task: Task, el: HTMLElement) => void;
  onOpen: (task: Task) => void;
  /** Snooze to tomorrow; on phones a swipe to the left does the same. */
  onSnooze?: (task: Task) => void;
  onFocus?: (task: Task) => void;
  /** Ticks off a step; boss rows offer their next step as a strike. */
  onStep?: (task: Task, subtaskId: string, el: HTMLElement) => void;
}

const SWIPE = 90; // px to the left that counts as a snooze

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

export function TaskItem({ task, category, stats, selected, onDragStart, dragStyle, dragging, onToggle, onOpen, onSnooze, onFocus, onStep }: Props) {
  const [popping, setPopping] = useState(false);
  const [swipe, setSwipe] = useState(0);
  const swipeStart = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);
  const done = !!task.completedAt;
  const surprise = !done && isSurprise(stats, task);
  // Preview what completing this right now would earn.
  const reward = done ? task.xpAwarded : xpForTask(task, nextStreak(stats), Date.now(), surprise);
  const due = task.dueDate ? dueLabel(task.dueDate) : null;
  const steps = task.subtasks ?? [];
  const stepsDone = steps.filter((s) => s.done).length;
  const boss = task.boss && steps.length > 0;
  const nextStep = boss && !done ? steps.find((s) => !s.done) : undefined;

  // Touch swipe to the left snoozes. Locks to horizontal or vertical after a few pixels so scrolling still works.
  const swipeHandlers =
    onSnooze && !done
      ? {
          onPointerDown: (e: PointerEvent) => {
            if (e.pointerType !== 'touch') return;
            swipeStart.current = { x: e.clientX, y: e.clientY, locked: null };
          },
          onPointerMove: (e: PointerEvent) => {
            const s = swipeStart.current;
            if (!s) return;
            const dx = e.clientX - s.x;
            const dy = e.clientY - s.y;
            if (s.locked === null && Math.hypot(dx, dy) > 8) s.locked = Math.abs(dx) > Math.abs(dy) * 1.4;
            if (s.locked) setSwipe(Math.min(0, dx));
          },
          onPointerUp: () => {
            if (swipeStart.current?.locked && swipe < -SWIPE) onSnooze(task);
            swipeStart.current = null;
            setSwipe(0);
          },
          onPointerCancel: () => {
            swipeStart.current = null;
            setSwipe(0);
          },
        }
      : {};

  return (
    <li
      data-task-id={task.id}
      className={[
        'task glass-soft',
        done && 'done',
        popping && 'pop',
        selected && 'selected',
        dragging && 'dragging',
        boss && 'boss',
        surprise && 'surprise',
        swipe < 0 && 'swiping',
        `prio-${task.priority}`,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--cat': category?.color ?? 'var(--muted-color)', '--swipe': `${swipe}px`, ...dragStyle } as CSSProperties}
      onAnimationEnd={() => setPopping(false)}
      {...swipeHandlers}
    >
      {swipe < 0 && (
        <span className={`swipe-hint ${swipe < -SWIPE ? 'armed' : ''}`} aria-hidden="true">
          💤 Tomorrow
        </span>
      )}
      {onDragStart && (
        <span
          className="drag-handle"
          aria-hidden="true"
          title="Drag to move"
          onPointerDown={(e) => onDragStart(e, task.id)}
        >
          ⋮⋮
        </span>
      )}
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
        <span className="task-title">
          {task.boss && <span className="boss-icon" aria-label="Boss battle">🐉 </span>}
          {task.title}
        </span>
        {task.description && <span className="task-desc">{task.description}</span>}
        {boss && !done && (
          <span className="boss-hp" aria-label={`Boss health ${steps.length - stepsDone} of ${steps.length}`}>
            <span className="boss-hp-bar">
              <span style={{ width: `${((steps.length - stepsDone) / steps.length) * 100}%` }} />
            </span>
            <span className="boss-hp-text">
              HP {steps.length - stepsDone}/{steps.length}
            </span>
          </span>
        )}
        {boss && !done && !nextStep && <span className="boss-next muted small">The boss is out of HP. Complete it to claim the bounty!</span>}
        <span className="task-meta">
          {task.doing && !done && <span className="chip-mini doing-tag">▶ Doing</span>}
          {category && (
            <span className="chip-mini">
              <span className="cat-dot" aria-hidden="true" />
              {category.name}
            </span>
          )}
          {due && !done && <span className={`due due-${due.tone}`}>{due.text}</span>}
          {task.repeat && <span className="chip-mini">↻ {repeatLabel(task.repeat)}</span>}
          {task.estimate && <span className="chip-mini">⏱ {formatEstimate(task.estimate)}</span>}
          {!boss && steps.length > 0 && (
            <span className={`chip-mini steps ${stepsDone === steps.length ? 'all' : ''}`}>
              {stepsDone}/{steps.length} steps
            </span>
          )}
          {!!task.focusMinutes && <span className="chip-mini">🎧 {formatEstimate(task.focusMinutes)}</span>}
          {task.priority !== 'low' && !done && (
            <span className="prio-tag">{task.priority === 'high' ? 'High' : 'Medium'}</span>
          )}
        </span>
      </button>
      {nextStep && onStep && (
        <button
          className="strike-btn"
          onClick={(e) => onStep(task, nextStep.id, e.currentTarget)}
          aria-label={`Strike: mark step "${nextStep.title}" done`}
          title={`Next step: ${nextStep.title}`}
        >
          ⚔️ <span className="strike-label">{nextStep.title}</span>
        </button>
      )}
      {!done && (onFocus || onSnooze) && (
        <span className="task-actions">
          {onFocus && (
            <button className="task-action" onClick={() => onFocus(task)} aria-label={`Focus on "${task.title}"`} title="Focus timer (F)">
              🎧
            </button>
          )}
          {onSnooze && (
            <button className="task-action" onClick={() => onSnooze(task)} aria-label={`Snooze "${task.title}" to tomorrow`} title="Snooze to tomorrow (S)">
              💤
            </button>
          )}
        </span>
      )}
      <span className={`xp-tag ${done ? 'earned' : ''} ${surprise ? 'double' : ''}`} title={surprise ? 'Today’s surprise: double XP' : undefined}>
        {surprise && '🍀 '}+{reward} XP
      </span>
    </li>
  );
}
