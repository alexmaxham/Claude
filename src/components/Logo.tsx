import { useId } from 'react';

/**
 * The Tasko "level up" mark: three rising chevrons on a deep navy tile. In the
 * app the chevrons pick up the current theme's colors; the installed app icon
 * (public/icon*.svg) keeps the brand blue.
 */
export function LogoMark({ size = 36, title }: { size?: number; title?: string }) {
  const bg = useId();
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2b66" />
          <stop offset="1" stopColor="#0a1230" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill={`url(#${bg})`} />
      <g fill="none" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M28 76L50 58L72 76" style={{ stroke: 'var(--accent)' }} />
        <path d="M28 59L50 41L72 59" style={{ stroke: 'var(--accent-2)' }} />
        <path d="M28 42L50 24L72 42" stroke="#fff" />
      </g>
    </svg>
  );
}

/** "tasko" in Sora with a small two-chevron rank mark. */
export function Wordmark() {
  return (
    <span className="wordmark">
      tasko
      <svg className="wordmark-chevrons" viewBox="0 0 26 30" aria-hidden="true">
        <path d="M4 27L13 19L22 27" style={{ stroke: 'var(--accent)' }} />
        <path d="M4 17L13 9L22 17" style={{ stroke: 'var(--accent-2)' }} />
      </svg>
    </span>
  );
}
