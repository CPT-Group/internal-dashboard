import type { ThemeAmbientColors } from './types'

/**
 * Extract particle colors from the active theme's CSS custom properties.
 * Called on the client only (ThemeAmbientLayer is 'use client').
 *
 * - primary  → --primary-color
 * - accent   → --nova-accent-border (all themes define this) or fallback to primary
 * - chrome   → --header-fg (warm/cool contrast tone for particle variety)
 */
export function readThemeParticleColors(): ThemeAmbientColors {
  const s = getComputedStyle(document.documentElement)
  const primary = s.getPropertyValue('--primary-color').trim() || '#88c0d0'
  const novaAccentBorder = s.getPropertyValue('--nova-accent-border').trim()
  const accent = novaAccentBorder || primary
  const chrome = s.getPropertyValue('--header-fg').trim() || '#ffffff'
  return { primary, accent, chrome }
}
