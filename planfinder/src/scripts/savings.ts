// Savings calculator: plans that fit the visitor's needs, cheapest first-year cost first, compared
// with what they pay now.
import { costOver } from '../lib/cost';
import { amountValue, formatPrice, type PlanLite } from '../lib/model';
import { readIndex, syncButtons } from './shortlist';
import { esc } from './render';

function fits(p: PlanLite, data: string, hotspot: string, network: string, owned: string[]): boolean {
  if (p.requires && !owned.includes(p.carrier.slug)) return false;
  if (network !== 'any' && !p.networks.includes(network)) return false;
  const premium = amountValue(p.premiumData);
  if (data === 'heavy' && premium < 50) return false;
  if (hotspot === 'yes') {
    const note = (p.hotspotNote ?? '').toLowerCase();
    const has = amountValue(p.hotspot) > 0 || note.startsWith('unlimited') || note.startsWith('included');
    if (!has) return false;
  }
  return true;
}

export function initSavings() {
  const form = document.getElementById('savings-form') as HTMLFormElement;
  const list = document.getElementById('results')!;
  const summary = document.getElementById('summary')!;
  const plans = readIndex();

  function render() {
    const fd = new FormData(form);
    const bill = Math.max(0, Number(fd.get('bill')) || 0);
    const lines = Number(fd.get('lines')) || 1;
    const data = String(fd.get('data'));
    const hotspot = String(fd.get('hotspot'));
    const network = String(fd.get('network'));
    const owned = fd.getAll('owns').map(String);
    const yearNow = bill * 12;

    const rows = plans
      .filter((p) => fits(p, data, hotspot, network, owned))
      .map((p) => ({ p, c: costOver(p, lines, 12) }))
      .sort((a, b) => a.c.total - b.c.total)
      .slice(0, 12);

    const best = rows[0];
    if (!best) {
      summary.innerHTML = '';
      list.innerHTML = '<li style="--brand:var(--line)">No plans match all of those needs. Try a different network or turn off hotspot.</li>';
      return;
    }
    const bestSave = yearNow - best.c.total;
    summary.innerHTML =
      bill > 0 && bestSave > 0
        ? `<div class="big-save"><span>You could save up to</span><span class="display">${esc(formatPrice(Math.round(bestSave)))}/year</span><span>with ${esc(best.p.carrier.name)} ${esc(best.p.name)}, about ${esc(formatPrice(Math.round(best.c.perMonth)))}/mo for ${lines} ${lines === 1 ? 'line' : 'lines'} vs ${esc(formatPrice(bill))}/mo now.</span></div>`
        : bill > 0
          ? `<div class="big-save"><span>You're already paying less than the plans that fit these needs.</span></div>`
          : '';

    list.innerHTML = rows
      .map(({ p, c }) => {
        const save = yearNow - c.total;
        const saveText = bill > 0 ? (save > 0 ? `<strong class="save-pos">${esc(formatPrice(Math.round(save)))}</strong>` : `<strong class="save-neg">${esc(formatPrice(Math.round(-save)))} more</strong>`) : '<strong>–</strong>';
        const upfront = /upfront/i.test(p.terms ?? '') ? ' · paid upfront' : '';
        const unknownFees = c.oneTimeKnown ? '' : ' (+ any activation fee)';
        return `<li style="--brand:${p.carrier.color}">
          <div class="who"><a href="${esc(p.url)}">${esc(p.carrier.name)} ${esc(p.name)}</a><div class="small muted">${esc(p.networks.join(' or '))} network${upfront}${p.requires ? ` · <strong>${esc(p.requires)}</strong>` : ''}${p.verified ? '' : ' · price not yet verified'}</div></div>
          <div class="num"><span>Per month</span><strong>${esc(formatPrice(Math.round(c.perMonth)))}</strong></div>
          <div class="num"><span>First year</span><strong>${esc(formatPrice(Math.round(c.total)))}</strong><span class="small muted">${esc(unknownFees)}</span></div>
          <div class="num"><span>Yearly savings</span>${saveText}</div>
          <button type="button" class="btn btn-ghost sl-btn" data-shortlist-toggle="${esc(p.slug)}" aria-pressed="false"><span class="when-off">Add to shortlist</span><span class="when-on">On your shortlist ✓</span><span class="when-full">Shortlist full</span><span class="sr-only">: ${esc(p.carrier.name)} ${esc(p.name)}</span></button>
        </li>`;
      })
      .join('');
    syncButtons();
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', (e) => e.preventDefault());
  render();
}
