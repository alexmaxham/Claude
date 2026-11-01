// How many lines the visitor is shopping for (1–4). Shared by the finder and the compare page.
import { parseLines, type Lines } from '../lib/model';

const KEY = 'planfinder.lines.v1';
const listeners = new Set<(n: Lines) => void>();
let current: Lines | null = null;

export function getLines(): Lines {
  if (current === null) {
    try {
      current = parseLines(localStorage.getItem(KEY));
    } catch {
      current = 1;
    }
  }
  return current;
}

export function setLines(n: Lines) {
  if (n === getLines()) return;
  current = n;
  try {
    localStorage.setItem(KEY, String(n));
  } catch {
    /* storage blocked: still works for this page view */
  }
  listeners.forEach((fn) => fn(n));
}

export function onLinesChange(fn: (n: Lines) => void) {
  listeners.add(fn);
}
