'use client';

import { Suspense, lazy, useMemo, type CSSProperties, type JSX } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { buildAmbientOptions, getAmbientConfig } from '@/theme/ambient';
import { ThemeAmbientAmericana } from './ThemeAmbientAmericana';
import { ThemeAmbientBarbieBubbles } from './ThemeAmbientBarbieBubbles';
import { ThemeAmbientLavaCracks } from './ThemeAmbientLavaCracks';

// Lazy — tsparticles engine chunk loads only when an ambient theme is active.
const ThemeAmbientParticles = lazy(() =>
  import('./ThemeAmbientParticles').then(m => ({ default: m.ThemeAmbientParticles }))
)

/**
 * Ambient theme layer.
 *
 * Renders `.app-ambient-overlay` (z-index 900, above app surfaces,
 * pointer-events: none) with particle canvases and/or static SVG overlays
 * for themed ambience. PrimeReact dialogs/menus/toasts portal to document.body
 * at z-index 1000+ and stay above the overlay.
 *
 * Tizen TV (pre-2022 CSS): frost/aurora overlays use JS-computed rgba()
 * inline styles instead of color-mix() to stay within Tizen's CSS support.
 *
 * Skips particles entirely under prefers-reduced-motion: reduce.
 */
export function ThemeAmbientLayer(): JSX.Element | null {
  const { theme } = useTheme()

  const ambient = useMemo(() => getAmbientConfig(theme), [theme])
  const particleOptions = useMemo(() => buildAmbientOptions(theme), [theme])

  const reducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  if (!ambient) return null

  const showParticles = particleOptions !== null && !reducedMotion
  const showFrost = ambient.overlay === 'frost-noise'
  const showAurora = ambient.overlay === 'aurora-glow'
  const showLavaCracks = ambient.overlay === 'lava-cracks'
  const showBarbieBubbles = ambient.overlay === 'barbie-bubbles'
  const showAmericana = ambient.overlay === 'americana'

  return (
    <div className="app-ambient-overlay" aria-hidden="true">
      {showFrost && <FrostOverlay />}
      {showAurora && <AuroraOverlay />}
      {showLavaCracks && <ThemeAmbientLavaCracks />}
      {showBarbieBubbles && <ThemeAmbientBarbieBubbles />}
      {showAmericana && <ThemeAmbientAmericana />}
      {showParticles && (
        <Suspense fallback={null}>
          <ThemeAmbientParticles themeId={theme} options={particleOptions} />
        </Suspense>
      )}
    </div>
  )
}

// Tizen-safe frost overlay: JS-computed rgba() instead of color-mix().
function FrostOverlay(): JSX.Element {
  const style = useMemo<CSSProperties>(() => {
    const primary = readCssVar('--primary-color') || '#88c0d0'
    const accent = readCssVar('--nova-accent-border') || primary
    return {
      background: [
        `radial-gradient(ellipse 140% 80% at 15% 60%, ${hexToRgba(primary, 0.12)} 0%, transparent 55%)`,
        `radial-gradient(ellipse 100% 60% at 80% 30%, ${hexToRgba(accent, 0.08)} 0%, transparent 50%)`,
      ].join(', '),
    }
  }, [])
  return <div className="app-ambient-overlay__frost" style={style} />
}

// Tizen-safe aurora overlay: JS-computed rgba() instead of color-mix().
function AuroraOverlay(): JSX.Element {
  const style = useMemo<CSSProperties>(() => {
    const primary = readCssVar('--primary-color') || '#a78bfa'
    const accent = readCssVar('--nova-accent-border') || '#38bdf8'
    return {
      background: [
        `linear-gradient(160deg, ${hexToRgba(primary, 0.18)} 0%, transparent 45%)`,
        `linear-gradient(200deg, ${hexToRgba(accent, 0.14)} 30%, transparent 70%)`,
      ].join(', '),
    }
  }, [])
  return <div className="app-ambient-overlay__aurora" style={style} />
}

function readCssVar(prop: string): string {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(prop).trim()
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace(/^#/, '')
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(136,192,208,${alpha})`
  return `rgba(${r},${g},${b},${alpha})`
}
