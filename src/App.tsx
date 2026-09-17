// Composition root: the 3D canvas, the HUD overlay, and the return screen.
// Starts the real-time loop. No sim logic lives here.

import { GameCanvas } from './render';
import {
  StatusPanel,
  SpeedControls,
  ReturnScreen,
  JournalPanel,
  DeathScreen,
  FamilyPanel,
} from './ui';
import { useGameLoop, useGameStore } from './store';

export function App(): JSX.Element {
  useGameLoop();
  const phase = useGameStore((s) => s.phase);

  return (
    <div className="app">
      <GameCanvas />
      <div className="hud">
        <StatusPanel />
        <JournalPanel />
        <FamilyPanel />
        <SpeedControls />
      </div>
      {phase === 'return' && <ReturnScreen />}
      <DeathScreen />
    </div>
  );
}
