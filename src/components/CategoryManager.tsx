import { useState } from 'react';
import { CATEGORY_COLORS, type Action } from '../core/store';
import type { Category, Task } from '../core/types';
import { Sheet } from './Sheet';

const EMOJI_SUGGESTIONS = ['📌', '🏡', '💼', '💪', '🛒', '📚', '🎨', '💰', '✈️', '🎮', '🧘', '🐶', '🍳', '🎵', '🚀', '❤️'];

interface Props {
  categories: Category[];
  tasks: Task[];
  dispatch: (a: Action) => void;
  onClose: () => void;
}

export function CategoryManager({ categories, tasks, dispatch, onClose }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🚀');
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[(categories.length * 2) % CATEGORY_COLORS.length]);

  const add = () => {
    if (!newName.trim()) return;
    dispatch({ type: 'addCategory', name: newName, emoji: newEmoji, color: newColor });
    setNewName('');
    setNewColor(CATEGORY_COLORS[((categories.length + 1) * 2) % CATEGORY_COLORS.length]);
  };

  return (
    <Sheet title="Categories" onClose={onClose}>
      <ul className="cat-list">
        {categories.map((c, i) => {
          const count = tasks.filter((t) => t.categoryId === c.id).length;
          const isEditing = editing === c.id;
          return (
            <li key={c.id} className="cat-row glass-soft" style={{ borderLeftColor: c.color }}>
              <div className="cat-row-main">
                <input
                  className="emoji-input"
                  value={c.emoji}
                  maxLength={4}
                  aria-label={`Emoji for ${c.name}`}
                  onChange={(e) => dispatch({ type: 'updateCategory', id: c.id, patch: { emoji: e.target.value } })}
                  onBlur={(e) => !e.target.value.trim() && dispatch({ type: 'updateCategory', id: c.id, patch: { emoji: '📌' } })}
                />
                <input
                  className="text-input cat-name"
                  value={c.name}
                  aria-label="Category name"
                  onChange={(e) => dispatch({ type: 'updateCategory', id: c.id, patch: { name: e.target.value } })}
                  onBlur={(e) => !e.target.value.trim() && dispatch({ type: 'updateCategory', id: c.id, patch: { name: 'Untitled' } })}
                />
                <button className="icon-btn" disabled={i === 0} onClick={() => dispatch({ type: 'moveCategory', id: c.id, delta: -1 })} aria-label="Move up">↑</button>
                <button className="icon-btn" disabled={i === categories.length - 1} onClick={() => dispatch({ type: 'moveCategory', id: c.id, delta: 1 })} aria-label="Move down">↓</button>
                <button
                  className={`icon-btn swatch-btn ${isEditing ? 'open' : ''}`}
                  style={{ background: c.color }}
                  onClick={() => setEditing(isEditing ? null : c.id)}
                  aria-label="Change color"
                  aria-expanded={isEditing}
                />
                <button className="icon-btn" onClick={() => setConfirmDelete(c.id)} aria-label={`Delete ${c.name}`}>🗑</button>
              </div>
              {isEditing && (
                <div className="swatches">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`swatch ${color === c.color ? 'active' : ''}`}
                      style={{ background: color }}
                      aria-label={`Color ${color}`}
                      onClick={() => dispatch({ type: 'updateCategory', id: c.id, patch: { color } })}
                    />
                  ))}
                  <label className="swatch custom" aria-label="Custom color">
                    <input type="color" value={c.color} onChange={(e) => dispatch({ type: 'updateCategory', id: c.id, patch: { color: e.target.value } })} />
                  </label>
                </div>
              )}
              {confirmDelete === c.id && (
                <div className="confirm">
                  <span>
                    Delete “{c.name}”?{count > 0 && ` Its ${count} task${count === 1 ? '' : 's'} will be kept as uncategorized.`}
                  </span>
                  <button className="btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  <button className="btn danger" onClick={() => dispatch({ type: 'deleteCategory', id: c.id })}>Delete</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form
        className="new-cat glass-soft"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <h3>New category</h3>
        <div className="cat-row-main">
          <input className="emoji-input" value={newEmoji} maxLength={4} onChange={(e) => setNewEmoji(e.target.value)} aria-label="Emoji" />
          <input className="text-input cat-name" placeholder="e.g. Side project" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="New category name" />
          <button type="submit" className="btn primary" disabled={!newName.trim()}>Add</button>
        </div>
        <div className="emoji-suggest">
          {EMOJI_SUGGESTIONS.map((em) => (
            <button type="button" key={em} className={`emoji-opt ${em === newEmoji ? 'active' : ''}`} onClick={() => setNewEmoji(em)}>
              {em}
            </button>
          ))}
        </div>
        <div className="swatches">
          {CATEGORY_COLORS.map((color) => (
            <button
              type="button"
              key={color}
              className={`swatch ${color === newColor ? 'active' : ''}`}
              style={{ background: color }}
              aria-label={`Color ${color}`}
              onClick={() => setNewColor(color)}
            />
          ))}
        </div>
      </form>
    </Sheet>
  );
}
