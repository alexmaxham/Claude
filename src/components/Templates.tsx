import { useState } from 'react';
import { formatEstimate } from '../core/parse';
import { uid, type Action } from '../core/store';
import type { Category, Priority, Template } from '../core/types';
import { CategoryPicker, EstimatePicker, PriorityPicker } from './Pickers';
import { Sheet } from './Sheet';
import { SubtaskEditor } from './SubtaskEditor';

interface Props {
  templates: Template[];
  categories: Category[];
  /** Adds a quest from the template. */
  onUse: (template: Template) => void;
  dispatch: (a: Action) => void;
  onClose: () => void;
}

const EMOJIS = ['📋', '🗓️', '🧳', '🌅', '🐉', '🛒', '🧹', '💼', '🏋️', '📚', '✈️', '🎉'];

/** Reusable quests: pick one to add it, or make and edit your own. */
export function Templates({ templates, categories, onUse, dispatch, onClose }: Props) {
  const [editing, setEditing] = useState<Template | null>(null);

  if (editing) {
    return <TemplateForm template={editing} categories={categories} dispatch={dispatch} onDone={() => setEditing(null)} onClose={onClose} />;
  }

  return (
    <Sheet title="Templates" onClose={onClose}>
      <p className="muted small">Tap a template to add it as a quest, with its steps ready to tick off.</p>
      <ul className="template-list">
        {templates.map((t) => (
          <li key={t.id} className="template-row glass-soft">
            <button
              className="template-main"
              onClick={() => {
                onUse(t);
                onClose();
              }}
            >
              <span className="template-emoji" aria-hidden="true">{t.emoji}</span>
              <span className="template-text">
                <strong>{t.name}</strong>
                <span className="muted small">
                  {[
                    t.boss && 'Boss battle',
                    `${t.steps.length} step${t.steps.length === 1 ? '' : 's'}`,
                    t.estimate && formatEstimate(t.estimate),
                    categories.find((c) => c.id === t.categoryId)?.name,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </button>
            <button className="icon-btn" onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}>
              ✏️
            </button>
          </li>
        ))}
      </ul>
      <button
        className="btn new-template"
        onClick={() => setEditing({ id: '', name: '', emoji: '📋', categoryId: null, priority: 'medium', steps: [] })}
      >
        + New template
      </button>
    </Sheet>
  );
}

function TemplateForm({
  template,
  categories,
  dispatch,
  onDone,
  onClose,
}: {
  template: Template;
  categories: Category[];
  dispatch: (a: Action) => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [emoji, setEmoji] = useState(template.emoji);
  const [description, setDescription] = useState(template.description ?? '');
  const [categoryId, setCategoryId] = useState(template.categoryId);
  const [priority, setPriority] = useState<Priority>(template.priority);
  const [estimate, setEstimate] = useState(template.estimate);
  const [boss, setBoss] = useState(!!template.boss);
  const [steps, setSteps] = useState(template.steps.map((title) => ({ id: uid(), title, done: false })));

  return (
    <Sheet title={template.id ? 'Edit template' : 'New template'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          dispatch({
            type: 'saveTemplate',
            template: {
              ...(template.id ? { id: template.id } : {}),
              name,
              emoji,
              description: description.trim() || undefined,
              categoryId,
              priority,
              estimate,
              boss,
              steps: steps.map((s) => s.title.trim()).filter(Boolean),
            },
          });
          onDone();
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Weekly review" />
        </label>
        <div className="field">
          <span>Icon</span>
          <div className="chip-row wrap">
            {EMOJIS.map((e) => (
              <button key={e} type="button" className={`chip emoji-chip ${emoji === e ? 'active' : ''}`} onClick={() => setEmoji(e)} aria-label={e}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Description</span>
          <textarea className="text-input text-area" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="field">
          <span>Steps</span>
          <SubtaskEditor value={steps} onChange={setSteps} />
        </div>
        <div className="setting boss-setting glass-soft">
          <span>🐉 Boss battle</span>
          <button type="button" className={`toggle ${boss ? 'on' : ''}`} role="switch" aria-checked={boss} aria-label="Boss battle" onClick={() => setBoss((b) => !b)}>
            <span />
          </button>
        </div>
        <div className="field">
          <span>Category</span>
          <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
        </div>
        <div className="field">
          <span>Priority</span>
          <PriorityPicker value={priority} onChange={setPriority} />
        </div>
        <div className="field">
          <span>Time estimate</span>
          <EstimatePicker value={estimate} onChange={setEstimate} />
        </div>
        <div className="form-actions">
          {template.id ? (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                dispatch({ type: 'deleteTemplate', id: template.id });
                onDone();
              }}
            >
              Delete
            </button>
          ) : (
            <button type="button" className="btn" onClick={onDone}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn primary" disabled={!name.trim()}>
            Save
          </button>
        </div>
      </form>
    </Sheet>
  );
}
