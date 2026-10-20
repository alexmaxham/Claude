import type { ReactNode } from 'react';
import type { Task } from '../core/types';

export type Column = 'todo' | 'doing' | 'done';

const COLUMNS: { id: Column; title: string; empty: string }[] = [
  { id: 'todo', title: 'To do', empty: 'Nothing waiting.' },
  { id: 'doing', title: 'Doing', empty: 'Drag a quest here when you start it.' },
  { id: 'done', title: 'Done', empty: 'Drop a quest here to complete it.' },
];

interface Props {
  open: Task[];
  done: Task[];
  /** The column under a dragged card. */
  over: string | null;
  renderTask: (task: Task) => ReactNode;
}

/** Quests in three columns. Cards move by dragging their handle onto another column. */
export function Board({ open, done, over, renderTask }: Props) {
  const lists: Record<Column, Task[]> = {
    todo: open.filter((t) => !t.doing),
    doing: open.filter((t) => t.doing),
    done: done.slice(0, 30),
  };
  return (
    <div className="board">
      {COLUMNS.map((c) => (
        <section key={c.id} className={`board-col glass-soft ${over === c.id ? 'drop-over' : ''}`} data-drop-zone={c.id} aria-label={c.title}>
          <h3 className="board-head">
            {c.title} <span className="count">{lists[c.id].length}</span>
          </h3>
          {lists[c.id].length ? (
            <ul className="task-list">{lists[c.id].map(renderTask)}</ul>
          ) : (
            <p className="board-empty muted small">{c.empty}</p>
          )}
        </section>
      ))}
    </div>
  );
}
