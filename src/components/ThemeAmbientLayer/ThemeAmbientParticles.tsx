'use client';

import type { ISourceOptions } from '@tsparticles/engine'
import type { JSX } from 'react';
import { Particles, ParticlesProvider } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'

// Module-level stable ref — ParticlesProvider requires a stable init function
// between renders. Declared outside the component so it is never recreated.
const initSlimEngine = async (engine: Parameters<typeof loadSlim>[0]): Promise<void> => {
  await loadSlim(engine)
}

interface ThemeAmbientParticlesProps {
  themeId: string
  options: ISourceOptions
}

export function ThemeAmbientParticles({ themeId, options }: ThemeAmbientParticlesProps): JSX.Element {
  return (
    <ParticlesProvider init={initSlimEngine}>
      <Particles
        key={themeId}
        id={`theme-ambient-particles-${themeId}`}
        className="app-ambient-overlay__particles"
        options={options}
      />
    </ParticlesProvider>
  )
}
