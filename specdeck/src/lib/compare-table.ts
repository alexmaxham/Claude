import type { Device } from './schema';
import { SECTIONS, visibleRows, bestIndex, NOT_CONFIRMED } from './specs';
import { artHtml } from './art';
import { deviceUrl, fullName } from './names';

// Renders the comparison table as an HTML string. Used for pre-rendered comparison pages
// and by the browser on /compare/ when the visitor picks their own devices.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function compareTableHtml(devices: Device[], icons: Record<string, string>, canAdd: boolean): string {
  const cols = devices.length + (canAdd ? 1 : 0);
  const head = devices
    .map(
      (d) => `<th scope="col" class="devhead">
        <div class="mini">${artHtml(d, 104, `Illustration of the ${fullName(d)}`)}
          <button type="button" class="x" data-remove="${d.slug}" aria-label="Remove ${esc(fullName(d))}">${icons.close}</button>
        </div>
        <span class="label">${esc(d.brand)}</span>
        <a class="devname" href="${deviceUrl(d)}">${esc(d.name)}</a>
      </th>`,
    )
    .join('');
  const add = canAdd
    ? `<th scope="col" class="devhead"><button type="button" class="addslot" data-add>${icons.add_circle}Add a device</button></th>`
    : '';

  const body = SECTIONS.map((s) => {
    const rows = visibleRows(s, devices)
      .map((r) => {
        const values = devices.map((d) => r.value(d));
        const same = devices.length > 1 && values.every((v) => v === values[0]);
        const best = bestIndex(r, devices);
        const cells = values
          .map((v, i) => {
            const cls = [i === best ? 'win' : '', v === null ? 'missing' : ''].filter(Boolean).join(' ');
            const badge = i === best ? '<span class="best">Best</span>' : '';
            return `<td${cls ? ` class="${cls}"` : ''}>${badge}${esc(v ?? NOT_CONFIRMED)}</td>`;
          })
          .join('');
        return `<tr${same ? ' class="same"' : ''}><th scope="row">${esc(r.label)}</th>${cells}${canAdd ? '<td class="pad"></td>' : ''}</tr>`;
      })
      .join('');
    return `<tbody><tr class="sec"><th scope="colgroup" colspan="${cols + 1}">${icons[s.icon] ?? ''}${esc(s.label)}</th></tr>${rows}</tbody>`;
  }).join('');

  return `<table class="ctable" style="--cols:${cols}">
    <caption class="sr-only">Specifications of ${esc(devices.map(fullName).join(', '))} side by side</caption>
    <thead><tr><td class="corner"><span class="label">${devices.length} of 4 devices</span></td>${head}${add}</tr></thead>
    ${body}
  </table>`;
}

export const COMPARE_ICONS = ['close', 'add_circle', ...new Set(SECTIONS.map((s) => s.icon))];
