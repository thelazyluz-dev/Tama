// Post-processing stack — the single biggest lift to perceived quality:
// ambient occlusion (contact shadows in crevices), a soft bloom for the sun,
// fire and highlights, a gentle vignette, and SMAA anti-aliasing. Read-only.

import { EffectComposer, N8AO, Bloom, Vignette, SMAA } from '@react-three/postprocessing';

export function Effects(): JSX.Element {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={2.2} intensity={2.4} distanceFalloff={0.8} quality="medium" />
      <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.82} luminanceSmoothing={0.25} />
      <Vignette offset={0.28} darkness={0.55} eskil={false} />
      <SMAA />
    </EffectComposer>
  );
}
