import { describe, expect, it } from 'vitest';
import { challengeProgress, generateChallenges, weekKey } from './challenges';
import { addDays, dayKey, daysBetween } from './dates';
import { effectiveStreak, levelFromXp, streakMultiplier, SUBTASK_BONUS, xpForTask, xpToNext } from './gamification';
import { mergeStates } from './merge';
import { nextDueDate, repeatLabel } from './recurrence';
import { parseState } from './storage';
import { createInitialState, reduce, taskOrder, type Action } from './store';
import type { AppState } from './types';

const DAY = 86_400_000;
const NOON = new Date(2026, 9, 20, 12).getTime();

function run(state: AppState, actions: Action[], now = NOON) {
  return actions.reduce((s, a) => reduce(s, a, now).state, state);
}

function withTask(title = 'Task', priority: 'low' | 'medium' | 'high' = 'medium') {
  return run(createInitialState(), [{ type: 'addTask', title, categoryId: null, priority, dueDate: null }]);
}

describe('dates', () => {
  it('computes day keys and differences', () => {
    expect(dayKey(NOON)).toBe('2026-10-20');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(daysBetween('2026-10-20', '2026-11-01')).toBe(12);
  });
});

describe('levels', () => {
  it('starts at level 1 and grows', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(xpToNext(1)).level).toBe(2);
    expect(levelFromXp(xpToNext(1) + xpToNext(2) - 1).level).toBe(2);
  });

  it('caps the streak multiplier', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(100)).toBe(1.5);
  });
});

