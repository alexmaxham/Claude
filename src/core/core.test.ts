import { describe, expect, it } from 'vitest';
import { addDays, dayKey, daysBetween } from './dates';
import { effectiveStreak, levelFromXp, streakMultiplier, xpToNext } from './gamification';
import { mergeStates } from './merge';
import { parseState } from './storage';
import { createInitialState, reduce, type Action } from './store';
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
});

describe('storage', () => {
  it('falls back to defaults on bad data and fills missing fields', () => {
    expect(parseState('not json').categories.length).toBeGreaterThan(0);
    const s = parseState(JSON.stringify({ tasks: [], stats: { xp: 42 } }));
    expect(s.stats.xp).toBe(42);
    expect(s.stats.dailyGoal).toBe(3);
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
