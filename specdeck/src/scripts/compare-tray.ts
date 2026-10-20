// The compare selection: up to four devices, remembered across pages in localStorage.
export const MAX_COMPARE = 4;
const KEY = 'compare';

type IndexEntry = { slug: string; name: string; url: string; category: string };
export const deviceIndex: IndexEntry[] = JSON.parse(document.getElementById('device-index')?.textContent ?? '[]');
const bySlug = new Map(deviceIndex.map((d) => [d.slug, d]));

export function getSelection(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((s) => bySlug.has(s)).slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

export function setSelection(list: string[]) {
  const clean = [...new Set(list)].filter((s) => bySlug.has(s)).slice(0, MAX_COMPARE);
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {}
  render();
  document.dispatchEvent(new CustomEvent('compare:change', { detail: clean }));
}

export const compareHref = (list: string[]) => (list.length ? `/compare/?d=${list.join(',')}` : '/compare/');

function toggle(slug: string) {
  const list = getSelection();
  if (list.includes(slug)) setSelection(list.filter((s) => s !== slug));
  else if (list.length < MAX_COMPARE) setSelection([...list, slug]);
  else announce(`You can compare up to ${MAX_COMPARE} devices. Remove one first.`);
}

const live = document.createElement('div');
live.className = 'sr-only';
live.setAttribute('aria-live', 'polite');
document.body.append(live);
function announce(msg: string) {
  live.textContent = msg;
}

function render() {
  const list = getSelection();
  const onComparePage = location.pathname.startsWith('/compare/');

  document.querySelectorAll<HTMLElement>('[data-compare-count]').forEach((el) => {
    el.textContent = String(list.length);
    el.hidden = list.length === 0;
  });
  document.querySelectorAll<HTMLAnchorElement>('a[data-compare-link]').forEach((a) => (a.href = compareHref(list)));
  document.querySelectorAll<HTMLButtonElement>('[data-compare-toggle]').forEach((btn) => {
    const on = list.includes(btn.dataset.compareToggle!);
    const name = bySlug.get(btn.dataset.compareToggle!)?.name ?? '';
    btn.setAttribute('aria-pressed', String(on));
    if (btn.dataset.labelled === undefined) btn.setAttribute('aria-label', `${on ? 'Remove' : 'Add'} ${name} ${on ? 'from' : 'to'} compare`);
  });

  const tray = document.querySelector<HTMLElement>('[data-tray]');
  const ul = document.querySelector<HTMLElement>('[data-tray-list]');
  if (!tray || !ul) return;
  tray.hidden = list.length === 0 || onComparePage;
  const icon = document.querySelector<HTMLTemplateElement>('#tray-remove-icon')?.innerHTML ?? '×';
  ul.replaceChildren(
    ...list.map((slug) => {
      const li = document.createElement('li');
      li.className = 'tchip';
      li.textContent = bySlug.get(slug)!.name;
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.compareToggle = slug;
      b.dataset.labelled = '';
      b.setAttribute('aria-label', `Remove ${bySlug.get(slug)!.name}`);
      b.innerHTML = icon;
      li.append(b);
      return li;
    }),
  );
}

document.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLElement>('[data-compare-toggle]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  toggle(btn.dataset.compareToggle!);
});
window.addEventListener('storage', (e) => e.key === KEY && render());
render();
