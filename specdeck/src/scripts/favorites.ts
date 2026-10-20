// Favourites: devices the visitor saved, kept in localStorage (no accounts, nothing leaves the browser).
import { deviceIndex } from './compare-tray';

const KEY = 'favorites';
const bySlug = new Map(deviceIndex.map((d) => [d.slug, d]));

export function getFavorites(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((s) => bySlug.has(s)) : [];
  } catch {
    return [];
  }
}

function setFavorites(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(list)]));
  } catch {}
  render();
  document.dispatchEvent(new CustomEvent('favorites:change', { detail: getFavorites() }));
}

function render() {
  const list = getFavorites();
  document.querySelectorAll<HTMLElement>('[data-fav-count]').forEach((el) => {
    el.textContent = String(list.length);
    el.hidden = list.length === 0;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-fav-toggle]').forEach((btn) => {
    const on = list.includes(btn.dataset.favToggle!);
    btn.setAttribute('aria-pressed', String(on));
    if (btn.dataset.labelled === undefined) {
      const name = bySlug.get(btn.dataset.favToggle!)?.name ?? '';
      btn.setAttribute('aria-label', on ? `Remove ${name} from favourites` : `Save ${name} to favourites`);
    }
  });
}

document.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLElement>('[data-fav-toggle]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const slug = btn.dataset.favToggle!;
  const list = getFavorites();
  setFavorites(list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]);
});

// Saved in another tab.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    render();
    document.dispatchEvent(new CustomEvent('favorites:change', { detail: getFavorites() }));
  }
});

render();
