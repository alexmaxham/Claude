import { useState } from 'react';
import { addDays, dayKey } from '../core/dates';
import { BASE_XP } from '../core/gamification';
import { DAY_NAMES, repeatLabel, repeatPreset, WEEKDAYS, WEEKENDS, type RepeatPreset } from '../core/recurrence';
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

const REPEAT_OPTIONS: { id: RepeatPreset; label: string }[] = [
  { id: 'none', label: 'Never' },
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekends', label: 'Weekends' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Custom…' },
];

type Unit = 'daily' | 'weekly' | 'monthly';

/**
 * Repeat schedule: presets, plus "Custom" for every N days/weeks/months.
 * Weekly schedules reveal day toggles; they start on the due date's weekday.
 */
export function RepeatPicker({
  value,
  dueDate,
  onChange,
}: {
  value: Repeat | null | undefined;
  dueDate: string | null;
  onChange: (r: Repeat | null) => void;
}) {
  const preset = repeatPreset(value);
  // "Custom" stays open even when its settings happen to match a preset (e.g. every 1 week).
  const [customOpen, setCustomOpen] = useState(preset === 'custom');
  const shown = customOpen ? 'custom' : preset;
  const dueDay = (() => {
    const [y, m, d] = (dueDate ?? dayKey()).split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  })();
  const interval = value && value.kind !== 'yearly' ? (value.interval ?? 1) : 1;
  const unit: Unit = value && value.kind !== 'yearly' ? value.kind : 'daily';
  const days = value?.kind === 'weekly' ? value.days : [dueDay];

  const build = (u: Unit, n: number, d = days): Repeat =>
    u === 'weekly' ? { kind: 'weekly', days: d, interval: n } : { kind: u, interval: n };

  const pick = (p: RepeatPreset) => {
    setCustomOpen(p === 'custom');
    if (p === 'none') onChange(null);
    else if (p === 'daily') onChange({ kind: 'daily' });
    else if (p === 'weekdays') onChange({ kind: 'weekly', days: [...WEEKDAYS] });
    else if (p === 'weekends') onChange({ kind: 'weekly', days: [...WEEKENDS] });
    else if (p === 'weekly') onChange({ kind: 'weekly', days: [dueDay] });
    else if (p === 'monthly') onChange({ kind: 'monthly' });
    else if (p === 'yearly') onChange({ kind: 'yearly' });
    else onChange(build(unit, Math.max(2, interval)));
  };

  return (
    <div className="repeat-picker">
      <div className="chip-row wrap" role="radiogroup" aria-label="Repeat">
        {REPEAT_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={shown === o.id}
            className={`chip ${shown === o.id ? 'active' : ''}`}
            onClick={() => pick(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {shown === 'custom' && (
        <div className="repeat-custom">
          <span>Every</span>
          <input
            type="number"
            className="text-input interval-input"
            min={1}
            max={99}
            value={interval}
            onChange={(e) => {
              const n = Math.max(1, Math.min(99, Math.round(Number(e.target.value) || 1)));
              onChange(build(unit, n));
            }}
            aria-label="Repeat every"
          />
          <select
            className="text-input unit-select"
            value={unit}
            onChange={(e) => onChange(build(e.target.value as Unit, interval))}
            aria-label="Repeat unit"
          >
            <option value="daily">{interval === 1 ? 'day' : 'days'}</option>
            <option value="weekly">{interval === 1 ? 'week' : 'weeks'}</option>
            <option value="monthly">{interval === 1 ? 'month' : 'months'}</option>
          </select>
        </div>
      )}
      {value?.kind === 'weekly' && (shown === 'weekly' || shown === 'custom') && (
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
                  const next = on ? value.days.filter((x) => x !== d) : [...value.days, d];
                  onChange({ ...value, days: next.length ? next.sort() : [d] });
                }}
              >
                {name[0]}
              </button>
            );
          })}
        </div>
      )}
      {value && <span className="muted small">🔁 {repeatLabel(value)}</span>}
    </div>
  );
}
