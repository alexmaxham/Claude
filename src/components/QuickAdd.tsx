import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Category, Priority } from '../core/types';
import { CategoryPicker, DuePicker, PriorityPicker } from './Pickers';

interface Props {
  categories: Category[];
  defaultCategoryId: string | null;
  defaultDue: string | null;
  onAdd: (task: { title: string; categoryId: string | null; priority: Priority; dueDate: string | null }) => void;
}

export function QuickAdd({ categories, defaultCategoryId, defaultDue, onAdd }: Props) {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState(defaultDue);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Follow the active filter so new tasks land where the user is looking.
  useEffect(() => setCategoryId(defaultCategoryId), [defaultCategoryId]);
  useEffect(() => setDueDate(defaultDue), [defaultDue]);

  // Tuck the options away when tapping elsewhere with nothing typed. (Pointer-based
  // because Safari doesn't move focus to buttons, so blur can't be trusted.)
  useEffect(() => {
    if (!expanded || title.trim()) return;
    const onDown = (e: PointerEvent) => {
      if (!formRef.current?.contains(e.target as Node)) setExpanded(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [expanded, title]);

  // "n" or "/" focuses the input from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'n' || e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ title, categoryId, priority, dueDate });
    setTitle('');
    inputRef.current?.focus();
  };

  return (
    <form
      ref={formRef}
      className={`quick-add glass ${expanded ? 'expanded' : ''}`}
      onSubmit={submit}
    >
      <div className="quick-row">
        <input
          ref={inputRef}
          className="quick-input"
          placeholder="Add a new quest…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setExpanded(true)}
          aria-label="New task"
          enterKeyHint="done"
        />
        <button
          type="button"
          className={`icon-btn options-btn ${expanded ? 'open' : ''}`}
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Hide options' : 'Show options'}
          aria-expanded={expanded}
        >
          ⌄
        </button>
        <button type="submit" className="add-btn" disabled={!title.trim()} aria-label="Add task">
          +
        </button>
      </div>
      {expanded && (
        <div className="quick-options">
          <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
          <PriorityPicker value={priority} onChange={setPriority} />
          <DuePicker value={dueDate} onChange={setDueDate} />
        </div>
      )}
    </form>
  );
}
