// The care HUD: the pet's meters, a needs alert, and the classic Tamagotchi
// button bar (feed / snack / play / clean / medicine / sleep). Reads the store
// and calls its care actions; holds no game logic.

import { useState } from 'react';
import { usePetStore } from '../store';
import { moodOf, petNeed } from '../pet';
import type { PetState } from '../types';

interface Meter {
  key: keyof PetState['stats'];
  label: string;
  emoji: string;
  good: 'high';
}
const METERS: Meter[] = [
  { key: 'fullness', label: 'שובע', emoji: '🍖', good: 'high' },
  { key: 'happiness', label: 'שמחה', emoji: '😊', good: 'high' },
  { key: 'energy', label: 'אנרגיה', emoji: '⚡', good: 'high' },
  { key: 'hygiene', label: 'ניקיון', emoji: '🧼', good: 'high' },
];

function barColor(v: number): string {
  const hue = 120 * (Math.min(100, Math.max(0, v)) / 100);
  return `hsl(${hue.toFixed(0)}, 65%, 48%)`;
}

const STAGE_LABEL: Record<string, string> = {
  egg: 'ביצה 🥚',
  baby: 'תינוק/ת 🐣',
  child: 'ילד/ה',
  adult: 'בוגר/ת',
};

export function PetHud(): JSX.Element {
  const pet = usePetStore((s) => s.pet);
  const store = usePetStore();
  const [logOpen, setLogOpen] = useState(false);

  const alive = pet.alive;
  const egg = pet.stage === 'egg';
  const sleeping = pet.sleeping;
  const busy = !alive || egg;
  const need = petNeed(pet);

  const ageMin = Math.floor(pet.ageTicks / 60);

  const btn = (
    emoji: string,
    label: string,
    onClick: () => void,
    disabled: boolean,
    accent?: boolean,
  ): JSX.Element => (
    <button
      type="button"
      className={`care-btn${accent ? ' accent' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="care-emoji">{emoji}</span>
      <span className="care-label">{label}</span>
    </button>
  );

  return (
    <div className="pet-hud">
      {/* top: identity + meters */}
      <div className="panel pet-status">
        <div className="pet-head">
          <span className="pet-name">{pet.name}</span>
          <span className="pet-stage">
            {STAGE_LABEL[pet.stage]} · {ageMin} דק׳
          </span>
        </div>

        <div className="pet-health">
          <span className="ph-label">❤️ בריאות</span>
          <span className="ph-bar">
            <span className="ph-fill" style={{ width: `${pet.stats.health}%`, background: barColor(pet.stats.health) }} />
          </span>
          <span className="ph-val">{Math.round(pet.stats.health)}</span>
        </div>

        <div className="pet-meters">
          {METERS.map((m) => {
            const v = pet.stats[m.key];
            return (
              <div className="pet-meter" key={m.key}>
                <span className="pm-label">{m.emoji}</span>
                <span className="pm-bar">
                  <span className="pm-fill" style={{ width: `${v}%`, background: barColor(v) }} />
                </span>
              </div>
            );
          })}
        </div>

        {need && alive && <div className="pet-need">{need}</div>}
        {pet.sick && <div className="pet-sick">🤒 חולה!</div>}
      </div>

      {/* bottom: the care bar */}
      <div className="care-bar">
        {btn('🍎', 'האכל', () => store.feed(false), busy || sleeping || pet.stats.fullness >= 96)}
        {btn('🍬', 'חטיף', () => store.feed(true), busy || sleeping)}
        {btn('🎾', 'שחק', () => store.play(), busy || sleeping)}
        {btn('🧼', 'נקה', () => store.clean(), !alive || pet.poops.length === 0, pet.poops.length > 0)}
        {btn('💊', 'תרופה', () => store.heal(), !alive || !pet.sick, pet.sick)}
        {btn(sleeping ? '💡' : '💤', sleeping ? 'הער' : 'שינה', () => store.toggleSleep(), busy)}
      </div>

      {/* log toggle + panel */}
      <div className="pet-log-wrap">
        <button type="button" className="panel pet-log-toggle" onClick={() => setLogOpen((o) => !o)}>
          📖 יומן
        </button>
        {logOpen && (
          <div className="panel pet-log">
            {pet.log.length === 0 && <div className="pet-log-empty">עוד לא קרה כלום.</div>}
            {pet.log
              .slice(-24)
              .reverse()
              .map((e, i) => (
                <div className={`pet-log-line k-${e.kind}`} key={pet.log.length - i}>
                  {e.text}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* mood tag (debug-friendly, also cute) */}
      {alive && !egg && <MoodTag />}
    </div>
  );
}

function MoodTag(): JSX.Element {
  const pet = usePetStore((s) => s.pet);
  const mood = moodOf(pet);
  const EMOJI: Record<string, string> = {
    happy: '😄', content: '🙂', hungry: '🍽️', sad: '😞', sleepy: '😴', sick: '🤒', dead: '☠️',
  };
  return <div className="pet-mood">{EMOJI[mood]}</div>;
}
