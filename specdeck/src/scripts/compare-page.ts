// Compare page behavior. On /compare/ the table is built in the browser from ?d=slug,slug
// (or the saved selection). On pre-rendered comparison pages the table is already in the HTML,
// and changing the devices moves the visitor to /compare/ with the new set.
import { compareTableHtml } from '../lib/compare-table';
import { getSelection, setSelection, compareHref, MAX_COMPARE } from './compare-tray';
import type { Device } from '../lib/schema';

const root = document.querySelector<HTMLElement>('[data-compare-root]');
if (root) {
  const tableHost = root.querySelector<HTMLElement>('[data-compare-table]')!;
  const icons: Record<string, string> = JSON.parse(document.getElementById('compare-icons')!.textContent!);
  const picker = document.querySelector<HTMLDialogElement>('[data-picker]')!;
  const pickerQ = document.querySelector<HTMLInputElement>('[data-picker-q]')!;
  const hideSame = document.querySelector<HTMLInputElement>('[data-hide-same]')!;
  const isBuilder = location.pathname === '/compare/';
  const fromUrl = new URLSearchParams(location.search).get('d')?.split(',').filter(Boolean);
  let list: string[] = isBuilder ? (fromUrl ?? getSelection()) : root.dataset.initial!.split(',');
  let data: Map<string, Device> | null = null;

  const load = async () => {
    if (!data) {
      const res = await fetch('/devices.json');
      data = new Map(((await res.json()) as Device[]).map((d) => [d.slug, d]));
    }
    return data;
  };

  async function render() {
    const devices = await load();
    list = list.filter((s) => devices.has(s)).slice(0, MAX_COMPARE);
    const chosen = list.map((s) => devices.get(s)!);
    tableHost.innerHTML = chosen.length ? compareTableHtml(chosen, icons, chosen.length < MAX_COMPARE) : '';
    tableHost.querySelector('.ctable')?.classList.toggle('hide-same', hideSame.checked);
    document.querySelectorAll<HTMLElement>('[data-compare-empty]').forEach((el) => (el.hidden = chosen.length > 0));
    document.querySelectorAll<HTMLElement>('[data-compare-filled]').forEach((el) => (el.hidden = chosen.length === 0));
    const title = document.querySelector('[data-compare-title]');
    if (title) title.textContent = chosen.length ? chosen.map((d) => d.name).join(' vs ') : 'Compare phones and tablets';
    if (chosen.length) document.title = `${chosen.map((d) => d.name).join(' vs ')} | Specdeck`;
  }

  function change(next: string[]) {
    if (!isBuilder) {
      location.href = compareHref(next);
      return;
    }
    list = next;
    setSelection(next);
    history.replaceState(null, '', next.length ? compareHref(next) : '/compare/');
    render();
  }

  root.addEventListener('click', (e) => {
    const t = e.target as Element;
    const remove = t.closest<HTMLElement>('[data-remove]');
    if (remove) change(list.filter((s) => s !== remove.dataset.remove));
    else if (t.closest('[data-add]')) openPicker();
  });
  document.querySelectorAll('[data-open-picker]').forEach((b) => b.addEventListener('click', openPicker));

  function openPicker() {
    picker.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => (b.disabled = list.includes(b.dataset.pick!)));
    pickerQ.value = '';
    filterPicker();
    picker.showModal();
  }
  function filterPicker() {
    const q = pickerQ.value.trim().toLowerCase();
    picker.querySelectorAll<HTMLElement>('li[data-name]').forEach((li) => (li.hidden = !!q && !li.dataset.name!.includes(q)));
  }
  pickerQ.addEventListener('input', filterPicker);
  picker.addEventListener('click', (e) => {
    const pick = (e.target as Element).closest<HTMLButtonElement>('[data-pick]');
    if (pick && !pick.disabled) {
      picker.close();
      change([...list, pick.dataset.pick!]);
    } else if (e.target === picker) picker.close();
  });

  hideSame.addEventListener('change', () => {
    document.querySelector('.ctable')?.classList.toggle('hide-same', hideSame.checked);
  });

  // The tray's selection changed in another tab: follow it on the builder page.
  document.addEventListener('compare:change', (e) => {
    const next = (e as CustomEvent<string[]>).detail;
    if (isBuilder && next.join() !== list.join()) {
      list = next;
      render();
    }
  });

  if (isBuilder) {
    if (fromUrl) setSelection(fromUrl);
    render();
  }
}
