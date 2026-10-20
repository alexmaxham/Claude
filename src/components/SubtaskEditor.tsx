import { useState } from 'react';
import { uid } from '../core/store';
import type { Subtask } from '../core/types';

/** Editable checklist: tick, rename, remove, and add steps. */
export function SubtaskEditor({ value, onChange }: { value: Subtask[]; onChange: (s: Subtask[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    onChange([...value, { id: uid(), title, done: false }]);
    setDraft('');
  };
  const update = (id: string, patch: Partial<Subtask>) => onChange(value.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <div className="subtasks">
      {value.map((s) => (
        <div key={s.id} className={`subtask-row ${s.done ? 'done' : ''}`}>
          <button
            type="button"
            className="mini-check"
            aria-pressed={s.done}
            aria-label={s.done ? `Mark "${s.title}" as not done` : `Mark "${s.title}" as done`}
            onClick={() => update(s.id, { done: !s.done })}
          >
            {s.done ? '✓' : ''}
          </button>
          <input
            className="subtask-input"
            value={s.title}
            onChange={(e) => update(s.id, { title: e.target.value })}
            aria-label="Step"
          />
          <button type="button" className="icon-btn subtask-remove" aria-label={`Remove "${s.title}"`} onClick={() => onChange(value.filter((x) => x.id !== s.id))}>
            ✕
          </button>
        </div>
      ))}
      <div className="subtask-row add">
        <span className="mini-check placeholder" aria-hidden="true">+</span>
        <input
          className="subtask-input"
          placeholder="Add a step…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds the step instead of submitting the whole form.
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          aria-label="New step"
        />
      </div>
    </div>
  );
}
