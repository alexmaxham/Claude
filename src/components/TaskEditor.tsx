import { useState } from 'react';
import type { TaskPatch } from '../core/store';
import type { Category, Task } from '../core/types';
import { CategoryPicker, DuePicker, PriorityPicker, RepeatPicker } from './Pickers';
import { Sheet } from './Sheet';
import { SubtaskEditor } from './SubtaskEditor';

interface Props {
  task: Task;
  categories: Category[];
  onSave: (patch: TaskPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function TaskEditor({ task, categories, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [categoryId, setCategoryId] = useState(task.categoryId);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [subtasks, setSubtasks] = useState(task.subtasks ?? []);
  const [repeat, setRepeat] = useState(task.repeat ?? null);

  const save = () => {
    if (!title.trim()) return;
    const steps = subtasks.map((s) => ({ ...s, title: s.title.trim() })).filter((s) => s.title);
    onSave({ title: title.trim(), description: description.trim(), subtasks: steps, repeat, categoryId, priority, dueDate });
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
          <span>Repeat</span>
          <RepeatPicker value={repeat} dueDate={dueDate} onChange={setRepeat} />
        </div>
        {task.completedAt && (
          <p className="muted small">
            Completed {new Date(task.completedAt).toLocaleString()} · earned {task.xpAwarded} XP
          </p>
        )}
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
