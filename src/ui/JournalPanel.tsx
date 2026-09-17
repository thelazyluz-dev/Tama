// The journal panel — SPEC: "this is the real content of the game." Shows the
// most recent entries, newest first, styled by kind. Read-only.

import { useGameStore } from '../store';
import type { JournalKind } from '../sim';

const SHOWN = 14;

const KIND_CLASS: Partial<Record<JournalKind, string>> = {
  death: 'j-death',
  danger: 'j-danger',
  build: 'j-build',
  discovery: 'j-build',
  season: 'j-season',
  weather: 'j-season',
  player: 'j-player',
};

export function JournalPanel(): JSX.Element {
  // The journal array identity changes each tick (pure clone), so this stays
  // in sync; the list is tiny, so re-rendering it is cheap.
  const journal = useGameStore((s) => s.world.journal);
  const recent = journal.slice(-SHOWN).reverse();

  return (
    <div className="panel journal-panel">
      <div className="journal-head">יומן</div>
      <ul className="journal-list">
        {recent.length === 0 && <li className="journal-empty">העמק שקט. הסיפור עוד ייכתב.</li>}
        {recent.map((entry, i) => (
          <li
            key={journal.length - i}
            className={`journal-entry ${KIND_CLASS[entry.kind] ?? ''} ${
              entry.weight === 3 ? 'j-strong' : ''
            }`}
          >
            <span className="journal-day">יום {entry.day + 1}</span>
            <span className="journal-text">{entry.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
