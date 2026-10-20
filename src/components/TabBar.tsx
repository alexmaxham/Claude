import type { CSSProperties, ReactNode } from 'react';

export type Tab = 'tasks' | 'trophies' | 'calendar' | 'profile';

const icon = (paths: ReactNode) => (
  <svg viewBox="0 0 24 24" width="25" height="25" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'tasks',
    label: 'Tasks',
    icon: icon(
      <>
        <path d="M4 6.5l1.6 1.6L8.6 5" />
        <path d="M4 13.5l1.6 1.6 3-3.1" />
        <path d="M12 7h8M12 14h8M5 20h15" />
      </>,
    ),
  },
  {
    id: 'trophies',
    label: 'Trophies',
    icon: icon(
      <>
        <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0V4z" />
        <path d="M7.5 6H4.5v1.5A3 3 0 0 0 7.6 10.5M16.5 6h3v1.5a3 3 0 0 1-3.1 3" />
        <path d="M12 13.5V17M8.5 20h7l-1-3h-5l-1 3z" />
      </>,
    ),
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: icon(
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.2h.01M12 17.2h.01" strokeWidth="2.4" />
      </>,
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: icon(
      <>
        <circle cx="12" cy="8.5" r="3.8" />
        <path d="M4.5 20c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4" />
      </>,
    ),
  },
];

interface Props {
  tab: Tab;
  onChange: (tab: Tab) => void;
  /** Little badge on Tasks: how many are due today or overdue. */
  dueCount: number;
}

/** The iPhone app's floating liquid glass tab bar. A glass lens slides to the active tab. */
export function TabBar({ tab, onChange, dueCount }: Props) {
  const index = TABS.findIndex((t) => t.id === tab);
  return (
    <nav className="tabbar" aria-label="Sections" style={{ '--i': index } as CSSProperties}>
      <span className="tabbar-lens" aria-hidden="true" />
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tabbar-btn ${t.id === tab ? 'active' : ''}`}
          aria-current={t.id === tab ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          <span className="tabbar-icon">
            {t.icon}
            {t.id === 'tasks' && dueCount > 0 && <span className="tabbar-badge">{dueCount > 99 ? '99+' : dueCount}</span>}
          </span>
          <span className="tabbar-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
