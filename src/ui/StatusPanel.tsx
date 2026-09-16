// Corner status panel: day + clock, the three needs as bars, and the current
// action in text. Reads the store; never writes it.

import { useGameStore } from '../store';
import type { NeedKey } from '../sim';
import { NEED_LABEL, actionText, clockText, needColor } from './labels';

const NEED_ORDER: NeedKey[] = ['hunger', 'thirst', 'fatigue'];

export function StatusPanel(): JSX.Element {
  const world = useGameStore((s) => s.world);
  const agent = world.agent;

  return (
    <div className="panel status-panel">
      <div className="status-head">
        <span className="agent-name">{agent.name}</span>
        <span className="clock">{clockText(world.day, world.tick)}</span>
      </div>

      <div className="needs">
        {NEED_ORDER.map((key) => {
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