describe('reduce', () => {
  it('ignores blank tasks', () => {
    const s = withTask('   ');
    expect(s.tasks).toHaveLength(0);
  });

  it('awards XP on completion and takes it back on undo', () => {
    let s = withTask('Write report', 'high');
    const id = s.tasks[0].id;
    const r = reduce(s, { type: 'toggleTask', id }, NOON);
    s = r.state;
    expect(s.stats.xp).toBeGreaterThan(0);
    expect(r.events.some((e) => e.type === 'xp')).toBe(true);
    expect(s.stats.achievements.first).toBeDefined();
    expect(s.stats.achievements.bigfish).toBeDefined();

    const xpAfter = s.stats.xp;
    s = run(s, [{ type: 'toggleTask', id }]);
    expect(s.stats.xp).toBe(0);
    expect(s.stats.totalCompleted).toBe(0);
    // Re-completing yields the same XP again, not more.
    s = run(s, [{ type: 'toggleTask', id }]);
    expect(s.stats.xp).toBe(xpAfter);
  });

  it('builds a streak across consecutive days and resets after a gap', () => {
    let s = createInitialState();
    for (let d = 0; d < 3; d++) {
      const now = NOON + d * DAY;
      s = run(s, [{ type: 'addTask', title: `t${d}`, categoryId: null, priority: 'low', dueDate: null }], now);
      s = run(s, [{ type: 'toggleTask', id: s.tasks[0].id }], now);
    }
    expect(s.stats.currentStreak).toBe(3);
    expect(s.stats.achievements.streak3).toBeDefined();
    expect(effectiveStreak(s.stats, NOON + 3 * DAY)).toBe(3);
    expect(effectiveStreak(s.stats, NOON + 4 * DAY)).toBe(0);

    const later = NOON + 6 * DAY;
    s = run(s, [{ type: 'addTask', title: 'back', categoryId: null, priority: 'low', dueDate: null }], later);
    s = run(s, [{ type: 'toggleTask', id: s.tasks[0].id }], later);
    expect(s.stats.currentStreak).toBe(1);
    expect(s.stats.bestStreak).toBe(3);
  });

  it('pays the daily goal bonus once per day', () => {
    let s = createInitialState();
    s = run(s, [{ type: 'setDailyGoal', goal: 2 }]);
    s = run(s, ['a', 'b', 'c'].map((title) => ({ type: 'addTask', title, categoryId: null, priority: 'low', dueDate: null }) as Action));
    const events = s.tasks.flatMap((t) => {
      const r = reduce(s, { type: 'toggleTask', id: t.id }, NOON);
      s = r.state;
      return r.events;
    });
    expect(events.filter((e) => e.type === 'goalReached')).toHaveLength(1);
    expect(s.stats.goalBonusDays).toEqual(['2026-10-20']);
  });

  it('edits and deletes categories without losing tasks', () => {
    let s = run(createInitialState(), [{ type: 'addCategory', name: 'Side project', emoji: '🚀', color: '#6c8cff' }]);
    const cat = s.categories.at(-1)!;
    expect(s.stats.achievements.organizer).toBeDefined();

    s = run(s, [
      { type: 'updateCategory', id: cat.id, patch: { name: 'Startup' } },
      { type: 'addTask', title: 'Pitch deck', categoryId: cat.id, priority: 'medium', dueDate: null },
      { type: 'moveCategory', id: cat.id, delta: -1 },
    ]);
    expect(s.categories.find((c) => c.id === cat.id)!.name).toBe('Startup');
    expect(s.categories.at(-2)!.id).toBe(cat.id);

    s = run(s, [{ type: 'deleteCategory', id: cat.id }]);
    expect(s.categories.some((c) => c.id === cat.id)).toBe(false);
    expect(s.tasks[0].categoryId).toBeNull();
  });

  it('restores a deleted task at its old position', () => {
    let s = run(withTask('one'), [{ type: 'addTask', title: 'two', categoryId: null, priority: 'low', dueDate: null }]);
    const victim = s.tasks[1];
    s = run(s, [{ type: 'deleteTask', id: victim.id }, { type: 'restoreTask', task: victim, index: 1 }]);
    expect(s.tasks.map((t) => t.title)).toEqual(['two', 'one']);
  });

  it('stores an optional description and lets it be edited', () => {
    let s = run(createInitialState(), [
      { type: 'addTask', title: 'Plan trip', description: '  Book flights\nFind hotel  ', categoryId: null, priority: 'low', dueDate: null },
      { type: 'addTask', title: 'No notes', description: '   ', categoryId: null, priority: 'low', dueDate: null },
    ]);
    const [noNotes, trip] = s.tasks;
    expect(trip.description).toBe('Book flights\nFind hotel');
    expect(noNotes.description).toBeUndefined();

    s = run(s, [{ type: 'updateTask', id: trip.id, patch: { description: 'Flights booked' } }]);
    expect(s.tasks.find((t) => t.id === trip.id)!.description).toBe('Flights booked');
  });

  it('switches theme and keeps it through a reset', () => {
    let s = run(withTask(), [{ type: 'setTheme', theme: 'green' }]);
    expect(s.theme).toBe('green');
    s = run(s, [{ type: 'reset' }]);
    expect(s.tasks).toHaveLength(0);
    expect(s.theme).toBe('green');
  });
});

describe('storage', () => {
  it('falls back to defaults on bad data and fills missing fields', () => {
    expect(parseState('not json').categories.length).toBeGreaterThan(0);
    const s = parseState(JSON.stringify({ tasks: [], stats: { xp: 42 } }));
    expect(s.stats.xp).toBe(42);
    expect(s.stats.dailyGoal).toBe(3);
    expect(s.theme).toBe('blue');
  });

  it('keeps a saved theme and ignores unknown ones', () => {
    expect(parseState(JSON.stringify({ theme: 'orange' })).theme).toBe('orange');
    expect(parseState(JSON.stringify({ theme: 'rainbow' })).theme).toBe('blue');
  });
});

