import { addDays, dayKey } from '../core/dates';
import { BASE_XP } from '../core/gamification';
import type { Category, Priority } from '../core/types';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Priority">
      {PRIORITIES.map((p) => (
        <button
          key={p.value}
          type="button"
          role="radio"
          aria-checked={value === p.value}
          className={`seg prio-${p.value} ${value === p.value ? 'active' : ''}`}
          onClick={() => onChange(p.value)}
        >
          {p.label} <span className="seg-xp">{BASE_XP[p.value]}xp</span>
        </button>
      ))}
    </div>
  );
}

export function DuePicker({ value, onChange }: { value: string | null; onChange: (d: string | null) => void }) {
  const today = dayKey();
  const tomorrow = addDays(today, 1);
  const custom = value && value !== today && value !== tomorrow;
  return (
    <div className="chip-row" role="group" aria-label="Due date">
      <button type="button" className={`chip ${!value ? 'active' : ''}`} onClick={() => onChange(null)}>
        No date
      </button>
      <button type="button" className={`chip ${value === today ? 'active' : ''}`} onClick={() => onChange(today)}>
        Today
      </button>
      <button type="button" className={`chip ${value === tomorrow ? 'active' : ''}`} onClick={() => onChange(tomorrow)}>
        Tomorrow
      </button>
      <label className={`chip date-chip ${custom ? 'active' : ''}`}>
        📅 {custom ? value : 'Pick…'}
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          aria-label="Pick a due date"
        />
      </label>
    </div>
  );
}

export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="chip-row" role="radiogroup" aria-label="Category">
      <button type="button" role="radio" aria-checked={value === null} className={`chip ${value === null ? 'active' : ''}`} onClick={() => onChange(null)}>
        None
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={value === c.id}
          className={`chip ${value === c.id ? 'active' : ''}`}
          style={value === c.id ? { background: c.color, borderColor: c.color, color: '#10131c' } : undefined}
          onClick={() => onChange(c.id)}
        >
          {c.emoji} {c.name}
        </button>
      ))}
    </div>
  );
}
