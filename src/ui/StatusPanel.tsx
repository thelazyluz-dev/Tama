// Corner status panel: identity + clock, season/weather, health, food store,
// the eight needs as bars, and the current action. Reads the store; never
// writes it.

import { useGameStore } from '../store';
import type { NeedKey } from '../sim';
import { NEED_KEYS } from '../sim';
import {
  NEED_LABEL,
  SEASON_LABEL,
  SEASON_EMOJI,
  WEATHER_LABEL,
  actionText,
  clockText,
  needColor,
  healthColor,
} from './labels';

export function StatusPanel(): JSX.Element {
  const world = useGameStore((s) => s.world);
  const agent = world.agent;

  return (
    <div className="panel status-panel">
      <div className="status-head">
        <span className="agent-name">{agent.name}</span>
        <span className="clock">{clockText(world.day, world.tick)}</span>
      </div>

      <div className="status-env">
        <span className="chip">
          {SEASON_EMOJI[world.season]} {SEASON_LABEL[world.season]}
        </span>
        <span className="chip subtle">{WEATHER_LABEL[world.weather]}</span>
        <span className="chip food">🍎 {Math.round(agent.foodStock)}</span>
      </div>

      <div className="need-row health-row">
        <span className="need-label">בריאות</span>
        <span className="need-bar">
          <span
            className="need-fill"
            style={{ width: `${agent.health}%`, background: healthColor(agent.health) }}
          />
        </span>
        <span className="need-value">{Math.round(agent.health)}</span>
      </div>

      <div className="needs-grid">
        {(NEED_KEYS as readonly NeedKey[]).map((key) => {
          const value = agent.needs[key];
          return (
            <div className="need-row" key={key}>
              <span className="need-label">{NEED_LABEL[key]}</span>
              <span className="need-bar">
                <span
                  className="need-fill"
                  style={{ width: `${value}%`, background: needColor(value) }}
                />
              </span>
              <span className="need-value">{Math.round(value)}</span>
            </div>
          );
        })}
      </div>

      <div className="action-row">
        <span className="action-label">פעולה</span>
        <span className="action-value">{actionText(agent)}</span>
      </div>
    </div>
  );
}
