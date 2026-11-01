// Compare page. Shows the shortlist, or a shared list from ?plans=a,b,c when it differs from it.
import { parsePlanList } from '../lib/compare';
import { MAX_COMPARE } from '../lib/model';
import { href } from '../lib/site';
import { getShortlist, onShortlistChange, planBySlug, setShortlist, toggle } from './shortlist';
import { renderCompare } from './render';

export function initCompare() {
  const box = document.getElementById('compare')!;
  const status = document.getElementById('status')!;
  const empty = document.getElementById('empty')!;
  const shared = document.getElementById('shared')!;
  const diffOnly = document.getElementById('diff-only') as HTMLInputElement;
  const copy = document.getElementById('copy-link') as HTMLButtonElement;
  const addForm = document.getElementById('add-form') as HTMLFormElement;
  const addSelect = document.getElementById('add-plan') as HTMLSelectElement;
  const map = planBySlug();

  const fromUrl = parsePlanList(new URLSearchParams(location.search).get('plans'), new Set(map.keys()), MAX_COMPARE);
  const mine = getShortlist();
  let sharedList: string[] | null = fromUrl.length && fromUrl.join(',') !== mine.join(',') ? fromUrl : null;
  let current: string[] = [];

  function linkFor(slugs: string[]) {
    return new URL(`${href('compare/')}${slugs.length ? `?plans=${slugs.join(',')}` : ''}`, location.origin).href;
  }

  function render(slugs: string[]) {
    current = slugs;
    const plans = slugs.map((s) => map.get(s)!).filter(Boolean);
    const isShared = sharedList !== null;
    shared.hidden = !isShared;
    empty.hidden = plans.length > 0;
    copy.hidden = plans.length === 0;
    addForm.hidden = isShared || plans.length >= MAX_COMPARE;
    for (const opt of addSelect.options) if (opt.value) opt.disabled = slugs.includes(opt.value);
    renderCompare(box, plans, { removable: !isShared });
    box.classList.toggle('diff-only', diffOnly.checked);
    status.textContent = plans.length
      ? `${plans.length} of ${MAX_COMPARE} plans. The best value in each row is marked.`
      : 'Your shortlist is empty.';
    if (!isShared) history.replaceState(null, '', linkFor(slugs));
  }

  onShortlistChange((slugs) => {
    if (sharedList === null) render(slugs);
  });
  if (sharedList) render(sharedList);

  document.getElementById('save-shared')!.addEventListener('click', () => {
    const list = sharedList!;
    sharedList = null;
    setShortlist(list);
  });
  diffOnly.addEventListener('change', () => box.classList.toggle('diff-only', diffOnly.checked));
  copy.addEventListener('click', async () => {
    const url = linkFor(current);
    try {
      await navigator.clipboard.writeText(url);
      copy.textContent = 'Link copied';
    } catch {
      window.prompt('Copy this link:', url);
    }
    setTimeout(() => (copy.textContent = 'Copy link to this comparison'), 2000);
  });
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (addSelect.value) toggle(addSelect.value);
    addSelect.value = '';
  });
}
