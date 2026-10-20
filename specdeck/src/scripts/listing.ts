// Client-side filtering and sorting of the server-rendered device grid.
// Filter state is mirrored in the URL (?q=, ?type=, ?brand=, ?sort=) so results can be shared.
// The search matches names, and spec values too ("IP68", "Wi-Fi 7") once /search.json has loaded.
const root = document.querySelector<HTMLElement>('[data-listing]');
if (root) {
  const grid = root.querySelector<HTMLElement>('[data-grid]')!;
  const cards = [...grid.querySelectorAll<HTMLElement>('.card')];
  const params = new URLSearchParams(location.search);
  const input = document.querySelector<HTMLInputElement>('#q');
  const state = {
    q: params.get('q') ?? '',
    type: params.get('type') ?? 'all',
    brand: params.get('brand') ?? '',
    sort: params.get('sort') ?? 'newest',
  };
  if (input) input.value = state.q;

  // Lower case, no hyphens or thousands separators, so "wifi 7" finds "Wi-Fi 7" and "5000 mah" finds "5,000 mAh".
  const norm = (s: string) => s.toLowerCase().replace(/(\d),(?=\d{3})/g, '$1').replace(/-/g, '').replace(/\s+/g, ' ').trim();
  let specs: Map<string, [string, string][]> | null = null;
  let loading = false;
  function loadSpecs() {
    if (specs || loading) return;
    loading = true;
    fetch('/search.json')
      .then((r) => r.json() as Promise<{ slug: string; specs: [string, string][] }[]>)
      .then((list) => {
        specs = new Map(list.map((d) => [d.slug, d.specs]));
        apply();
      })
      .catch(() => {})
      .finally(() => (loading = false));
  }
  /** The first spec whose value contains the whole query as words, e.g. ["Wi-Fi", "Wi-Fi 7 (802.11be)"]. */
  function specMatch(c: HTMLElement, q: string): [string, string] | null {
    const list = specs?.get(c.dataset.slug!);
    // A bare number like "7" would match half the spec sheet; spec matches need a letter ("IP68", "5G").
    if (!list || q.length < 2 || !/[a-z]/i.test(q)) return null;
    const re = new RegExp(`(^|[^a-z0-9])${norm(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`);
    return list.find(([, v]) => re.test(norm(v))) ?? null;
  }

  const matchesType = (c: HTMLElement) => {
    const form = c.dataset.form!;
    switch (state.type) {
      case 'phone':
      case 'tablet':
        return c.dataset.category === state.type;
      case 'fold':
        return form === 'book-fold' || form === 'flip';
      case 'bar':
        return form === 'bar';
      default:
        return true;
    }
  };

  const num = (v: string | undefined) => (v ? Number(v) : -1);
  const sorters: Record<string, (a: HTMLElement, b: HTMLElement) => number> = {
    newest: (a, b) => b.dataset.announced!.localeCompare(a.dataset.announced!),
    name: (a, b) => a.dataset.name!.localeCompare(b.dataset.name!),
    battery: (a, b) => num(b.dataset.battery) - num(a.dataset.battery),
    screen: (a, b) => num(b.dataset.screen) - num(a.dataset.screen),
  };

  function apply() {
    const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    if (state.q) loadSpecs();
    for (const c of [...cards].sort(sorters[state.sort] ?? sorters.newest)) {
      const byName = words.every((w) => c.dataset.name!.includes(w));
      const bySpec = byName ? null : specMatch(c, state.q);
      const visible = matchesType(c) && (!state.brand || c.dataset.brand === state.brand) && (byName || !!bySpec);
      c.hidden = !visible;
      const why = c.querySelector<HTMLElement>('[data-why]');
      if (why) {
        why.hidden = !bySpec;
        why.textContent = bySpec ? `${bySpec[0]}: ${bySpec[1]}` : '';
      }
      if (visible) shown++;
      grid.append(c);
    }
    root!.querySelector('[data-count]')!.textContent = `${shown} device${shown === 1 ? '' : 's'}${state.q ? ` matching “${state.q}”` : ''}`;
    root!.querySelector<HTMLElement>('[data-empty]')!.hidden = shown > 0;
    root!.querySelectorAll<HTMLElement>('button[data-type]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.type === state.type)));
    root!.querySelectorAll<HTMLElement>('button[data-brand]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.brand === state.brand)));
    root!.querySelectorAll<HTMLElement>('button[data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort)));

    const url = new URL(location.href);
    for (const [k, v, def] of [['q', state.q, ''], ['type', state.type, 'all'], ['brand', state.brand, ''], ['sort', state.sort, 'newest']]) {
      if (v && v !== def) url.searchParams.set(k, v);
      else url.searchParams.delete(k);
    }
    history.replaceState(null, '', url);
  }

  root.addEventListener('click', (e) => {
    const t = (e.target as Element).closest<HTMLElement>('button[data-type],button[data-brand],button[data-sort],button[data-clear]');
    if (!t || t.closest('.card')) return;
    if (t.dataset.type) state.type = t.dataset.type;
    else if (t.dataset.brand) state.brand = state.brand === t.dataset.brand ? '' : t.dataset.brand;
    else if (t.dataset.sort) state.sort = t.dataset.sort;
    else {
      Object.assign(state, { q: '', type: 'all', brand: '' });
      if (input) input.value = '';
    }
    apply();
  });

  // On listing pages the search box filters in place instead of reloading.
  input?.form?.addEventListener('submit', (e) => {
    e.preventDefault();
    input.blur();
  });
  input?.addEventListener('input', () => {
    state.q = input.value.trim();
    apply();
  });

  apply();
}
export {};
