// The player's influence panel (SPEC stage-5 UI): the point balance, the four
// priority sliders (channel 1 — a ×0.5..×2 nudge on each category's appeal), and
// the shop of interventions (channel 2 — points buy opportunities, never bread).
// Reads the store and calls its stage-5 setters; holds no sim logic itself.

import { useState } from 'react';
import { useGameStore } from '../store';
import { SHOP_ITEMS, PRIORITY_MIN, PRIORITY_MAX } from '../sim';
import type { PriorityCategory } from '../sim';
import { PRIORITY_LABEL, INTERVENTION_EMOJI } from './labels';

const CATEGORIES: PriorityCategory[] = ['survival', 'social', 'research', 'building'];

export function PlayerPanel(): JSX.Element {
  const [open, setOpen] = useState(false);
  const world = useGameStore((s) => s.world);
  const setPriority = useGameStore((s) => s.setPriority);
  const buyIntervention = useGameStore((s) => s.buyIntervention);

  const points = Math.floor(world.playerPoints);

  return (
    <div className="player-wrap">
      {open && (
        <div className="panel player-panel">
          <div className="player-points-big">
            <span className="pp-diamond">💠</span> {points}
            <span className="pp-unit">נקודות</span>
          </div>

          <div className="player-section-head">עדיפויות · ×{PRIORITY_MIN}–×{PRIORITY_MAX}</div>
          <div className="priority-list">
            {CATEGORIES.map((cat) => {
              const value = world.playerPriorities[cat];
              return (
                <div className="priority-row" key={cat}>
                  <span className="priority-label">
                    {PRIORITY_LABEL[cat].emoji} {PRIORITY_LABEL[cat].name}
                  </span>
                  <input
                    className="priority-slider"
                    type="range"
                    min={PRIORITY_MIN}
                    max={PRIORITY_MAX}
                    step={0.1}
                    value={value}
                    onChange={(e) => setPriority(cat, Number(e.target.value))}
                    aria-label={PRIORITY_LABEL[cat].name}
                  />
                  <span className={`priority-value${value > 1.05 ? ' up' : value < 0.95 ? ' down' : ''}`}>
                    ×{value.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="player-section-head">חנות הזדמנויות</div>
          <div className="shop-list">
            {SHOP_ITEMS.map((item) => {
              const usable = item.available(world);
              const affordable = points >= item.cost;
              const canBuy = usable && affordable;
              return (
                <div className={`shop-item${usable ? '' : ' locked'}`} key={item.id}>
                  <div className="shop-item-head">
                    <span className="shop-item-name">
                      {INTERVENTION_EMOJI[item.id]} {item.name}
                    </span>
                    <button
                      type="button"
                      className="shop-buy"
                      disabled={!canBuy}
                      onClick={() => buyIntervention(item.id)}
                    >
                      💠 {item.cost}
                    </button>
                  </div>
                  <div className="shop-item-desc">{item.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button type="button" className="panel player-toggle" onClick={() => setOpen((o) => !o)}>
        🎛️ השפעה · <span className="pt-points">💠 {points}</span>
      </button>
    </div>
  );
}
