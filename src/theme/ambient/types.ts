/** Known particle presets. Each id maps to an options factory in `presets/`. */
export type ThemeAmbientPreset =
  | 'frostbyte-snow'
  | 'embercore-embers'
  | 'aurora-veil'
  | 'abyss-biolume'
  | 'tempest-rain'
  | 'tundra-flurry'
  | 'biohack-ooze'
  | 'arcane-sparks'
  | 'hearth-glow'
  | 'midas-dust'

/** Decorative static overlays rendered behind the particles. */
export type ThemeAmbientOverlay = 'frost-noise' | 'aurora-glow' | 'lava-cracks' | 'barbie-bubbles'

export interface ThemeAmbientConfig {
  readonly preset?: ThemeAmbientPreset
  readonly overlay?: ThemeAmbientOverlay
}

export interface ThemeAmbientColors {
  readonly primary: string
  readonly accent: string
  /** Chrome foreground (headerFg) — warm/cool support tone for variety. */
  readonly chrome: string
}
