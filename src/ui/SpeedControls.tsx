// Speed buttons ×1 / ×5 / ×20 (SPEC: the view-speed control and key dev tool).

import { useGameStore } from '../store';
import { SPEED_STEPS } from '../sim';

export function SpeedControls(): JSX.Element {
  const speed = useGameStore((s) => s.speed);
  const setSpeed = useGameStore((s) => s.setSpeed);

  return (
    <div className="panel speed-controls" role="group" aria-label="מהירות">
      {SPEED_STEPS.map((step) => (
        <button
          key={step}
          type="button"
          className={step === speed ? 'speed-btn active' : 'speed-btn'}
          onClick={() => setSpeed(step)}
        >
          ×{step}
        </button>
      ))}
    </div>
  );
}