describe('mergeStates', () => {
  const complete = (s: AppState, title: string, now = NOON) => {
    s = run(s, [{ type: 'addTask', title, categoryId: null, priority: 'medium', dueDate: null }], now);
    return run(s, [{ type: 'toggleTask', id: s.tasks[0].id }], now);
  };

  it('returns the other side when one is pristine', () => {
    const used = complete(createInitialState(), 'x');
    expect(mergeStates(used, createInitialState())).toBe(used);
    expect(mergeStates(createInitialState(), used)).toBe(used);
  });

  it('unions tasks and adds up progress', () => {
    const account = complete(createInitialState(), 'account task', NOON - DAY);
    let guest = complete(createInitialState(), 'guest task');
    guest = run(guest, [{ type: 'addCategory', name: 'work', emoji: '💼', color: '#000' }]);
    guest = run(guest, [{ type: 'addCategory', name: 'Garden', emoji: '🌻', color: '#0f0' }]);

    const m = mergeStates(account, guest);
    expect(m.tasks.map((t) => t.title).sort()).toEqual(['account task', 'guest task']);
    expect(m.stats.xp).toBe(account.stats.xp + guest.stats.xp);
    expect(m.stats.totalCompleted).toBe(2);
    expect(m.stats.lastActiveDay).toBe('2026-10-20');
    expect(m.stats.completionsByDay).toEqual({ '2026-10-19': 1, '2026-10-20': 1 });
    // "work" matches the default "Work" category; "Garden" is new.
    expect(m.categories.filter((c) => c.name.toLowerCase() === 'work')).toHaveLength(1);
    expect(m.categories.some((c) => c.name === 'Garden')).toBe(true);
  });

  it('is idempotent for tasks already in the account', () => {
    const s = complete(createInitialState(), 'same');
    const m = mergeStates(s, { ...s, stats: { ...s.stats } });
    expect(m.tasks).toHaveLength(1);
  });
});

describe('recurrence', () => {
  // 2026-10-20 is a Tuesday.
  it('computes the next due date', () => {
    expect(nextDueDate({ kind: 'daily' }, '2026-10-20', '2026-10-20')).toBe('2026-10-21');
    // Finished late: the next one is after today, not after the old due date.
    expect(nextDueDate({ kind: 'daily' }, '2026-10-15', '2026-10-20')).toBe('2026-10-21');
    // Finished early: the next one is after the due date.
    expect(nextDueDate({ kind: 'daily' }, '2026-10-22', '2026-10-20')).toBe('2026-10-23');
    expect(nextDueDate({ kind: 'weekly', days: [1, 3] }, '2026-10-20', '2026-10-20')).toBe('2026-10-21');
    expect(nextDueDate({ kind: 'weekly', days: [1, 2, 3, 4, 5] }, '2026-10-23', '2026-10-23')).toBe('2026-10-26');
    expect(nextDueDate({ kind: 'weekly', days: [] }, '2026-10-20', '2026-10-20')).toBe('2026-10-27');
    expect(nextDueDate({ kind: 'monthly' }, '2026-01-31', '2026-01-31')).toBe('2026-02-28');
    expect(nextDueDate({ kind: 'monthly' }, '2026-10-20', '2026-10-20')).toBe('2026-11-20');
  });

  it('labels repeats', () => {
    expect(repeatLabel({ kind: 'weekly', days: [5, 1, 2, 3, 4] })).toBe('Weekdays');
    expect(repeatLabel({ kind: 'weekly', days: [1, 3] })).toBe('Mon, Wed');
  });

  it('creates the next occurrence on completion and removes it on undo', () => {
    let s = run(createInitialState(), [
      { type: 'addTask', title: 'Water plants', categoryId: null, priority: 'low', dueDate: '2026-10-20', repeat: { kind: 'daily' },
        subtasks: [{ id: 'a', title: 'Ferns', done: false }] },
    ]);
    const id = s.tasks[0].id;
    s = run(s, [{ type: 'toggleSubtask', taskId: id, subtaskId: 'a' }, { type: 'toggleTask', id }]);
    expect(s.tasks).toHaveLength(2);
    const nextOne = s.tasks.find((t) => !t.completedAt)!;
    expect(nextOne.dueDate).toBe('2026-10-21');
    expect(nextOne.subtasks![0].done).toBe(false);
    expect(nextOne.repeat).toEqual({ kind: 'daily' });

    s = run(s, [{ type: 'toggleTask', id }]);
    expect(s.tasks).toHaveLength(1);
    expect(s.tasks[0].spawnedId).toBeUndefined();
  });
});

