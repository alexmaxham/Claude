import { useState } from 'react';
import { snoozeOptions } from '../core/dates';
import { bossBounty } from '../core/gamification';
import type { TaskPatch } from '../core/store';
import type { Category, Task, Template } from '../core/types';
import { CategoryPicker, DuePicker, EstimatePicker, PriorityPicker, RepeatPicker } from './Pickers';
import { Sheet } from './Sheet';
import { SubtaskEditor } from './SubtaskEditor';

interface Props {
  task: Task;
  categories: Category[];
  onSave: (patch: TaskPatch) => void;
  onDelete: () => void;
  onFocus: () => void;
  onSaveTemplate: (template: Omit<Template, 'id'>) => void;
  onClose: () => void;
}

export function TaskEditor({ task, categories, onSave, onDelete, onFocus, onSaveTemplate, onClose }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [categoryId, setCategoryId] = useState(task.categoryId);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [subtasks, setSubtasks] = useState(task.subtasks ?? []);
  const [repeat, setRepeat] = useState(task.repeat ?? null);
  const [estimate, setEstimate] = useState(task.estimate);
  const [boss, setBoss] = useState(!!task.boss);
  const [savedTemplate, setSavedTemplate] = useState(false);

  const steps = () => subtasks.map((s) => ({ ...s, title: s.title.trim() })).filter((s) => s.title);
  const patch = (): TaskPatch => ({ title: title.trim(), description: description.trim(), subtasks: steps(), repeat, categoryId, priority, dueDate, estimate, boss });

  const save = () => {
    if (!title.trim()) return;
    onSave(patch());
    onClose();
  };

  return (
    <Sheet title="Edit quest" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="field">
          <span>Title</span>
          <input className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        {!task.completedAt && (
          <div className="editor-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (title.trim()) onSave(patch());
                onFocus();
                onClose();
              }}
            >
              🎧 Focus
            </button>
            {snoozeOptions().map((o) => (
              <button
                key={o.day}
                type="button"
                className="btn"
                onClick={() => {
                  if (!title.trim()) return;
                  onSave({ ...patch(), dueDate: o.day });
                  onClose();
                }}
              >
                💤 {o.label}
              </button>
            ))}
          </div>
        )}
        <label className="field">
          <span>Description</span>
          <textarea
            className="text-input text-area"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details, links or steps…"
            rows={4}
          />
        </label>
        <div className="field">
          <span>
            Steps
            {subtasks.length > 0 && <span className="muted"> · {subtasks.filter((s) => s.done).length}/{subtasks.length} done, +3 XP each</span>}
          </span>
          <SubtaskEditor value={subtasks} onChange={setSubtasks} />
        </div>
        <div className="setting boss-setting glass-soft">
          <span>
            🐉 Boss battle
            <span className="muted small" style={{ display: 'block' }}>
              {boss
                ? `Each step is a hit point. Beat it for a +${bossBounty({ ...task, boss: true, subtasks })} XP bounty.`
                : 'For big projects: steps become the boss’s health, and finishing pays a bounty.'}
            </span>
          </span>
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
          <span>Due</span>
          <DuePicker value={dueDate} onChange={setDueDate} />
        </div>
        <div className="field">
          <span>Time estimate</span>
          <EstimatePicker value={estimate} onChange={setEstimate} />
        </div>
        <div className="field">
          <span>Repeat</span>
          <RepeatPicker value={repeat} dueDate={dueDate} onChange={setRepeat} />
        </div>
        {task.completedAt && (
          <p className="muted small">
            Completed {new Date(task.completedAt).toLocaleString()} · earned {task.xpAwarded} XP
          </p>
        )}
        <button
          type="button"
          className="link-btn template-save"
          disabled={!title.trim() || savedTemplate}
          onClick={() => {
            onSaveTemplate({
              name: title.trim(),
              emoji: boss ? '🐉' : '📋',
              description: description.trim() || undefined,
              categoryId,
              priority,
              steps: steps().map((s) => s.title),
              estimate,
              boss,
            });
            setSavedTemplate(true);
          }}
        >
          {savedTemplate ? '✓ Saved as a template' : '📋 Save as a template'}
        </button>
        <div className="form-actions">
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            Delete
          </button>
          <button type="submit" className="btn primary" disabled={!title.trim()}>
            Save
          </button>
        </div>
      </form>
    </Sheet>
  );
}
