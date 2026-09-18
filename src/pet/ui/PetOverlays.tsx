// Two full-screen moments: the welcome-back after time away (your pet lived on
// while you were gone), and the goodbye when it dies — with a fresh egg to hatch.

import { usePetStore } from '../store';

export function PetOverlays(): JSX.Element | null {
  const phase = usePetStore((s) => s.phase);
  const away = usePetStore((s) => s.away);
  const pet = usePetStore((s) => s.pet);
  const dismiss = usePetStore((s) => s.dismissReturn);
  const newPet = usePetStore((s) => s.newPet);

  if (!pet.alive) {
    return (
      <div className="pet-overlay death">
        <div className="pet-card">
          <div className="pet-card-emoji">🕊️</div>
          <h1>{pet.name} כבר לא איתנו</h1>
          <p className="pet-card-sub">{deathLine(pet.deathCause)}</p>
          <p className="pet-card-note">חי/תה {Math.floor(pet.ageTicks / 60)} דקות. תודה שדאגת.</p>
          <button type="button" className="pet-btn" onClick={newPet}>
            בקע ביצה חדשה 🥚
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'return' && away) {
    return (
      <div className="pet-overlay">
        <div className="pet-card">
          <div className="pet-card-emoji">👋</div>
          <h1>{awayText(away.hours, away.minutes)}</h1>
          <p className="pet-card-sub">בזמן שלא היית, {pet.name} המשיך/ה לחיות.</p>
          {away.capped && <p className="pet-card-note">חלף זמן רב — הוצג החישוב של 12 השעות האחרונות.</p>}
          <ul className="pet-away-stats">
            <li><span>🍖</span><span>{Math.round(pet.stats.fullness)}</span></li>
            <li><span>😊</span><span>{Math.round(pet.stats.happiness)}</span></li>
            <li><span>❤️</span><span>{Math.round(pet.stats.health)}</span></li>
          </ul>
          {pet.poops.length > 0 && <p className="pet-card-note">יש {pet.poops.length} קקי לנקות 💩</p>}
          {pet.sick && <p className="pet-card-note">{pet.name} חולה — תן/י תרופה 💊</p>}
          <button type="button" className="pet-btn" onClick={dismiss}>
            בוא נטפל בו/ה
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function deathLine(cause?: string): string {
  if (cause === 'רעב') return 'הרעב גבר. חשוב להאכיל בזמן.';
  if (cause === 'מחלה') return 'המחלה לא טופלה בזמן.';
  return 'ההזנחה גבתה את שלה.';
}

function awayText(h: number, m: number): string {
  if (h === 0 && m === 0) return 'חזרת!';
  if (h === 0) return `עברו ${m} דקות`;
  if (m === 0) return `עברו ${h} שעות`;
  return `עברו ${h} שע׳ ו־${m} דק׳`;
}
