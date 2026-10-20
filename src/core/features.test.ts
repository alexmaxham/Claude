import { describe, expect, it } from 'vitest';
import { addDays, dayKey } from './dates';
import { BASE_XP, BOSS_BOUNTY, BOSS_PER_STEP, effectiveStreak, ON_TIME_BONUS, xpForTask } from './gamification';
import { parseCsv, parseImport } from './importers';
import { mergeStates } from './merge';
import { parseQuest } from './parse';
import { reviewText, yearReview } from './review';
import { parseState } from './storage';
import { createInitialState, reduce, type Action } from './store';
import { toCsv, toJson, toMarkdown, toTodoistCsv } from './export';
import type { AppState } from './types';

const DAY = 86_400_000;
const NOON = new Date(2026, 9, 20, 12).getTime(); // Tuesday 20 October 2026
const TODAY = '2026-10-20';

function run(state: AppState, actions: Action[], now = NOON) {
  return actions.reduce((s, a) => reduce(s, a, now).state, state);
}

const add = (title: string, extra: Partial<Extract<Action, { type: 'addTask' }>> = {}): Action => ({ type: 'addTask', title, ...extra });

describe('quick-add parsing', () => {
  const categories = createInitialState().categories;
  const p = (text: string, dayFirst = false) => parseQuest(text, { categories, today: TODAY, dayFirst });

  it('pulls out dates, categories, priority and estimates', () => {
    const r = p('Call mom tomorrow #personal !high ~15m');
    expect(r.title).toBe('Call mom');
    expect(r.dueDate).toBe('2026-10-21');
    expect(r.categoryId).toBe('default-personal');
    expect(r.priority).toBe('high');
    expect(r.estimate).toBe(15);
    expect(r.tokens.map((t) => t.kind).sort()).toEqual(['category', 'date', 'estimate', 'priority']);
  });

  it('understands weekdays, relative days and calendar dates', () => {
    expect(p('Pay rent friday').dueDate).toBe('2026-10-23');
    expect(p('Standup on tuesday').dueDate).toBe('2026-10-27'); // today is Tuesday: next week's
    expect(p('Report in 3 days').dueDate).toBe('2026-10-23');
    expect(p('Plan next week').dueDate).toBe('2026-10-26');
    expect(p('Hike this weekend').dueDate).toBe('2026-10-24');
    expect(p('Party oct 31').dueDate).toBe('2026-10-31');
    expect(p('Taxes april 15th').dueDate).toBe('2027-04-15'); // already passed this year
    expect(p('Trip 3 nov').dueDate).toBe('2026-11-03');
    expect(p('Dentist 11/5').dueDate).toBe('2026-11-05');
    expect(p('Dentist 5/11', true).dueDate).toBe('2026-11-05');
    expect(p('Launch 2027-01-02').dueDate).toBe('2027-01-02');
    expect(p('Close books end of month').dueDate).toBe('2026-10-31');
  });

  it('understands repeats', () => {
    expect(p('Water plants every day').repeat).toEqual({ kind: 'daily' });
    expect(p('Gym every mon, wed and fri').repeat).toEqual({ kind: 'weekly', days: [1, 3, 5] });
    expect(p('Standup every weekday').repeat).toEqual({ kind: 'weekly', days: [1, 2, 3, 4, 5] });
    expect(p('Review every 2 weeks').repeat).toEqual({ kind: 'weekly', days: [2], interval: 2 });
    const r = p('Bins weekly friday');
    expect(r.dueDate).toBe('2026-10-23');
    expect(r.repeat).toEqual({ kind: 'weekly', days: [5] });
    expect(r.title).toBe('Bins');
  });

  it('leaves ordinary words and ignored tokens alone', () => {
    expect(p('Sit in the sun').title).toBe('Sit in the sun');
    expect(p('SAT prep').dueDate).toBeUndefined();
    expect(p('Fix #unknown tag').title).toBe('Fix #unknown tag');
    expect(p('Mayday drill').dueDate).toBeUndefined();
    const ignored = parseQuest('Read Today magazine', { categories, today: TODAY, ignore: new Set(['today']) });
    expect(ignored.title).toBe('Read Today magazine');
    expect(ignored.dueDate).toBeUndefined();
  });

  it('marks boss battles and hour estimates', () => {
    const r = p('Ship the website !boss ~2.5h');
    expect(r.boss).toBe(true);
    expect(r.estimate).toBe(150);
    expect(r.title).toBe('Ship the website');
  });
});

