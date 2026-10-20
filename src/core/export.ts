import { repeatLabel } from './recurrence';
import type { AppState, Repeat, Task } from './types';

/** Open tasks first (in due-date order), then completed ones. */
function ordered(tasks: Task[]): Task[] {
  const due = (t: Task) => t.dueDate ?? '9999';
  return [...tasks].sort(
    (a, b) => Number(!!a.completedAt) - Number(!!b.completedAt) || due(a).localeCompare(due(b)) || a.createdAt - b.createdAt,
  );
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRows(rows: (string | number)[][]): string {
  // Excel and Todoist both expect CRLF line endings.
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const DAY_WORDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Todoist's natural-language recurring date, e.g. "every weekday" or "every 2 weeks". */
export function todoistRepeat(repeat: Repeat): string {
  switch (repeat.kind) {
    case 'daily':
      return (repeat.interval ?? 1) === 1 ? 'every day' : `every ${repeat.interval} days`;
    case 'weekly': {
      const n = repeat.interval ?? 1;
      const days = [...repeat.days].sort();
      if (n === 1 && days.join() === '1,2,3,4,5') return 'every weekday';
      if (n === 1 && days.join() === '0,6') return 'every sat, sun';
      if (n === 1 && days.length) return `every ${days.map((d) => DAY_WORDS[d]).join(', ')}`;
      return n === 1 ? 'every week' : `every ${n} weeks`;
    }
    case 'monthly':
      return (repeat.interval ?? 1) === 1 ? 'every month' : `every ${repeat.interval} months`;
    case 'yearly':
      return 'every year';
  }
}

const TODOIST_PRIORITY = { high: 1, medium: 2, low: 4 } as const;

/**
 * Todoist's project import template (Projects → ⋯ → Import from template).
 * Categories become sections, steps become indented sub-tasks. Only open tasks are included.
 */
export function toTodoistCsv(state: AppState): string {
  const header = ['TYPE', 'CONTENT', 'DESCRIPTION', 'PRIORITY', 'INDENT', 'AUTHOR', 'RESPONSIBLE', 'DATE', 'DATE_LANG', 'TIMEZONE'];
  const rows: (string | number)[][] = [header];
  const open = ordered(state.tasks.filter((t) => !t.completedAt));
  const groups = [
    { name: null as string | null, tasks: open.filter((t) => !state.categories.some((c) => c.id === t.categoryId)) },
    ...state.categories.map((c) => ({ name: c.name, tasks: open.filter((t) => t.categoryId === c.id) })),
  ];
  for (const g of groups) {
    if (!g.tasks.length) continue;
    if (g.name) rows.push(['section', g.name, '', '', '', '', '', '', '', '']);
    for (const t of g.tasks) {
      const date = t.repeat ? `${todoistRepeat(t.repeat)}${t.dueDate ? ` starting ${t.dueDate}` : ''}` : (t.dueDate ?? '');
      rows.push(['task', t.title, t.description ?? '', TODOIST_PRIORITY[t.priority], 1, '', '', date, date ? 'en' : '', '']);
      for (const s of t.subtasks ?? []) {
        if (!s.done) rows.push(['task', s.title, '', 4, 2, '', '', '', '', '']);
      }
    }
  }
  return csvRows(rows);
}

/** A plain spreadsheet of every task, for Excel, Google Sheets or apps with a CSV importer. */
export function toCsv(state: AppState): string {
  const cat = new Map(state.categories.map((c) => [c.id, c.name]));
  const rows: (string | number)[][] = [
    ['Title', 'Description', 'Category', 'Priority', 'Due date', 'Repeat', 'Steps', 'Status', 'Completed at', 'Created at'],
  ];
  for (const t of ordered(state.tasks)) {
    rows.push([
      t.title,
      t.description ?? '',
      cat.get(t.categoryId ?? '') ?? '',
      t.priority,
      t.dueDate ?? '',
      t.repeat ? repeatLabel(t.repeat) : '',
      (t.subtasks ?? []).map((s) => `${s.done ? '[x]' : '[ ]'} ${s.title}`).join('; '),
      t.completedAt ? 'done' : 'open',
      t.completedAt ? new Date(t.completedAt).toISOString() : '',
      new Date(t.createdAt).toISOString(),
    ]);
  }
  return csvRows(rows);
}

/**
 * Markdown checklists grouped by category. Pastes cleanly into Things, Notion,
 * Obsidian, Apple Notes, GitHub and most other list apps.
 */
export function toMarkdown(state: AppState): string {
  const lines: string[] = ['# Tasko tasks', ''];
  const sections = [
    ...state.categories.map((c) => ({ title: `${c.emoji} ${c.name}`, tasks: state.tasks.filter((t) => t.categoryId === c.id) })),
    { title: 'No category', tasks: state.tasks.filter((t) => !state.categories.some((c) => c.id === t.categoryId)) },
  ];
  for (const sec of sections) {
    if (!sec.tasks.length) continue;
    lines.push(`## ${sec.title}`, '');
    for (const t of ordered(sec.tasks)) {
      const meta = [
        t.dueDate && `due ${t.dueDate}`,
        t.repeat && repeatLabel(t.repeat).toLowerCase(),
        t.priority !== 'low' && `${t.priority} priority`,
      ].filter(Boolean);
      lines.push(`- [${t.completedAt ? 'x' : ' '}] ${t.title}${meta.length ? ` (${meta.join(', ')})` : ''}`);
      if (t.description) for (const l of t.description.split('\n')) lines.push(`  > ${l}`);
      for (const s of t.subtasks ?? []) lines.push(`  - [${s.done ? 'x' : ' '}] ${s.title}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** Everything, exactly as stored: a full backup. */
export function toJson(state: AppState): string {
  return JSON.stringify({ app: 'tasko', exportedAt: new Date().toISOString(), ...state }, null, 2);
}
