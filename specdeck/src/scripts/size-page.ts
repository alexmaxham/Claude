// The /size/ page: pick up to four devices and redraw them to scale. The picks live in ?d=slug,slug.
import { sizeViewHtml } from '../lib/size';
import type { Device } from '../lib/schema';

const root = document.querySelector<HTMLElement>('[data-size-page]');
if (root) {
  const MAX = 4;
  const devices = new Map(
    (JSON.parse(document.getElementById('size-data')!.textContent!) as Device[]).map((d) => [d.slug, d]),
  );
  const host = root.querySelector<HTMLElement>('[data-size-view]')!;
  const fromUrl = new URLSearchParams(location.search).get('d')?.split(',').filter((s) => devices.has(s));
  let list = (fromUrl?.length ? fromUrl : root.dataset.initial!.split(',')).slice(0, MAX);

  function render(redraw: boolean) {
    if (redraw) host.innerHTML = list.length ? sizeViewHtml(list.map((s) => devices.get(s)!)) : '';
    root!.querySelectorAll<HTMLButtonElement>('[data-size-pick]').forEach((b) => {
      const on = list.includes(b.dataset.sizePick!);
      b.setAttribute('aria-pressed', String(on));
      b.disabled = !devices.has(b.dataset.sizePick!) || (!on && list.length >= MAX);
    });
    root!.querySelector('[data-pick-count]')!.textContent = list.length
      ? `${list.length} of ${MAX} picked${list.length >= MAX ? '. Remove one to pick another.' : ''}`
      : 'Pick a device to draw it.';
    const url = new URL(location.href);
    url.searchParams.set('d', list.join(','));
    if (!list.length) url.searchParams.delete('d');
    history.replaceState(null, '', url);
  }

  root.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-size-pick]');
    if (!b || b.disabled) return;
    const slug = b.dataset.sizePick!;
    list = list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
    render(true);
  });

  render(!!fromUrl?.length);
}
export {};
