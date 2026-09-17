// The crisis alert (SPEC stage-5 "משבר"): when a living agent's health drops
// below the crisis threshold, an urgent banner appears offering the one direct
// rescue the player can buy. This is the moment meant to pull the player back
// into the app, so it must stay rare — health rarely reaches here for a tribe
// that's coping. Dismissable per episode; reappears if a new crisis begins.

import { useEffect, useState } from 'react';
import { useGameStore } from '../store';
import { crisisActive, SHOP_ITEMS } from '../sim';
import type { Agent } from '../sim';

export function CrisisAlert(): JSX.Element | null {
  const world = useGameStore((s) => s.world);
  const buyIntervention = useGameStore((s) => s.buyIntervention);
  const active = crisisActive(world);

  const [dismissed, setDismissed] = useState(false);
  // Reset the dismissal once the crisis clears, so the next one shows again.
  useEffect(() => {
    if (!active) setDismissed(false);
  }, [active]);

  if (!active || dismissed) return null;

  const patient = world.agents
    .filter((a) => a.alive)
    .reduce<Agent | null>((worst, a) => (!worst || a.health < worst.health ? a : worst), null);
  if (!patient) return null;

  const medicine = SHOP_ITEMS.find((i) => i.id === 'medicine')!;
  const canRescue = Math.floor(world.playerPoints) >= medicine.cost;

  return (
    <div className="crisis-alert">
      <div className="crisis-text">
        <span className="crisis-mark">⚠️</span>
        <strong>{patient.name}</strong> במשבר · בריאות {Math.round(patient.health)}
      </div>
      <div className="crisis-actions">
        <button
          type="button"
          className="crisis-rescue"
          disabled={!canRescue}
          onClick={() => buyIntervention('medicine')}
        >
          {canRescue ? `✚ הצלה · 💠 ${medicine.cost}` : `💠 ${medicine.cost} — אין מספיק`}
        </button>
        <button
          type="button"
          className="crisis-dismiss"
          onClick={() => setDismissed(true)}
          aria-label="התעלם"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
