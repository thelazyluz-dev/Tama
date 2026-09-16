// Shown when the agent dies. In stage 1 there are no heirs yet (generations
// arrive in stage 4), so death ends the run — with the option to start a fresh
// valley. Read-only except for the explicit "new valley" action.

import { useGameStore } from '../store';

export function DeathScreen(): JSX.Element | null {
  const world = useGameStore((s) => s.world);
  const newGame = useGameStore((s) => s.newGame);

  if (world.agent.alive) return null;
  const a = world.agent;
  const lastLine = [...world.journal].reverse().find((e) => e.kind === 'death');

  return (
    <div className="return-overlay death-overlay">
      <div className="return-card">
        <h1 className="return-title">{a.name} איננה</h1>
        <p className="return-sub">
          שרדה {world.day} ימים בעמק. סיבת המוות: {a.deathCause ?? 'לא ידועה'}.
        </p>

        {lastLine && <p className="death-epitaph">"{lastLine.text}"</p>}

        <button type="button" className="return-btn" onClick={newGame}>
          התחל עמק חדש
        </button>
      </div>
    </div>
  );
}
