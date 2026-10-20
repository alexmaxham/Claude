// The finder page: filters the server-rendered device cards by the values in their data-* attributes.
// Every filter lives in the URL (?cat=phone&battery=5000&ip68=1&sort=price), so searches can be shared.
// A device whose value is unknown for an active filter is hidden, and counted separately.
const root = document.querySelector<HTMLElement>('[data-finder]');
if (root) {
  const grid = root.querySelector<HTMLElement>('[data-grid]')!;
  const panel = root.querySelector<HTMLFormElement>('[data-panel]')!;
  const cards = [...grid.querySelectorAll<HTMLElement>('.card')];
  const selects = [...panel.querySelectorAll<HTMLSelectElement>('select')];
  const SETS = ['cat', 'form'];
  const TOGGLES = ['wireless', 'ip68', 'jack', 'sd'];
  const KEYS = [...SETS, ...selects.map((s) => s.name), ...TOGGLES];

  const params = new URLSearchParams(location.search);
  const state: Record<string, string> = Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? '']));
  let sort = params.get('sort') ?? 'newest';

  const num = (v: string | undefined) => (v ? Number(v) : null);
  const flag = (v: string | undefined) => (v === 'yes' ? true : v === 'no' ? false : null);
  const atLeast = (v: number | null, min: number) => (v === null ? null : v >= min);
  const atMost = (v: number | null, max: number) => (v === null ? null : v <= max);

  // Each filter answers true (passes), false (fails) or null (the device's value isn't confirmed).
  const tests: Record<string, (c: DOMStringMap, v: string) => boolean | null> = {
    cat: (c, v) => c.category === v,
    form: (c, v) => c.form === v,
    brand: (c, v) => c.brand === v,
    price: (c, v) => atMost(num(c.price), Number(v)),
    battery: (c, v) => atLeast(num(c.battery), Number(v)),
    ram: (c, v) => atLeast(num(c.ram), Number(v)),
    charge: (c, v) => atLeast(num(c.wired), Number(v)),
    smin: (c, v) => atLeast(num(c.screen), Number(v)),
    smax: (c, v) => atMost(num(c.screen), Number(v)),
    wireless: (c) => (num(c.wireless) === null ? null : num(c.wireless)! > 0),
    ip68: (c) => flag(c.ip68),
    jack: (c) => flag(c.jack),
    sd: (c) => flag(c.card),
  };

  // Unknown values sort last whichever way the list runs.
  const by = (key: string, dir: 1 | -1) => (a: HTMLElement, b: HTMLElement) => {
    const x = num(a.dataset[key]);
    const y = num(b.dataset[key]);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return dir * (x - y);
  };
  const newest = (a: HTMLElement, b: HTMLElement) => b.dataset.announced!.localeCompare(a.dataset.announced!);
  const sorters: Record<string, (a: HTMLElement, b: HTMLElement) => number> = {
    newest,
    price: (a, b) => by('price', 1)(a, b) || newest(a, b),
    battery: (a, b) => by('battery', -1)(a, b) || newest(a, b),
    weight: (a, b) => by('weight', 1)(a, b) || newest(a, b),
  };

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  function apply() {
    const active = KEYS.filter((k) => state[k]);
    let shown = 0;
    let unknown = 0;
    for (const c of [...cards].sort(sorters[sort] ?? newest)) {
      const results = active.map((k) => tests[k](c.dataset, state[k]));
      const visible = results.every((r) => r === true);
      if (!visible && !results.includes(false)) unknown++;
      c.hidden = !visible;
      if (visible) shown++;
      grid.append(c);
    }

    root!.querySelector('[data-count]')!.textContent = `${plural(shown, 'device')}${active.length ? ' match' : ''}`;
    const note = root!.querySelector<HTMLElement>('[data-hidden-note]')!;
    note.hidden = unknown === 0;
    note.querySelector('[data-hidden-text]')!.textContent = `${plural(unknown, 'more device')} ${unknown === 1 ? 'is' : 'are'} hidden because a value you filtered on isn’t confirmed.`;
    root!.querySelector<HTMLElement>('[data-empty]')!.hidden = shown > 0;
    const badge = root!.querySelector<HTMLElement>('[data-active-count]')!;
    badge.hidden = active.length === 0;
    badge.textContent = String(active.length);

    root!.querySelectorAll<HTMLElement>('button[data-set]').forEach((b) => b.setAttribute('aria-pressed', String(state[b.dataset.set!] === b.dataset.value)));
    root!.querySelectorAll<HTMLElement>('button[data-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(state[b.dataset.toggle!] === '1')));
    root!.querySelectorAll<HTMLElement>('button[data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === sort)));
    for (const s of selects) {
      s.value = state[s.name];
      // A value from an edited URL that isn't one of the options shows as "Any"; drop it.
      if (s.value !== state[s.name]) state[s.name] = s.value;
      s.classList.toggle('on', s.value !== '');
    }

    const url = new URL(location.href);
    for (const k of KEYS) {
      if (state[k]) url.searchParams.set(k, state[k]);
      else url.searchParams.delete(k);
    }
    if (sort !== 'newest') url.searchParams.set('sort', sort);
    else url.searchParams.delete('sort');
    history.replaceState(null, '', url);
  }

  root.addEventListener('click', (e) => {
    const t = (e.target as Element).closest<HTMLElement>('button[data-set],button[data-toggle],button[data-sort],button[data-clear],button[data-panel-toggle]');
    if (!t || t.closest('.card')) return;
    if (t.dataset.set) state[t.dataset.set] = t.dataset.value!;
    else if (t.dataset.toggle) state[t.dataset.toggle] = state[t.dataset.toggle] ? '' : '1';
    else if (t.dataset.sort) sort = t.dataset.sort;
    else if (t.hasAttribute('data-clear')) KEYS.forEach((k) => (state[k] = ''));
    else {
      const open = panel.classList.toggle('open');
      t.setAttribute('aria-expanded', String(open));
      return;
    }
    apply();
  });
  panel.addEventListener('change', (e) => {
    const s = e.target as HTMLSelectElement;
    state[s.name] = s.value;
    apply();
  });

  apply();
}
export {};
