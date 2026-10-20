import { useEffect } from 'react';
import { setStatusBar } from './native';

export type Appearance = 'system' | 'light' | 'dark';

const media = () => window.matchMedia?.('(prefers-color-scheme: light)');

/** Sets `data-scheme` on <html>, which the stylesheet uses for light mode, and the browser bar color. */
function apply(appearance: Appearance) {
  const light = appearance === 'light' || (appearance === 'system' && !!media()?.matches);
  document.documentElement.dataset.scheme = light ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#e8ecf5' : '#04070f');
  setStatusBar(light);
}

/** Keeps the page in the chosen appearance; "system" follows the OS setting as it changes. */
export function useAppearance(appearance: Appearance) {
  useEffect(() => {
    apply(appearance);
    if (appearance !== 'system') return;
    const mq = media();
    const onChange = () => apply('system');
    mq?.addEventListener('change', onChange);
    return () => mq?.removeEventListener('change', onChange);
  }, [appearance]);
}
