import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { localeDayFirst, parseQuest } from '../core/parse';
import type { NewTask } from '../core/store';
import type { Category, Priority, Repeat } from '../core/types';
import { CategoryPicker, DuePicker, EstimatePicker, PriorityPicker, RepeatPicker } from './Pickers';

interface Props {
  categories: Category[];
  defaultCategoryId: string | null;
  defaultDue: string | null;
  onAdd: (task: NewTask) => void;
  /** Opens the template picker; absent where templates don't fit. */
  onTemplates?: () => void;
}

const DAY_FIRST = localeDayFirst();

export function QuickAdd({ categories, defaultCategoryId, defaultDue, onAdd, onTemplates }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState(defaultDue);
  const [repeat, setRepeat] = useState<Repeat | null>(null);
  const [estimate, setEstimate] = useState<number | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  /** Recognized words the user tapped to keep as plain text. */
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Follow the active filter so new tasks land where the user is looking.
  useEffect(() => setCategoryId(defaultCategoryId), [defaultCategoryId]);
  useEffect(() => setDueDate(defaultDue), [defaultDue]);

  const parsed = useMemo(
    () => parseQuest(title, { categories, ignore: ignored, dayFirst: DAY_FIRST }),
    [title, categories, ignored],
  );

  // Tuck the options away when tapping elsewhere with nothing typed. Uses click
  // (not pointerdown) so the layout doesn't shift under the tap, and not blur
  // because Safari doesn't move focus to buttons.
  useEffect(() => {
    if (!expanded || title.trim() || description.trim()) return;
    const onClick = (e: MouseEvent) => {
      if (!formRef.current?.contains(e.target as Node)) setExpanded(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [expanded, title, description]);

  // "n" focuses the input from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Words typed in the title win over the pickers.
    const name = parsed.title || title.trim();
    if (!name) return;
    onAdd({
      title: name,
      description,
      categoryId: parsed.categoryId ?? categoryId,
      priority: parsed.priority ?? priority,
      dueDate: parsed.dueDate ?? dueDate,
      repeat: parsed.repeat ?? repeat,
      estimate: parsed.estimate ?? estimate,
      boss: parsed.boss,
    });
    setTitle('');
    setDescription('');
    setEstimate(undefined);
    setIgnored(new Set());
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
          aria-describedby="quick-hint"
          enterKeyHint="done"
        />
        {onTemplates && (
          <button type="button" className="icon-btn options-btn" onClick={onTemplates} aria-label="Add from a template" title="Templates (T)">
            📋
          </button>
        )}
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
      {parsed.tokens.length > 0 && (
        <div className="parsed-row" aria-live="polite">
          {parsed.tokens.map((t) => (
            <button
              key={t.kind + t.text}
              type="button"
              className={`parsed-chip kind-${t.kind}`}
              title={`Keep “${t.text}” in the title`}
              onClick={() => setIgnored((s) => new Set([...s, t.text.toLowerCase()]))}
            >
              {t.label} <span aria-hidden="true">✕</span>
              <span className="sr-only">, keep “{t.text}” as text</span>
            </button>
          ))}
        </div>
      )}
      {expanded && (
        <div className="quick-options">
          <p id="quick-hint" className="muted small quick-hint">
            Tip: type <code>tomorrow</code>, <code>fri</code>, <code>every monday</code>, <code>#work</code>, <code>!high</code>,{' '}
            <code>~30m</code> or <code>!boss</code>.
          </p>
          <textarea
            className="text-input text-area quick-desc"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Description"
            rows={2}
          />
          <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
          <PriorityPicker value={priority} onChange={setPriority} />
          <DuePicker value={dueDate} onChange={setDueDate} />
          <RepeatPicker value={repeat} dueDate={dueDate} onChange={setRepeat} />
          <EstimatePicker value={estimate} onChange={setEstimate} />
        </div>
      )}
    </form>
  );
}
