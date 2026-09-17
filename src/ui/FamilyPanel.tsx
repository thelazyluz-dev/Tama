// The family tree (SPEC stage-4 UI) — a toggleable list of the whole lineage,
// grouped by generation, living and dead. Read-only.

import { useState } from 'react';
import { useGameStore } from '../store';
import { ageDays } from '../sim';
import type { Agent } from '../sim';

export function FamilyPanel(): JSX.Element {
  const [open, setOpen] = useState(false);
  const agents = useGameStore((s) => s.world.agents);
  const playerId = useGameStore((s) => s.world.playerAgentId);
  const day = useGameStore((s) => s.world.day);

  const generations = new Map<number, Agent[]>();
  for (const a of agents) {
    const list = generations.get(a.generation) ?? [];
    list.push(a);
    generations.set(a.generation, list);
  }
  const gens = [...generations.keys()].sort((x, y) => x - y);
  const living = agents.filter((a) => a.alive).length;

  return (
    <div className="family-wrap">
      <button type="button" className="panel family-toggle" onClick={() => setOpen((o) => !o)}>
        👪 שושלת · {living}
      </button>
      {open && (
        <div className="panel family-panel">
          {gens.map((g) => (
            <div className="family-gen" key={g}>
              <div className="family-gen-head">דור {g}</div>
              {generations.get(g)!.map((a) => (
                <div
                  className={`family-member${a.alive ? '' : ' dead'}${a.id === playerId ? ' player' : ''}`}
                  key={a.id}
                >
                  <span>{a.sex === 'female' ? '♀' : '♂'}</span>
                  <span className="family-name">{a.name}</span>
                  <span className="family-meta">
                    {a.alive ? `בן/בת ${ageDays(a, day)}` : `† ${a.deathCause ?? ''}`}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
