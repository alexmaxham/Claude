import { addDays, dayKey } from './dates';
import type { Category, Priority, Repeat } from './types';

/** One recognized piece of a typed quest, shown as a chip under the input. */
export interface ParsedToken {
  kind: 'date' | 'repeat' | 'category' | 'priority' | 'estimate' | 'boss';
  /** The text as typed; tapping the chip ignores it so it stays in the title. */
  text: string;
  label: string;
}

export interface ParsedQuest {
  title: string;
  dueDate?: string;
  repeat?: Repeat;
  categoryId?: string;
  priority?: Priority;
  estimate?: number;
  boss?: boolean;
  tokens: ParsedToken[];
}

interface Options {
  categories: Category[];
  /** Day key to resolve "today", "friday" and so on against. */
  today?: string;
  /** Typed tokens (lowercase) to leave alone. */
  ignore?: Set<string>;
  /** Read 3/4 as 3 April rather than March 4. */
  dayFirst?: boolean;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
// "sat" and "sun" are left out as abbreviations: they're too often just words ("SAT prep", "in the sun").
const DAY = '(sunday|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday)';
const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const ORD = '(\\d{1,2})(?:st|nd|rd|th)?';
// Words count only on their own: start of text or after a space, and before a space, punctuation or the end.
const B = '(?<=^|\\s)';
const E = '(?=$|[\\s,.!?;])';

const weekdayIndex = (word: string) => WEEKDAYS.findIndex((d) => d.startsWith(word.toLowerCase().slice(0, 3)));
const monthIndex = (word: string) => MONTHS.findIndex((m) => m.startsWith(word.toLowerCase().slice(0, 3)));

function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** The next `weekday` after today (a week out if today is that day). */
function nextWeekday(today: string, weekday: number): string {
  const diff = (weekday - weekdayOf(today) + 7) % 7 || 7;
  return addDays(today, diff);
}

function addMonths(today: string, n: number): string {
  const [y, m, d] = today.split('-').map(Number);
  const last = new Date(y, m - 1 + n + 1, 0).getDate();
  return dayKey(new Date(y, m - 1 + n, Math.min(d, last)));
}

/** A month and day this year, or next year if it has passed. Null if it isn't a real date. */
function monthDay(today: string, month: number, day: number, year?: number): string | null {
  const y = year ?? Number(today.slice(0, 4));
  const date = new Date(y, month, day);
  if (date.getMonth() !== month || date.getDate() !== day) return null;
  const key = dayKey(date);
  return year === undefined && key < today ? dayKey(new Date(y + 1, month, day)) : key;
}

function formatDay(key: string, today: string): string {
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const soon = key > today && key <= addDays(today, 6);
  return date.toLocaleDateString(undefined, soon ? { weekday: 'long' } : { month: 'short', day: 'numeric', ...(y === Number(today.slice(0, 4)) ? {} : { year: 'numeric' }) });
}

export function formatEstimate(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

type Rule = { re: RegExp; kind?: ParsedToken['kind']; apply: (m: RegExpExecArray, today: string, dayFirst: boolean) => Partial<ParsedQuest> | null };

const REPEAT_RULES: Rule[] = [
  { re: new RegExp(`${B}(?:every ?day|daily)${E}`, 'i'), apply: () => ({ repeat: { kind: 'daily' } }) },
  { re: new RegExp(`${B}(?:every ?weekday|weekdays)${E}`, 'i'), apply: () => ({ repeat: { kind: 'weekly', days: [1, 2, 3, 4, 5] } }) },
  { re: new RegExp(`${B}(?:every ?weekend|weekends)${E}`, 'i'), apply: () => ({ repeat: { kind: 'weekly', days: [0, 6] } }) },
  {
    // "Weekly on Mon, Wed" and "Every 2 weeks on Fri", as repeatLabel writes them.
    re: new RegExp(`${B}(?:weekly|every ?week|every (\\d{1,2}) weeks) on ${DAY}(?:(?:,? ?(?:and )?)${DAY})*${E}`, 'i'),
    apply: (m) => {
      const days = [...m[0].replace(/^.*? on /i, '').matchAll(new RegExp(DAY, 'gi'))].map((x) => weekdayIndex(x[1]));
      const n = Number(m[1] ?? 1);
      return { repeat: { kind: 'weekly', days: [...new Set(days)].sort(), ...(n > 1 ? { interval: n } : {}) } };
    },
  },
  {
    re: new RegExp(`${B}every (\\d{1,2}) (day|week|month)s?${E}`, 'i'),
    apply: (m) => {
      const n = Math.max(1, Number(m[1]));
      const unit = m[2].toLowerCase();
      return { repeat: unit === 'day' ? { kind: 'daily', interval: n } : unit === 'week' ? { kind: 'weekly', days: [], interval: n } : { kind: 'monthly', interval: n } };
    },
  },
  {
    re: new RegExp(`${B}every ${DAY}(?:(?:,? ?(?:and )?)${DAY})*${E}`, 'i'),
    apply: (m) => {
      const days = [...m[0].matchAll(new RegExp(DAY, 'gi'))].map((x) => weekdayIndex(x[1]));
      return { repeat: { kind: 'weekly', days: [...new Set(days)].sort() } };
    },
  },
  { re: new RegExp(`${B}(?:every ?week|weekly)${E}`, 'i'), apply: () => ({ repeat: { kind: 'weekly', days: [] } }) },
  { re: new RegExp(`${B}(?:every ?month|monthly)${E}`, 'i'), apply: () => ({ repeat: { kind: 'monthly' } }) },
  { re: new RegExp(`${B}(?:every ?year|yearly|annually)${E}`, 'i'), apply: () => ({ repeat: { kind: 'yearly' } }) },
];

// "due", "on" or "by" in front of a date goes with it.
const P = '(?:(?:due|on|by) )?';

const DATE_RULES: Rule[] = [
  { re: new RegExp(`${B}${P}(?:today|tonight)${E}`, 'i'), apply: (_m, t) => ({ dueDate: t }) },
  { re: new RegExp(`${B}${P}(?:tomorrow|tmrw?|tmw)${E}`, 'i'), apply: (_m, t) => ({ dueDate: addDays(t, 1) }) },
  {
    re: new RegExp(`${B}${P}in (\\d{1,3}) (day|week|month)s?${E}`, 'i'),
    apply: (m, t) => {
      const n = Number(m[1]);
      const unit = m[2].toLowerCase();
      return { dueDate: unit === 'day' ? addDays(t, n) : unit === 'week' ? addDays(t, n * 7) : addMonths(t, n) };
    },
  },
  { re: new RegExp(`${B}${P}next week${E}`, 'i'), apply: (_m, t) => ({ dueDate: nextWeekday(t, 1) }) },
  { re: new RegExp(`${B}${P}(?:this |next )?weekend${E}`, 'i'), apply: (_m, t) => ({ dueDate: weekdayOf(t) === 6 ? t : nextWeekday(t, 6) }) },
  {
    re: new RegExp(`${B}${P}next month${E}`, 'i'),
    apply: (_m, t) => {
      const [y, m] = t.split('-').map(Number);
      return { dueDate: dayKey(new Date(y, m, 1)) };
    },
  },
  {
    re: new RegExp(`${B}${P}(?:end of (?:the )?month|eom)${E}`, 'i'),
    apply: (_m, t) => {
      const [y, m] = t.split('-').map(Number);
      return { dueDate: dayKey(new Date(y, m, 0)) };
    },
  },
  {
    re: new RegExp(`${B}${P}(?:this |next )?${DAY}${E}`, 'i'),
    apply: (m, t) => ({ dueDate: nextWeekday(t, weekdayIndex(m[1])) }),
  },
  {
    re: new RegExp(`${B}${P}(\\d{4})-(\\d{2})-(\\d{2})${E}`, 'i'),
    apply: (m, t) => {
      const d = monthDay(t, Number(m[2]) - 1, Number(m[3]), Number(m[1]));
      return d ? { dueDate: d } : null;
    },
  },
  {
    re: new RegExp(`${B}${P}${MONTH} ${ORD}${E}`, 'i'),
    apply: (m, t) => {
      const d = monthDay(t, monthIndex(m[1]), Number(m[2]));
      return d ? { dueDate: d } : null;
    },
  },
  {
    re: new RegExp(`${B}${P}${ORD}(?: of)? ${MONTH}${E}`, 'i'),
    apply: (m, t) => {
      const d = monthDay(t, monthIndex(m[2]), Number(m[1]));
      return d ? { dueDate: d } : null;
    },
  },
  {
    re: new RegExp(`${B}${P}(\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?${E}`, 'i'),
    apply: (m, t, dayFirst) => {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
      const d = dayFirst ? monthDay(t, b - 1, a, year) : monthDay(t, a - 1, b, year);
      return d ? { dueDate: d } : null;
    },
  },
];

const OTHER_RULES: Rule[] = [
  { re: new RegExp(`${B}!boss${E}`, 'i'), kind: 'boss', apply: () => ({ boss: true }) },
  { re: new RegExp(`${B}(?:!high|!h|!1|!!!|p1)${E}`, 'i'), kind: 'priority', apply: () => ({ priority: 'high' }) },
  { re: new RegExp(`${B}(?:!medium|!med|!m|!2|!!|p2)${E}`, 'i'), kind: 'priority', apply: () => ({ priority: 'medium' }) },
  { re: new RegExp(`${B}(?:!low|!l|!3|p3)${E}`, 'i'), kind: 'priority', apply: () => ({ priority: 'low' }) },
  {
    kind: 'estimate',
    re: new RegExp(`${B}~(\\d+(?:\\.\\d+)?) ?(h|hr|hrs|hours?|m|min|mins|minutes?)?${E}`, 'i'),
    apply: (m) => {
      const n = Number(m[1]);
      const minutes = Math.round(m[2] && m[2].toLowerCase().startsWith('h') ? n * 60 : n);
      return minutes > 0 && minutes <= 24 * 60 ? { estimate: minutes } : null;
    },
  },
];

const cut = (s: string, at: number, length: number) => `${s.slice(0, at)} ${s.slice(at + length)}`;

const PRIORITY_LABEL: Record<Priority, string> = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' };

/**
 * Pulls dates, repeats, #categories, !priority, ~estimates and !boss out of a typed quest,
 * e.g. "Call mom tomorrow #personal !high ~15m". What's left is the title.
 */
export function parseQuest(text: string, { categories, today = dayKey(), ignore, dayFirst = false }: Options): ParsedQuest {
  let rest = ` ${text} `;
  const out: ParsedQuest = { title: '', tokens: [] };

  const take = (rules: Rule[], kind: ParsedToken['kind'], label: (r: Partial<ParsedQuest>) => string) => {
    for (const rule of rules) {
      const re = new RegExp(rule.re.source, 'gi');
      for (const m of rest.matchAll(re)) {
        const typed = m[0].trim();
        if (ignore?.has(typed.toLowerCase())) continue;
        const result = rule.apply(m as RegExpExecArray, today, dayFirst);
        if (!result) continue;
        Object.assign(out, result);
        out.tokens.push({ kind, text: typed, label: label(result) });
        rest = cut(rest, m.index!, m[0].length);
        return; // one of each kind; later ones stay in the title
      }
    }
  };

  take(REPEAT_RULES, 'repeat', () => 'Repeats');
  take(DATE_RULES, 'date', (r) => formatDay(r.dueDate!, today));
  for (const rule of OTHER_RULES) {
    if (rule.kind === 'priority' && out.priority) continue;
    take([rule], rule.kind!, (r) => (r.boss ? 'Boss battle' : r.estimate ? formatEstimate(r.estimate) : PRIORITY_LABEL[r.priority!]));
  }

  // #category matches the start of a category name, ignoring case and spaces.
  for (const m of rest.matchAll(/(?<=^|\s)#([\p{L}\p{N}_-]+)(?=$|[\s,.!?;])/giu)) {
    if (ignore?.has(m[0].toLowerCase())) continue;
    const word = m[1].toLowerCase();
    const flat = (c: Category) => c.name.toLowerCase().replace(/\s+/g, '');
    const cat = categories.find((c) => flat(c) === word) ?? categories.find((c) => flat(c).startsWith(word));
    if (!cat) continue;
    out.categoryId = cat.id;
    out.tokens.push({ kind: 'category', text: m[0], label: `${cat.emoji} ${cat.name}` });
    rest = cut(rest, m.index!, m[0].length);
    break;
  }

  // A weekly repeat with no days given repeats on the due date's weekday.
  if (out.repeat?.kind === 'weekly' && !out.repeat.days.length) {
    out.repeat = { ...out.repeat, days: [weekdayOf(out.dueDate ?? today)] };
  }
  out.title = rest.replace(/\s+/g, ' ').trim();
  return out;
}

/** True when the reader's locale writes the day before the month (3/4 = 3 April). */
export function localeDayFirst(): boolean {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'numeric' }).formatToParts(new Date(2026, 2, 4));
    return parts.findIndex((p) => p.type === 'day') < parts.findIndex((p) => p.type === 'month');
  } catch {
    return false;
  }
}
