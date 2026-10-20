import { addDays, dayKey } from '../core/dates';
import { BASE_XP } from '../core/gamification';
import { DAY_NAMES } from '../core/recurrence';
import type { Category, Priority, Repeat } from '../core/types';

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

type RepeatPreset = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

function presetOf(repeat: Repeat | null | undefined): RepeatPreset {
  if (!repeat) return 'none';
  if (repeat.kind === 'weekly') return [...repeat.days].sort().join() === '1,2,3,4,5' ? 'weekdays' : 'weekly';
  return repeat.kind;
}

/** Repeat schedule. "Weekly" reveals day toggles; it starts on the due date's weekday. */
export function RepeatPicker({
  value,
  dueDate,
  onChange,
}: {
  value: Repeat | null | undefined;
  dueDate: string | null;
  onChange: (r: Repeat | null) => void;
}) {
  const preset = presetOf(value);
  const dueDay = (() => {
    const [y, m, d] = (dueDate ?? dayKey()).split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  })();
  const pick = (p: RepeatPreset) => {
    if (p === 'none') onChange(null);
    else if (p === 'daily') onChange({ kind: 'daily' });
    else if (p === 'monthly') onChange({ kind: 'monthly' });
    else if (p === 'weekdays') onChange({ kind: 'weekly', days: [1, 2, 3, 4, 5] });
    else onChange({ kind: 'weekly', days: [dueDay] });
  };
  const options: { id: RepeatPreset; label: string }[] = [
    { id: 'none', label: 'Never' },
    { id: 'daily', label: 'Daily' },
    { id: 'weekdays', label: 'Weekdays' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
  ];
  return (
    <div className="repeat-picker">
      <div className="chip-row" role="radiogroup" aria-label="Repeat">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={preset === o.id}
            className={`chip ${preset === o.id ? 'active' : ''}`}
            onClick={() => pick(o.id)}
          >
            {o.id === 'none' ? o.label : `🔁 ${o.label}`}
          </button>
        ))}
      </div>
      {value?.kind === 'weekly' && preset === 'weekly' && (
        <div className="day-toggles" role="group" aria-label="Repeat on">
          {DAY_NAMES.map((name, d) => {
            const on = value.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={name}
                className={`day-toggle ${on ? 'active' : ''}`}
                onClick={() => {
                  const days = on ? value.days.filter((x) => x !== d) : [...value.days, d];
                  onChange({ kind: 'weekly', days: days.length ? days.sort() : [d] });
                }}
              >
                {name[0]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
