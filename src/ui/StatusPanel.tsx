// Corner status panel: identity + clock, season/weather, health, food store,
// the eight needs as bars, and the current action. Collapsible — compact by
// default on phones so it never hides the creature. Reads the store; never
// writes it.

import { useState } from 'react';
import { useGameStore } from '../store';
import type { NeedKey } from '../sim';
import { NEED_KEYS, playerAgent, partnerOf } from '../sim';
import {
  NEED_LABEL,
  SEASON_LABEL,
  SEASON_EMOJI,
  WEATHER_LABEL,
  TECH_LABEL,
  actionText,
  clockText,
  needColor,
  healthColor,
} from './labels';

function isPhone(): boolean {
  try {
    return window.matchMedia('(max-width: 700px)').matches;
  } catch {
    return false;
  }
}

export function StatusPanel(): JSX.Element {
  const world = useGameStore((s) => s.world);
  const renameAgent = useGameStore((s) => s.renameAgent);
  const agent = playerAgent(world);

  // Relationship line: partner, or the nomad the player is getting to know.
  const partner = partnerOf(world, agent);
  const other = partner ?? world.agents.find((a) => a.id !== agent.id && a.alive) ?? null;
  const rel = other ? agent.relations[other.id] : undefined;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [collapsed, setCollapsed] = useState(isPhone);

  const startEdit = () => {
    setDraft(agent.name);
    setEditing(true);
  };
  const commit = () => {
    renameAgent(draft);
    setEditing(false);
  };

  return (
    <div className={`panel status-panel${collapsed ? ' collapsed' : ''}`}>
      <div className="status-head">
        {editing ? (
          <input
            className="agent-name-input"
            value={draft}
            autoFocus
            maxLength={20}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <button type="button" className="agent-name" onClick={startEdit} title="לחצי לשינוי השם">
            {agent.name} <span className="name-edit-hint">✎</span>
          </button>
        )}
        <span className="clock">{clockText(world.day, world.tick)}</span>
        <button
          type="button"
          className="status-collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'הרחב' : 'כווץ'}
        >
          {collapsed ? '▾' : '▴'}
        </button>
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

      {collapsed ? (
        <div className="status-mini">
          <span className="chip">
            {SEASON_EMOJI[world.season]} {SEASON_LABEL[world.season]}
          </span>
          <span className="chip food">🍎 {Math.round(world.foodStock)}</span>
          <span className="chip subtle mini-action">{actionText(agent)}</span>
        </div>
      ) : (
        <>
          <div className="status-env">
            <span className="chip">
              {SEASON_EMOJI[world.season]} {SEASON_LABEL[world.season]}
            </span>
            <span className="chip subtle">{WEATHER_LABEL[world.weather]}</span>
            <span className="chip food">🍎 {Math.round(world.foodStock)}</span>
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

          {other && rel && (
            <div className="rel-row">
              <span className="rel-label">{partner ? '❤️ בן/בת זוג' : '🙂 מכר/ה'}</span>
              <span className="rel-value">
                {other.name} · חיבה {Math.round(rel.affection)}
              </span>
            </div>
          )}

          {world.knowledge.known.length > 0 && (
            <div className="tech-row">
              <span className="tech-label">ידע</span>
              <span className="tech-chips">
                {world.knowledge.known.map((tech) => (
                  <span className="tech-chip" key={tech} title={TECH_LABEL[tech].name}>
                    {TECH_LABEL[tech].emoji} {TECH_LABEL[tech].name}
                  </span>
                ))}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
