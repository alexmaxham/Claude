// Browser-side markup for the side-by-side comparison, shared by the home page and the compare page.
import { compareRows } from '../lib/compare';
import { logoTile } from '../lib/logo';
import { formatPrice, MAX_COMPARE, priceFor, type PlanLite } from '../lib/model';

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

function logoHtml(p: PlanLite, size: number) {
  const t = logoTile(p.carrier, size, 'white');
  const inner = t.has ? `<img src="${esc(p.carrier.logoUrl!)}" alt="" width="${size}" height="${size}">` : `<span aria-hidden="true">${esc(p.carrier.monogram)}</span>`;
  return `<span class="${t.className}" style="${t.style}">${inner}</span>`;
}

export interface RenderOptions {
  /** Show dashed placeholders up to four columns. */
  showEmptySlots?: boolean;
  /** HTML inside each empty placeholder. */
  emptyHtml?: (slot: number) => string;
  /** Show the remove button on each card (it removes from the shortlist). */
  removable?: boolean;
  /** Number of lines to price for (default 1). */
  lines?: number;
}

export function renderCompare(container: HTMLElement, plans: PlanLite[], opts: RenderOptions = {}) {
  const lines = opts.lines ?? 1;
  const rows = compareRows(plans, lines);
  const cards = plans.map((p, i) => {
    const title = `${p.carrier.name} ${p.name}`;
    const cells = rows
      .map((r) => {
        const c = r.cells[i];
        return `<div class="cmp-row${c.best ? ' is-best' : ''}${r.same && plans.length > 1 ? ' is-same' : ''}"><dt>${esc(r.label)}</dt><dd>${esc(c.text)}${c.best ? '<span class="tag-best">BEST</span>' : ''}</dd></div>`;
      })
      .join('');
    const remove = opts.removable
      ? `<button type="button" class="cmp-remove" data-shortlist-remove="${esc(p.slug)}" aria-label="Remove ${esc(title)} from shortlist"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`
      : '';
    const unverified = p.verified ? '' : '<p class="small muted" style="margin-bottom:10px">Price not yet verified</p>';
    return `<article class="cmp-card" aria-label="${esc(title)}">
      <div class="cmp-head" style="background:${p.carrier.color};color:${p.carrier.textOnColor}">
        <div class="cmp-head-top"><span class="cmp-carrier">${logoHtml(p, 40)}${esc(p.carrier.name)}</span>${remove}</div>
        <a class="cmp-name" href="${esc(p.url)}">${esc(p.name)}</a>
      </div>
      <dl class="cmp-rows">${cells}</dl>
      <div class="cmp-foot">${unverified}<a class="btn btn-primary" href="${esc(p.url)}">${esc(formatPrice(priceFor(p, lines).perLine))}/mo${lines > 1 ? ' per line' : ''} · See plan<span class="sr-only"> ${esc(title)}</span></a></div>
    </article>`;
  });
  if (opts.showEmptySlots) {
    for (let i = plans.length; i < MAX_COMPARE; i++) {
      cards.push(`<div class="cmp-empty"><svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><path d="M14 6v16M6 14h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>${opts.emptyHtml ? opts.emptyHtml(i + 1) : ''}</div>`);
    }
  }
  container.innerHTML = cards.join('');
}