describe('boss battles', () => {
  it('reports hits and pays a bounty when beaten', () => {
    let s = run(createInitialState(), [
      add('Website', { boss: true, subtasks: [1, 2, 3].map((i) => ({ id: `s${i}`, title: `Step ${i}`, done: false })) }),
    ]);
    const id = s.tasks[0].id;
    const hit = reduce(s, { type: 'toggleSubtask', taskId: id, subtaskId: 's1' }, NOON);
    expect(hit.events).toContainEqual({ type: 'bossHit', taskId: id, hp: 2, maxHp: 3 });
    s = run(hit.state, [{ type: 'toggleSubtask', taskId: id, subtaskId: 's2' }, { type: 'toggleSubtask', taskId: id, subtaskId: 's3' }]);
    const win = reduce(s, { type: 'toggleTask', id }, NOON);
    const bounty = BOSS_BOUNTY + 3 * BOSS_PER_STEP;
    expect(win.events).toContainEqual({ type: 'bossDefeated', taskId: id, bounty });
    expect(win.state.stats.bossesDefeated).toBe(1);
    expect(win.state.stats.achievements.boss1).toBeDefined();
    const undo = reduce(win.state, { type: 'toggleTask', id }, NOON).state;
    expect(undo.stats.bossesDefeated).toBe(0);
    expect(undo.stats.xp).toBe(0);
  });
});

describe('streak freezes', () => {
  it('earns a freeze every 7 days and spends it on a missed day', () => {
    let s = createInitialState();
    for (let d = 0; d < 7; d++) {
      s = run(s, [add(`Day ${d}`)], NOON + d * DAY);
      s = run(s, [{ type: 'toggleTask', id: s.tasks[0].id }], NOON + d * DAY);
    }
    expect(s.stats.currentStreak).toBe(7);
    expect(s.stats.streakFreezes).toBe(1);

    // Skip a day: the streak still shows, and continues when the next task is done.
    const later = NOON + 8 * DAY;
    expect(effectiveStreak(s.stats, later)).toBe(7);
    s = run(s, [add('Back')], later);
    const r = reduce(s, { type: 'toggleTask', id: s.tasks[0].id }, later);
    expect(r.state.stats.currentStreak).toBe(8);
    expect(r.state.stats.streakFreezes).toBe(0);
    expect(r.state.stats.frozenDays).toEqual([dayKey(NOON + 7 * DAY)]);
    expect(r.events).toContainEqual({ type: 'freezeUsed', days: 1 });

    // Without freezes, missing two days resets it.
    expect(effectiveStreak(r.state.stats, later + 3 * DAY)).toBe(0);
  });
});

describe('daily surprise', () => {
  it('picks an open task for today and pays double for it', () => {
    let s = run(createInitialState(), [add('A', { dueDate: TODAY }), add('B'), { type: 'rollSurprise' }]);
    expect(s.stats.surprise?.day).toBe(TODAY);
    expect(s.stats.surprise?.taskId).toBe(s.tasks.find((t) => t.title === 'A')!.id); // due today beats undated
    // Rolling again the same day keeps it.
    expect(reduce(s, { type: 'rollSurprise' }, NOON).state).toBe(s);
    const r = reduce(s, { type: 'toggleTask', id: s.stats.surprise!.taskId }, NOON);
    const xp = Math.round((BASE_XP.medium + ON_TIME_BONUS) * 1.05 * 2); // day-one streak bonus, doubled
    expect(r.state.stats.xp).toBe(xp);
    expect(r.events).toContainEqual({ type: 'surprise', bonus: Math.round(xp / 2) });
    // A new day picks again.
    s = run(r.state, [{ type: 'rollSurprise' }], NOON + DAY);
    expect(s.stats.surprise).toEqual({ day: addDays(TODAY, 1), taskId: s.tasks.find((t) => t.title === 'B')!.id });
  });
});

describe('focus sessions', () => {
  it('adds XP and minutes to the task and the stats', () => {
    let s = run(createInitialState(), [add('Write')]);
    const r = reduce(s, { type: 'focusComplete', taskId: s.tasks[0].id, minutes: 25 }, NOON);
    s = r.state;
    expect(r.events).toContainEqual({ type: 'focusDone', minutes: 25, xp: 10 });
    expect(s.stats.xp).toBe(10);
    expect(s.stats.focusMinutes).toBe(25);
    expect(s.stats.focusSessions).toBe(1);
    expect(s.tasks[0].focusMinutes).toBe(25);
    expect(s.stats.achievements.focus1).toBeDefined();
  });
});

describe('planning and templates', () => {
  it('moves picked tasks to the day in the chosen order', () => {
    let s = run(createInitialState(), [add('A'), add('B'), add('C', { dueDate: '2026-10-10' })]);
    const id = (t: string) => s.tasks.find((x) => x.title === t)!.id;
    s = run(s, [{ type: 'planDay', ids: [id('C'), id('A')], day: TODAY }]);
    expect(s.tasks.find((t) => t.title === 'C')!.dueDate).toBe(TODAY);
    expect(s.tasks.find((t) => t.title === 'A')!.dueDate).toBe(TODAY);
    expect(s.tasks.find((t) => t.title === 'B')!.dueDate).toBeNull();
    const order = (t: string) => s.tasks.find((x) => x.title === t)!.order!;
    expect(order('C')).toBeLessThan(order('A'));
  });

  it('starts with built-in templates and saves new ones', () => {
    let s = createInitialState();
    expect(s.templates.length).toBeGreaterThan(0);
    s = run(s, [{ type: 'saveTemplate', template: { name: 'Groceries', emoji: '🛒', categoryId: null, priority: 'low', steps: ['Milk'] } }]);
    const t = s.templates.find((x) => x.name === 'Groceries')!;
    expect(t.id).toBeTruthy();
    expect(s.stats.achievements.blueprint).toBeDefined();
    s = run(s, [{ type: 'deleteTemplate', id: t.id }]);
    expect(s.templates.some((x) => x.name === 'Groceries')).toBe(false);
  });

  it('gives old saved data the new fields', () => {
    const old = JSON.stringify({ version: 1, tasks: [], categories: [], stats: { xp: 5 }, theme: 'blue' });
    const s = parseState(old);
    expect(s.templates.length).toBeGreaterThan(0);
    expect(s.stats.streakFreezes).toBe(0);
    expect(s.stats.surprise).toBeNull();
  });

  it('merges the new stats', () => {
    const a = run(createInitialState(), [add('A')]);
    const b = run(createInitialState(), [add('B'), { type: 'focusComplete', taskId: null, minutes: 30 }]);
    const m = mergeStates(a, b);
    expect(m.stats.focusMinutes).toBe(30);
    expect(m.templates.length).toBe(a.templates.length);
  });
});

