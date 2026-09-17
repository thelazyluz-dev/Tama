// Shown when the whole valley has died out. In stage 3 a lone death no longer
// ends the run (a partner may carry on); heirs arrive in stage 4. Read-only
// except for the explicit "new valley" action.

import { useGameStore } from '../store';
import { playerAgent } from '../sim';

export function DeathScreen(): JSX.Element | null {
  const world = useGameStore((s) => s.world);
  const newGame = useGameStore((s) => s.newGame);

  const anyAlive = world.agents.some((a) => a.alive);
  if (anyAlive) return null;

  const a = playerAgent(world);
  const gone = a.sex === 'female' ? 'איננה' : 'איננו';
  const survived = a.sex === 'female' ? 'שרדה' : 'שרד';
  const lastLine = [...world.journal].reverse().find((e) => e.kind === 'death');

  return (
    <div className="return-overlay death-overlay">
      <div className="return-card">
        <h1 className="return-title">
          {a.name} {gone}
        </h1>
        <p className="return-sub">
          {survived} {world.day} ימים בעמק. סיבת המוות: {a.deathCause ?? 'לא ידועה'}.
        </p>

        {lastLine && <p className="death-epitaph">"{lastLine.text}"</p>}

        <button type="button" className="return-btn" onClick={newGame}>
          התחל עמק חדש
        </button>
      </div>
    </div>
  );
}
