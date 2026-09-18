// Composition root for the Tamagotchi: the 3D stage, the care HUD, and the
// welcome-back / goodbye overlays. Starts the real-time loop. No game logic.

import { PetScene } from './render/PetScene';
import { PetHud } from './ui/PetHud';
import { PetOverlays } from './ui/PetOverlays';
import { usePetLoop } from './store';

export function PetApp(): JSX.Element {
  usePetLoop();
  return (
    <div className="app pet-app">
      <PetScene />
      <div className="hud">
        <PetHud />
      </div>
      <PetOverlays />
    </div>
  );
}