describe('import', () => {
  it('parses quoted CSV', () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\n')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '2', '3'],
    ]);
  });

  it('round-trips our own exports', () => {
    let s = run(createInitialState(), [
      add('Write report', {
        categoryId: 'default-work',
        priority: 'high',
        dueDate: '2026-10-22',
        subtasks: [{ id: 'x', title: 'Outline', done: false }],
      }),
      add('Gym', { categoryId: 'default-health', repeat: { kind: 'weekly', days: [1, 3] } }),
    ]);
    for (const [text, name] of [
      [toCsv(s), 'tasko.csv'],
      [toTodoistCsv(s), 'todoist.csv'],
      [toMarkdown(s), 'tasks.md'],
    ] as const) {
      const r = parseImport(text, name)!;
      const report = r.tasks.find((t) => t.title === 'Write report')!;
      expect(report, name).toBeDefined();
      expect(report.dueDate, name).toBe('2026-10-22');
      expect(report.priority, name).toBe('high');
      expect(report.categoryName, name).toBe('Work');
      expect(report.subtasks?.map((x) => x.title), name).toEqual(['Outline']);
      expect(r.tasks.find((t) => t.title === 'Gym')!.categoryName, name).toBe('Health');
    }
    expect(parseImport(toCsv(s), 'x.csv')!.tasks.find((t) => t.title === 'Gym')!.repeat).toEqual({ kind: 'weekly', days: [1, 3] });
    const backup = parseImport(toJson(s))!;
    expect(backup.format).toBe('Tasko backup');
    expect(backup.backup!.tasks).toHaveLength(2);

    // Importing creates missing categories by name and reuses existing ones.
    s = run(createInitialState(), [
      { type: 'importTasks', tasks: [{ title: 'A', categoryName: 'work' }, { title: 'B', categoryName: 'Garden' }] },
    ]);
    expect(s.tasks.find((t) => t.title === 'A')!.categoryId).toBe('default-work');
    expect(s.categories.find((c) => c.name === 'Garden')).toBeDefined();
    expect(s.tasks.map((t) => t.title)).toEqual(['A', 'B']);
  });

  it('reads plain lists from other apps', () => {
    const r = parseImport('Groceries\n• Buy milk tomorrow\n- [x] Call bank\n  - [ ] find card\n')!;
    expect(r.format).toBe('Checklist');
    expect(r.tasks.map((t) => t.title)).toEqual(['Groceries', 'Buy milk', 'Call bank']);
    expect(r.tasks[1].dueDate).toBe(addDays(dayKey(), 1));
    expect(r.tasks[2].completedAt).toBeTruthy();
    expect(r.tasks[2].subtasks?.[0].title).toBe('find card');
  });

  it('reads spreadsheets with other column names', () => {
    const r = parseImport('Name,Notes,List,Deadline,Status\nPaint fence,Use white,Home,2026-11-01,done\n', 'export.csv')!;
    expect(r.tasks[0]).toMatchObject({ title: 'Paint fence', description: 'Use white', categoryName: 'Home', dueDate: '2026-11-01' });
    expect(r.tasks[0].completedAt).toBeTruthy();
  });
});

describe('year in review', () => {
  it('summarizes the year from the history', () => {
    let s = run(createInitialState(), [add('A', { categoryId: 'default-work' }), add('B', { categoryId: 'default-work' })]);
    s = run(s, [{ type: 'toggleTask', id: s.tasks[0].id }], NOON);
    s = run(s, [{ type: 'toggleTask', id: s.tasks[1].id }], NOON + DAY);
    const r = yearReview(s, 2026);
    expect(r.completed).toBe(2);
    expect(r.activeDays).toBe(2);
    expect(r.longestStreak).toBe(2);
    expect(r.topCategory?.name).toBe('Work');
    expect(r.months[9]).toBe(2);
    expect(reviewText(r)).toContain('2 quests done');
    expect(xpForTask(s.tasks[0], 1)).toBeGreaterThan(0);
  });
});
