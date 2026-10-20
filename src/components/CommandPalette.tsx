import { useEffect, useMemo, useRef, useState } from 'react';
import type { Task } from '../core/types';

export interface Command {
  id: string;
  icon: string;
  label: string;
  /** Extra words to match on. */
  keywords?: string;
  shortcut?: string;
  run: () => void;
}

interface Props {
  commands: Command[];
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onClose: () => void;
}

const score = (text: string, q: string) => {
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 3;
  if (t.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  return t.includes(q) ? 1 : 0;
};

/** ⌘K: search commands and quests, run with Enter. */
export function CommandPalette({ commands, tasks, onOpenTask, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const q = query.trim().toLowerCase();

  const items = useMemo(() => {
    const cmds = commands
      .map((c) => ({ c, s: q ? Math.max(score(c.label, q), score(c.keywords ?? '', q) && 1) : 1 }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(({ c }) => ({ key: c.id, icon: c.icon, label: c.label, hint: c.shortcut, run: c.run }));
    const quests = q
      ? tasks
          .filter((t) => !t.completedAt && t.title.toLowerCase().includes(q))
          .slice(0, 8)
          .map((t) => ({ key: `task:${t.id}`, icon: t.boss ? '🐉' : '○', label: t.title, hint: 'Open', run: () => onOpenTask(t) }))
      : [];
    return [...cmds, ...quests];
  }, [commands, tasks, q, onOpenTask]);

  useEffect(() => setIndex(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const run = (i: number) => {
    const item = items[i];
    if (!item) return;
    onClose();
    item.run();
  };

  return (
    <div className="sheet-backdrop palette-backdrop" onClick={onClose}>
      <div className="palette glass" role="dialog" aria-modal="true" aria-label="Commands" onClick={(e) => e.stopPropagation()}>
        <input
          className="palette-input"
          placeholder="Type a command or search quests…"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search commands"
          aria-controls="palette-list"
          aria-activedescendant={items[index] ? `palette-${index}` : undefined}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(items.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(index);
            } else if (e.key === 'Escape') onClose();
          }}
        />
        <ul className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {items.map((item, i) => (
            <li
              key={item.key}
              id={`palette-${i}`}
              data-index={i}
              role="option"
              aria-selected={i === index}
              className={`palette-item ${i === index ? 'active' : ''}`}
              onMouseMove={() => setIndex(i)}
              onClick={() => run(i)}
            >
              <span className="palette-icon" aria-hidden="true">{item.icon}</span>
              <span className="palette-label">{item.label}</span>
              {item.hint && <kbd>{item.hint}</kbd>}
            </li>
          ))}
          {items.length === 0 && <li className="palette-empty muted">Nothing matches “{query.trim()}”.</li>}
        </ul>
      </div>
    </div>
  );
}
