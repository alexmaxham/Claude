import { useMemo, useState } from 'react';
import { parseImport } from '../core/importers';
import type { Action } from '../core/store';
import { Sheet } from './Sheet';

interface Props {
  dispatch: (a: Action) => void;
  onDone: (message: string) => void;
  onClose: () => void;
}

/** Bring quests in from Todoist, a spreadsheet, a pasted list or a Tasko backup. */
export function ImportSheet({ dispatch, onDone, onClose }: Props) {
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [includeDone, setIncludeDone] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const result = useMemo(() => parseImport(text, filename), [text, filename]);
  const tasks = result?.tasks.filter((t) => includeDone || !t.completedAt) ?? [];
  const doneCount = result?.tasks.filter((t) => t.completedAt).length ?? 0;

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setFilename(file.name);
    setText(await file.text());
  };

  return (
    <Sheet title="Import quests" onClose={onClose}>
      <p className="muted small">
        Pick a file or paste a list. Works with a <strong>Todoist</strong> CSV export, any <strong>spreadsheet</strong> saved as CSV,
        lists copied from <strong>Apple Reminders</strong>, Notes, Things or Notion (one quest per line), Markdown checklists, and Tasko backups.
      </p>
      <label className="btn import-file">
        📄 Choose a file…
        <input type="file" accept=".csv,.txt,.md,.json,text/*,application/json" onChange={(e) => pickFile(e.target.files?.[0])} />
      </label>
      <textarea
        className="text-input text-area import-text"
        rows={7}
        placeholder={'Or paste here, e.g.\nBuy milk tomorrow\nCall the bank #errands !high\n- [ ] Book flights'}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setFilename('');
        }}
        aria-label="Paste a list"
      />
      {result && (
        <div className="import-preview glass-soft">
          <strong>
            {tasks.length} quest{tasks.length === 1 ? '' : 's'} found
          </strong>
          <span className="muted small"> · read as {result.format}</span>
          <ul>
            {tasks.slice(0, 6).map((t, i) => (
              <li key={i}>
                {t.title}
                <span className="muted small">
                  {[t.categoryName, t.dueDate, t.subtasks?.length && `${t.subtasks.length} steps`].filter(Boolean).map((x) => ` · ${x}`)}
                </span>
              </li>
            ))}
            {tasks.length > 6 && <li className="muted small">and {tasks.length - 6} more</li>}
          </ul>
          {doneCount > 0 && (
            <label className="plan-move">
              <input type="checkbox" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} />
              Include {doneCount} completed (they won’t earn XP)
            </label>
          )}
        </div>
      )}
      <div className="form-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={!tasks.length}
          onClick={() => {
            dispatch({ type: 'importTasks', tasks });
            onDone(`${tasks.length} quest${tasks.length === 1 ? '' : 's'} imported`);
            onClose();
          }}
        >
          Import {tasks.length || ''}
        </button>
      </div>
      {result?.backup && (
        <div className="restore glass-soft">
          <span>
            <strong>Restore this backup instead?</strong>
            <span className="muted small" style={{ display: 'block' }}>
              Replaces all your quests, XP, trophies and settings with the backup’s.
            </span>
          </span>
          {confirmRestore ? (
            <button
              className="btn danger-fill"
              onClick={() => {
                dispatch({ type: 'load', state: result.backup! });
                onDone('Backup restored');
                onClose();
              }}
            >
              Replace everything
            </button>
          ) : (
            <button className="btn danger" onClick={() => setConfirmRestore(true)}>
              Restore
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
