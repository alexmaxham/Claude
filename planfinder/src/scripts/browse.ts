// All-plans page: filters and sorts the server-rendered cards. Reads ?kind= and ?network= so other
// pages can link straight to a filtered view.
export function initBrowse() {
  const form = document.getElementById('filters') as HTMLFormElement;
  const list = document.getElementById('plan-list') as HTMLUListElement;
  const count = document.getElementById('count')!;
  const empty = document.getElementById('empty')!;
  const max = form.elements.namedItem('max') as HTMLInputElement;
  const out = document.getElementById('max-out') as HTMLOutputElement;
  const cards = [...list.children] as HTMLElement[];

  const params = new URLSearchParams(location.search);
  const kind = params.get('kind');
  const kindInput = kind && form.querySelector<HTMLInputElement>(`input[name="kind"][value="${CSS.escape(kind)}"]`);
  if (kindInput) kindInput.checked = true;
  for (const n of params.getAll('network')) {
    const box = form.querySelector<HTMLInputElement>(`input[name="network"][value="${CSS.escape(n)}"]`);
    if (box) box.checked = true;
  }

  function apply() {
    const fd = new FormData(form);
    const k = String(fd.get('kind') ?? 'all');
    const nets = fd.getAll('network').map(String);
    const cap = Number(max.value);
    const sort = String(fd.get('sort') ?? 'price');
    out.value = `$${cap}`;

    const num = (el: HTMLElement, key: string) => Number(el.dataset[key]);
    const sorted = cards.slice().sort((a, b) => {
      if (sort === 'price-desc') return num(b, 'price') - num(a, 'price');
      if (sort === 'hotspot') return num(b, 'hotspot') - num(a, 'hotspot') || num(a, 'price') - num(b, 'price');
      if (sort === 'carrier') return a.dataset.carrier!.localeCompare(b.dataset.carrier!) || num(a, 'price') - num(b, 'price');
      return num(a, 'price') - num(b, 'price');
    });
    let shown = 0;
    for (const el of sorted) {
      const ok =
        (k === 'all' || el.dataset.kind === k) &&
        num(el, 'price') <= cap &&
        (nets.length === 0 || el.dataset.networks!.split('|').some((n) => nets.includes(n)));
      el.hidden = !ok;
      if (ok) shown++;
      list.append(el);
    }
    count.textContent = `${shown} ${shown === 1 ? 'plan' : 'plans'}`;
    empty.hidden = shown > 0;
  }

  form.addEventListener('input', apply);
  form.addEventListener('change', apply);
  // Reset restores the defaults first, then re-filter.
  form.addEventListener('reset', () => setTimeout(apply));
  apply();
}