describe('subtasks', () => {
  it('adds XP for each finished subtask', () => {
    const s = run(createInitialState(), [
      { type: 'addTask', title: 'Move', categoryId: null, priority: 'low', dueDate: null,
        subtasks: [{ id: 'a', title: 'Pack', done: true }, { id: 'b', title: 'Clean', done: true }, { id: 'c', title: 'Keys', done: false }] },
    ]);
    expect(xpForTask(s.tasks[0], 0, NOON)).toBe(10 + 2 * SUBTASK_BONUS);
  });
});

describe('reorderTasks', () => {
  it('moves tasks within the positions they already held', () => {
    let s = createInitialState();
    for (const [i, title] of ['a', 'b', 'c', 'd'].entries()) {
      s = run(s, [{ type: 'addTask', title, categoryId: null, priority: 'low', dueDate: null }], NOON + i);
    }
    const sorted = () => [...s.tasks].sort((x, y) => taskOrder(x) - taskOrder(y)).map((t) => t.title);
    expect(sorted()).toEqual(['d', 'c', 'b', 'a']);
    const id = (title: string) => s.tasks.find((t) => t.title === title)!.id;
    // Reorder just c and a (e.g. a filtered view): they swap; d and b stay put.
    s = run(s, [{ type: 'reorderTasks', ids: [id('a'), id('c')] }]);
    expect(sorted()).toEqual(['d', 'a', 'b', 'c']);
  });
});

describe('weekly challenges', () => {
  it('starts weeks on Monday and picks three stable challenges', () => {
    expect(weekKey(NOON)).toBe('2026-10-19');
    expect(weekKey(new Date(2026, 9, 25, 12).getTime())).toBe('2026-10-19');
    const cats = createInitialState().categories;
    const a = generateChallenges('2026-10-19', cats);
    expect(a).toHaveLength(3);
    expect(a[0].kind).toBe('complete');
    expect(new Set(a.map((c) => c.kind)).size).toBe(3);
    expect(generateChallenges('2026-10-19', cats)).toEqual(a);
  });

  it('counts completions, pays the reward once, and takes counts back on undo', () => {
    let s = createInitialState();
    let rewarded = 0;
    for (let i = 0; i < 25; i++) {
      s = run(s, [{ type: 'addTask', title: `t${i}`, categoryId: null, priority: 'high', dueDate: null }]);
      const r = reduce(s, { type: 'toggleTask', id: s.tasks[0].id }, NOON);
      rewarded += r.events.filter((e) => e.type === 'challenge' && e.challenge.kind === 'complete').length;
      s = r.state;
    }
    expect(rewarded).toBe(1);
    const week = s.stats.week!;
    expect(week.completed).toBe(25);
    expect(week.high).toBe(25);
    const main = week.challenges[0];
    expect(challengeProgress(week, main)).toBe(main.target);

    s = run(s, [{ type: 'toggleTask', id: s.tasks[0].id }]);
    expect(s.stats.week!.completed).toBe(24);
  });
});

describe('theme unlocks', () => {
  it('refuses locked themes and announces unlocks on level-up', () => {
    let s = run(createInitialState(), [{ type: 'setTheme', theme: 'gold' }]);
    expect(s.theme).toBe('blue');

    s = { ...s, stats: { ...s.stats, xp: xpToNext(1) + xpToNext(2) - 5 } }; // just short of level 3
    s = run(s, [{ type: 'addTask', title: 'x', categoryId: null, priority: 'high', dueDate: null }]);
    const r = reduce(s, { type: 'toggleTask', id: s.tasks[0].id }, NOON);
    expect(r.events).toContainEqual({ type: 'themeUnlocked', theme: 'teal' });
    expect(run(r.state, [{ type: 'setTheme', theme: 'teal' }]).theme).toBe('teal');
  });
});
