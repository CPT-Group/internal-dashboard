import type { ISourceOptions } from '@tsparticles/engine'
import type { AppTheme } from '@/constants/appThemeCycle'
import { buildAbyssBiolumeOptions } from './presets/abyssBiolume'
import { buildArcaneSparksOptions } from './presets/arcaneSparks'
import { buildAuroraVeilOptions } from './presets/auroraVeil'
import { buildBiohackOozeOptions } from './presets/biohackOoze'
import { buildEmbercoreEmbersOptions } from './presets/embercoreEmbers'
import { buildFrostbyteSnowOptions } from './presets/frostbyteSnow'
import { buildHearthGlowOptions } from './presets/hearthGlow'
import { buildMidasDustOptions } from './presets/midasDust'
import { buildTempestRainOptions } from './presets/tempestRain'
import { buildTundraFlurryOptions } from './presets/tundraFlurry'
import { readThemeParticleColors } from './readThemeParticleColors'
import type { ThemeAmbientConfig } from './types'

const AMBIENT_CONFIGS: Partial<Record<AppTheme, ThemeAmbientConfig>> = {
  'cpt-barbie':  { overlay: 'barbie-bubbles' },
  'dark-barbie': { overlay: 'barbie-bubbles' },
  'all-american':       { overlay: 'americana' },
  'all-american-night': { overlay: 'americana' },
  'frostbyte':   { preset: 'frostbyte-snow',    overlay: 'frost-noise' },
  'embercore':   { preset: 'embercore-embers',   overlay: 'lava-cracks' },
  'abyss':       { preset: 'abyss-biolume' },
  'tempest':     { preset: 'tempest-rain' },
  'midas':       { preset: 'midas-dust' },
  'aurora':      { preset: 'aurora-veil',        overlay: 'aurora-glow' },
  'arcane':      { preset: 'arcane-sparks' },
  'biohack':     { preset: 'biohack-ooze' },
  'hearth':      { preset: 'hearth-glow' },
  'tundra':      { preset: 'tundra-flurry' },
}

export function getAmbientConfig(themeId: AppTheme): ThemeAmbientConfig | null {
  return AMBIENT_CONFIGS[themeId] ?? null
}

export function buildAmbientOptions(themeId: AppTheme): ISourceOptions | null {
  const ambient = AMBIENT_CONFIGS[themeId]
  if (!ambient?.preset) return null

  const colors = readThemeParticleColors()
  switch (ambient.preset) {
    case 'frostbyte-snow':    return buildFrostbyteSnowOptions(colors)
    case 'embercore-embers':  return buildEmbercoreEmbersOptions(colors)
    case 'aurora-veil':       return buildAuroraVeilOptions(colors)
    case 'abyss-biolume':     return buildAbyssBiolumeOptions(colors)
    case 'tempest-rain':      return buildTempestRainOptions(colors)
    case 'tundra-flurry':     return buildTundraFlurryOptions(colors)
    case 'biohack-ooze':      return buildBiohackOozeOptions(colors)
    case 'arcane-sparks':     return buildArcaneSparksOptions(colors)
    case 'hearth-glow':       return buildHearthGlowOptions(colors)
    case 'midas-dust':        return buildMidasDustOptions(colors)
    default: {
      const exhaustive: never = ambient.preset
      return exhaustive
    }
  }
}
