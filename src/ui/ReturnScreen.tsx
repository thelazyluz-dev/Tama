// The return screen — shown after offline catch-up. SPEC calls this "the most
// important screen in the game": how much game time passed while you were away,
// and the agent's current state, before handing back control.

import { useGameStore } from '../store';
import type { NeedKey } from '../sim';
import { playerAgent } from '../sim';
import { NEED_LABEL, actionText, elapsedText } from './labels';

const NEED_ORDER: NeedKey[] = ['hunger', 'thirst', 'fatigue'];

export function ReturnScreen(): JSX.Element | null {
  const catchUp = useGameStore((s) => s.catchUp);
  const world = useGameStore((s) => s.world);
  const enterGame = useGameStore((s) => s.enterGame);

  if (!catchUp) return null;
  const agent = playerAgent(world);

  return (
    <div className="return-overlay">
      <div className="return-card">
        <h1 className="return-title">{elapsedText(catchUp.days, catchUp.hours)}</h1>
        <p className="return-sub">בזמן שלא היית, {agent.name} המשיכה לחיות בעמק.</p>

        {catchUp.capped && (
          <p className="return-note">
            חלף זמן רב — הוצג החישוב המלא של 14 ימי המשחק האחרונים בלבד.
          </p>
        )}

        <div className="return-state">
          <div className="return-action">
            <span className="return-action-label">כרגע</span>
            <span className="return-action-value">{actionText(agent)}</span>
          </div>
          <ul className="return-needs">
            {NEED_ORDER.map((key) => (
              <li key={key}>
                <span>{NEED_LABEL[key]}</span>
                <span>{Math.round(agent.needs[key])}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="return-points">
          💠 <strong>{Math.floor(world.playerPoints)}</strong> נקודות השפעה ממתינות לך
        </div>

        <button type="button" className="return-btn" onClick={enterGame}>
          המשך לעמק
        </button>
      </div>
    </div>
  );
}
