// Theme toggle: follows the OS until the visitor picks a theme, then remembers it.
const root = document.documentElement;
const media = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : media.matches);

function sync() {
  const dark = isDark();
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('aria-pressed', String(dark));
  }
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = dark ? '#0e1416' : '#f5fafc';
    m.removeAttribute('media');
  });
}

document.addEventListener('click', (e) => {
  if (!(e.target as Element).closest('[data-theme-toggle]')) return;
  const next = isDark() ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {}
  sync();
});
media.addEventListener('change', sync);
sync();
export {};
