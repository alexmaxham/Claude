import { parseQuest } from './parse';
import { uid, type NewTask } from './store';
import { parseState } from './storage';
import type { AppState, Priority } from './types';

export type ImportedTask = NewTask & { categoryName?: string };

export interface ImportResult {
  format: 'Tasko backup' | 'Todoist' | 'Spreadsheet' | 'Checklist';
  tasks: ImportedTask[];
  /** A full Tasko backup, which can replace everything instead. */
  backup?: AppState;
}

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function priorityFrom(value: string): Priority | undefined {
  const v = value.trim().toLowerCase();
  if (['high', 'h', 'p1', '1', 'urgent', '!!!'].includes(v)) return 'high';
  if (['medium', 'med', 'm', 'p2', '2', 'normal', '!!'].includes(v)) return 'medium';
  if (['low', 'l', 'p3', 'p4', '3', '4', 'none', '!'].includes(v)) return 'low';
  return undefined;
}

/** Due date and repeat from free text like "2026-10-24", "Oct 24" or "every monday". */
function whenFrom(text: string): Pick<NewTask, 'dueDate' | 'repeat'> {
  if (!text.trim()) return {};
  const parsed = parseQuest(text, { categories: [] });
  return { ...(parsed.dueDate ? { dueDate: parsed.dueDate } : {}), ...(parsed.repeat ? { repeat: parsed.repeat } : {}) };
}

function steps(titles: string[]) {
  return titles.map((t) => {
    const done = /^\[x\]/i.test(t.trim());
    return { id: uid(), title: t.trim().replace(/^\[[ x]\]\s*/i, ''), done };
  });
}

function fromTodoist(rows: string[][]): ImportedTask[] {
  const head = rows[0].map((h) => h.trim().toUpperCase());
  const col = (name: string) => head.indexOf(name);
  const [type, content, description, priority, indent, date] = ['TYPE', 'CONTENT', 'DESCRIPTION', 'PRIORITY', 'INDENT', 'DATE'].map(col);
  const tasks: ImportedTask[] = [];
  let section: string | undefined;
  for (const r of rows.slice(1)) {
    const kind = (r[type] ?? '').trim().toLowerCase();
    const title = (r[content] ?? '').trim();
    if (kind === 'section') section = title || undefined;
    if (kind !== 'task' || !title) continue;
    const parent = tasks[tasks.length - 1];
    if (Number(r[indent] ?? 1) > 1 && parent) {
      parent.subtasks = [...(parent.subtasks ?? []), { id: uid(), title, done: false }];
      continue;
    }
    // Todoist writes priority 1 for its most urgent (red) tasks in these templates.
    const p = Number(r[priority]);
    tasks.push({
      title,
      description: r[description]?.trim() || undefined,
      priority: p === 1 ? 'high' : p === 2 ? 'medium' : 'low',
      categoryName: section,
      ...whenFrom(r[date] ?? ''),
    });
  }
  return tasks;
}

const HEADERS = {
  title: ['title', 'task', 'name', 'content', 'subject', 'to do', 'todo', 'item'],
  description: ['description', 'notes', 'note', 'details'],
  category: ['category', 'list', 'project', 'section', 'tag', 'tags'],
  priority: ['priority', 'importance'],
  due: ['due date', 'due', 'date', 'deadline', 'due on'],
  repeat: ['repeat', 'recurrence', 'repeats'],
  steps: ['steps', 'subtasks', 'checklist'],
  status: ['status', 'completed', 'done', 'state'],
  completedAt: ['completed at', 'completed date', 'done at'],
};

function fromSpreadsheet(rows: string[][]): ImportedTask[] {
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const find = (names: string[]) => head.findIndex((h) => names.includes(h));
  const idx = Object.fromEntries(Object.entries(HEADERS).map(([k, names]) => [k, find(names)])) as Record<keyof typeof HEADERS, number>;
  // No recognizable header: treat the first column of every row as a title.
  const hasHeader = idx.title >= 0;
  const body = hasHeader ? rows.slice(1) : rows;
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
  return body
    .map((r): ImportedTask | null => {
      const title = get(r, hasHeader ? idx.title : 0);
      if (!title) return null;
      const status = get(r, idx.status).toLowerCase();
      const done = ['done', 'completed', 'complete', 'yes', 'true', 'x', '1'].includes(status);
      const at = Date.parse(get(r, idx.completedAt));
      const stepText = get(r, idx.steps);
      return {
        title,
        description: get(r, idx.description) || undefined,
        categoryName: get(r, idx.category) || undefined,
        priority: priorityFrom(get(r, idx.priority)),
        ...whenFrom(get(r, idx.due)),
        ...(get(r, idx.repeat) ? { repeat: whenFrom(get(r, idx.repeat)).repeat } : {}),
        ...(stepText ? { subtasks: steps(stepText.split(';').filter((s) => s.trim())) } : {}),
        ...(done ? { completedAt: Number.isNaN(at) ? Date.now() : at } : {}),
      };
    })
    .filter((t): t is ImportedTask => !!t);
}

