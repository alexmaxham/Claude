// Home page: ranks the plan cards from the quiz answers and shows the shortlist side by side.
import { formatPrice, MAX_COMPARE, parseLines, priceFor } from '../lib/model';
import { parseAnswers, rankPlans, type Answers } from '../lib/score';
import { href } from '../lib/site';
import { onShortlistChange, planBySlug, readIndex, setShortlist } from './shortlist';
import { renderCompare } from './render';
import { getLines, setLines } from './lines';

const TOP = 6;

export function initFinder() {
  const form = document.getElementById('finder') as HTMLFormElement;
  const results = document.getElementById('results') as HTMLOListElement;
  const showAllBtn = document.getElementById('show-all') as HTMLButtonElement;
  const status = document.getElementById('match-status')!;
  const plans = readIndex();
  let showAll = false;

  // Answers come from the URL so a ranked list can be shared or bookmarked.
  const params = new URLSearchParams(location.search);
  // Without a lines value in the URL, use the number of lines chosen last time.
  if (!params.has('lines')) params.set('lines', String(getLines()));
  const initial = parseAnswers(params);
  for (const [k, v] of Object.entries(initial)) {
    const input = form.querySelector<HTMLInputElement>(`input[name="${k}"][value="${v}"]`);
    if (input) input.checked = true;
  }

  function answers(): Answers {
    const fd = new FormData(form);
    return parseAnswers(new URLSearchParams([...fd.entries()].map(([k, v]) => [k, String(v)])));
  }

  function apply(updateUrl: boolean) {
    const a = answers();
    if (updateUrl) {
      const url = new URL(location.href);
      for (const [k, v] of Object.entries(a)) url.searchParams.set(k, v);
      history.replaceState(null, '', url);
    }
    const lines = Number(a.lines);
    setLines(parseLines(a.lines));
    const ranked = rankPlans(plans, a);
    const cards = new Map([...results.children].map((li) => [(li as HTMLElement).dataset.slug!, li as HTMLElement]));
    ranked.forEach((r, i) => {
      const li = cards.get(r.plan.slug);
      if (!li) return;
      results.append(li); // moves it to the end, so the list ends up in ranked order
      const inTop = i < TOP;
      li.hidden = !showAll && !inTop;
      li.classList.toggle('is-top', i === 0);
      li.querySelector('[data-rank]')!.textContent = `#${i + 1}`;
      const why = li.querySelector<HTMLElement>('[data-why]')!;
      why.hidden = !inTop;
      why.innerHTML = `<strong>Why it fits:</strong> `;
      why.append(r.why);
      li.querySelector<HTMLElement>('[data-best-match]')!.hidden = i !== 0;
      const lp = priceFor(r.plan, lines);
      li.querySelector('[data-price-main]')!.textContent = formatPrice(lp.perLine);
      li.querySelector('[data-price-sub]')!.textContent =
        lines === 1 ? 'per month' : `per line · ${formatPrice(lp.total)} total`;
      const note = li.querySelector<HTMLElement>('[data-price-note]')!;
      note.hidden = lines === 1 || lp.listed;
      note.textContent = `${r.plan.carrier.name} doesn't list a ${lines}-line price, so this uses the 1-line price. Ask them about multi-line discounts.`;
    });
    showAllBtn.hidden = plans.length <= TOP;
    showAllBtn.textContent = showAll ? `Show top ${TOP} only` : `Show all ${plans.length} plans`;
    showAllBtn.setAttribute('aria-expanded', String(showAll));
    const top = ranked[0];
    status.textContent = top ? `Best match: ${top.plan.carrier.name} ${top.plan.name}` : '';
  }

  form.addEventListener('change', () => {
    apply(true);
    drawShortlist();
  });
  showAllBtn.addEventListener('click', () => {
    showAll = !showAll;
    apply(false);
  });
  apply(false);

  // Shortlist section
  const compare = document.getElementById('home-compare')!;
  const hint = document.getElementById('sl-hint')!;
  const open = document.getElementById('sl-open') as HTMLAnchorElement;
  const clear = document.getElementById('sl-clear') as HTMLButtonElement;
  clear.addEventListener('click', () => setShortlist([]));
  let lastSlugs: string[] = [];
  function drawShortlist(slugs = lastSlugs) {
    lastSlugs = slugs;
    const map = planBySlug();
    const chosen = slugs.map((s) => map.get(s)!).filter(Boolean);
    renderCompare(compare, chosen, {
      lines: getLines(),
      removable: true,
      showEmptySlots: true,
      emptyHtml: (n) => `<strong>Slot ${n} is open</strong><span class="small">Choose “Add to shortlist” on any plan above.</span>`,
    });
    const n = chosen.length;
    hint.textContent =
      n === 0
        ? 'Add up to four plans from your matches to compare them here.'
        : n >= MAX_COMPARE
          ? 'Four plans is the max. Remove one to swap in another.'
          : `${n} of ${MAX_COMPARE} added. The best value in each row is marked.`;
    open.href = n ? `${href('compare/')}?plans=${slugs.join(',')}` : href('compare/');
    clear.hidden = n === 0;
  }
  onShortlistChange((slugs) => drawShortlist(slugs));
}
