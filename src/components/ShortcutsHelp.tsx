import { Sheet } from './Sheet';

const SHORTCUTS: [string, string][] = [
  ['N', 'Add a new quest'],
  ['/', 'Search'],
  ['J / ↓', 'Select next quest'],
  ['K / ↑', 'Select previous quest'],
  ['X / Space', 'Complete or un-complete the selected quest'],
  ['E / Enter', 'Edit the selected quest'],
  ['Esc', 'Clear search and selection'],
  ['?', 'Show these shortcuts'],
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Keyboard shortcuts" onClose={onClose}>
      <dl className="shortcuts">
        {SHORTCUTS.map(([keys, what]) => (
          <div key={keys} className="shortcut">
            <dt>
              {keys.split(' / ').map((k, i) => (
                <span key={k}>
                  {i > 0 && <span className="muted"> or </span>}
                  <kbd>{k}</kbd>
                </span>
              ))}
            </dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}
