// The shortlist: up to four plans the visitor wants to compare. Kept in localStorage so it follows
// them across pages, and synced to every [data-shortlist-toggle] button and [data-shortlist-count].
import { MAX_COMPARE, type PlanLite } from '../lib/model';

const KEY = 'planfinder.shortlist.v1';
let list: string[] = [];
let index: PlanLite[] | null = null;
let started = false;
const listeners = new Set<(slugs: string[]) => void>();

export function readIndex(): PlanLite[] {
  if (!index) {
    const el = document.getElementById('plan-index');
    index = el?.textContent ? (JSON.parse(el.textContent) as PlanLite[]) : [];
  }
  return index;
}

export function planBySlug(): Map<string, PlanLite> {
  return new Map(readIndex().map((p) => [p.slug, p]));
}

function known(slugs: unknown[]): string[] {
  const map = planBySlug();
  const out: string[] = [];
  for (const s of slugs) if (typeof s === 'string' && map.has(s) && !out.includes(s)) out.push(s);
  return out.slice(0, MAX_COMPARE);
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    list = raw ? known(JSON.parse(raw)) : [];
  } catch {
    list = [];
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* Private mode or storage blocked: the shortlist still works for this page view. */
  }
}

function announce(msg: string) {
  let live = document.getElementById('shortlist-live');
  if (!live) {
    live = document.createElement('div');
    live.id = 'shortlist-live';
    live.className = 'sr-only';
    live.setAttribute('aria-live', 'polite');
    document.body.append(live);
  }
  live.textContent = msg;
}

export function syncButtons() {
  const full = list.length >= MAX_COMPARE;
  document.querySelectorAll<HTMLButtonElement>('[data-shortlist-toggle]').forEach((b) => {
    const on = list.includes(b.dataset.shortlistToggle!);
    b.setAttribute('aria-pressed', String(on));
    b.dataset.full = String(full);
    b.disabled = full && !on;
  });
  document.querySelectorAll('[data-shortlist-count]').forEach((el) => {
    el.textContent = `${list.length}/${MAX_COMPARE}`;
  });
}

function emit() {
  syncButtons();
  listeners.forEach((fn) => fn(list.slice()));
}

export function getShortlist(): string[] {
  return list.slice();
}

export function setShortlist(slugs: string[]) {
  list = known(slugs);
  save();
  emit();
}

export function toggle(slug: string) {
  const name = planBySlug().get(slug);
  const label = name ? `${name.carrier.name} ${name.name}` : slug;
  if (list.includes(slug)) {
    list = list.filter((s) => s !== slug);
    announce(`Removed ${label}. ${list.length} of ${MAX_COMPARE} on your shortlist.`);
  } else if (list.length < MAX_COMPARE) {
    list = [...list, slug];
    announce(`Added ${label}. ${list.length} of ${MAX_COMPARE} on your shortlist.`);
  } else {
    announce(`Your shortlist is full. Remove a plan to add another.`);
    return;
  }
  save();
  emit();
}

/** Calls fn now and whenever the shortlist changes. */
export function onShortlistChange(fn: (slugs: string[]) => void) {
  listeners.add(fn);
  fn(list.slice());
}

export function initShortlist() {
  if (started) return;
  started = true;
  load();
  document.addEventListener('click', (e) => {
    const t = e.target as Element | null;
    const add = t?.closest<HTMLButtonElement>('[data-shortlist-toggle]');
    if (add && !add.disabled) toggle(add.dataset.shortlistToggle!);
    const remove = t?.closest<HTMLButtonElement>('[data-shortlist-remove]');
    if (remove) toggle(remove.dataset.shortlistRemove!);
  });
  // Keep other open tabs in step.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      load();
      emit();
    }
  });
  emit();
}