/**
 * Markdown checklists and plain lists, e.g. copied from Apple Reminders, Notes, Things or Notion.
 * Headings become categories, indented items become steps, and each line can use quick-add
 * shorthand like "tomorrow" or "!high".
 */
function fromChecklist(text: string): ImportedTask[] {
  const tasks: ImportedTask[] = [];
  let heading: string | undefined;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const h = raw.match(/^\s*#{1,6}\s+(.+)$/);
    if (h) {
      // Drop a leading emoji so "🏡 Personal" matches the Personal category.
      heading = h[1].replace(/^[^\p{L}\p{N}]+/u, '').trim() || undefined;
      continue;
    }
    if (/^\s*>/.test(raw)) {
      const last = tasks[tasks.length - 1];
      if (last) last.description = [last.description, raw.replace(/^\s*>\s?/, '')].filter(Boolean).join('\n');
      continue;
    }
    const m = raw.match(/^(\s*)(?:[-*+•◦▪]|\d+[.)])?\s*(?:\[([ xX])\]\s*)?(.+)$/);
    if (!m) continue;
    const [, indent, check, body] = m;
    const parent = tasks[tasks.length - 1];
    if (indent.replace(/\t/g, '  ').length >= 2 && parent) {
      parent.subtasks = [...(parent.subtasks ?? []), { id: uid(), title: body.trim(), done: check?.toLowerCase() === 'x' }];
      continue;
    }
    // Our own Markdown export writes "(due 2026-10-24, high priority)" after the title.
    const meta = body.match(/^(.*?)\s*\(([^()]*(?:due \d{4}-\d{2}-\d{2}|priority)[^()]*)\)\s*$/);
    const title = meta ? meta[1] : body;
    const parsed = parseQuest(title, { categories: [] });
    const due = meta?.[2].match(/due (\d{4}-\d{2}-\d{2})/)?.[1];
    const prio = meta?.[2].match(/(high|medium|low) priority/)?.[1] as Priority | undefined;
    tasks.push({
      title: parsed.title || title.trim(),
      categoryName: heading,
      priority: prio ?? parsed.priority,
      dueDate: due ?? parsed.dueDate ?? null,
      repeat: parsed.repeat ?? null,
      estimate: parsed.estimate,
      ...(check?.toLowerCase() === 'x' ? { completedAt: Date.now() } : {}),
    });
  }
  return tasks;
}

/** Works out what was pasted or picked and turns it into tasks. */
export function parseImport(text: string, filename = ''): ImportResult | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed);
      if (Array.isArray(json.tasks)) {
        const backup = parseState(trimmed);
        const names = new Map(backup.categories.map((c) => [c.id, c.name]));
        return {
          format: 'Tasko backup',
          backup,
          tasks: backup.tasks.map((t) => ({ ...t, categoryId: null, categoryName: names.get(t.categoryId ?? '') })),
        };
      }
    } catch {
      // not JSON after all
    }
  }

  const looksCsv = /\.csv$/i.test(filename) || /^[^\n]*,[^\n]*\n/.test(trimmed);
  if (looksCsv) {
    const rows = parseCsv(trimmed);
    if (rows.length) {
      const head = rows[0].map((h) => h.trim().toUpperCase());
      if (head.includes('TYPE') && head.includes('CONTENT')) return { format: 'Todoist', tasks: fromTodoist(rows) };
      if (rows[0].length > 1) return { format: 'Spreadsheet', tasks: fromSpreadsheet(rows) };
    }
  }
  return { format: 'Checklist', tasks: fromChecklist(trimmed) };
}
