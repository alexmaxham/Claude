import type { Category, Task } from '../core/types';

export type Filter = 'all' | 'today' | { categoryId: string } | { day: string };

interface Props {
  categories: Category[];
  tasks: Task[];
  filter: Filter;
  todayCount: number;
  onChange: (f: Filter) => void;
  onEdit: () => void;
  /** Category currently under a dragged task, highlighted as a drop target. */
  dropTarget?: string | null;
}

export function CategoryBar({ categories, tasks, filter, todayCount, onChange, onEdit, dropTarget }: Props) {
  const openCount = (id: string) => tasks.filter((t) => !t.completedAt && t.categoryId === id).length;
  const active = (f: 'all' | 'today' | { categoryId: string }) =>
    typeof f === 'string' ? filter === f : typeof filter === 'object' && 'categoryId' in filter && filter.categoryId === f.categoryId;

  return (
    <nav className="category-bar" aria-label="Categories">
      <div className="category-scroll">
        <button className={`tab glass-soft ${active('all') ? 'active' : ''}`} onClick={() => onChange('all')}>
          ✨ All <span className="count">{tasks.filter((t) => !t.completedAt).length}</span>
        </button>
        <button className={`tab glass-soft ${active('today') ? 'active' : ''}`} onClick={() => onChange('today')}>
          ☀️ Today <span className="count">{todayCount}</span>
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            data-drop-category={c.id}
            className={`tab glass-soft ${active({ categoryId: c.id }) ? 'active' : ''} ${dropTarget === c.id ? 'drop-target' : ''}`}
            style={active({ categoryId: c.id }) ? { background: c.color, borderColor: c.color, color: '#10131c' } : undefined}
            onClick={() => onChange({ categoryId: c.id })}
          >
            <span className="dot" style={{ background: c.color }} />
            {c.emoji} {c.name} <span className="count">{openCount(c.id)}</span>
          </button>
        ))}
        <button className="tab glass-soft edit-tab" onClick={onEdit} aria-label="Edit categories">
          ✏️ Edit
        </button>
      </div>
    </nav>
  );
}
