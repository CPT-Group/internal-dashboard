import type { ISourceOptions } from '@tsparticles/engine'
import type { ThemeAmbientColors } from '../types'

/**
 * Tempest — wind-slanted rain.
 *
 * Thin line streaks fall fast at a constant ~25° wind slant in sky blue /
 * indigo / pale slate. The line shape (loaded by `loadSlim`) renders via
 * STROKE only, so `paint.stroke.width` is required; `rotate.path: true`
 * aligns each streak with its own velocity vector so the slant always
 * matches the fall direction. The cursor REPULSES nearby drops.
 *
 * Faster than the other presets (1.5–3) for the rain feel, but still
 * CONSTANT by construction — each drop samples one speed at spawn and no
 * per-frame velocity source (drift/gravity/vibrate) ever changes it. See
 * `frostbyteSnow.ts` for the drift-accumulation rationale.
 */
export function buildTempestRainOptions(colors: ThemeAmbientColors): ISourceOptions {
	return {
		fullScreen: { enable: false },
		detectRetina: true,
		fpsLimit: 60,
		pauseOnBlur: true,
		pauseOnOutsideViewport: true,
		background: { color: { value: 'transparent' } },
		particles: {
			number: {
				value: 120,
				density: { enable: true, width: 1920, height: 1080 },
			},
			// Pale slate is hardcoded: the palette's chrome slot is Tempest's
			// lightning gold (#facc15) — gold rain reads as Midas, not a storm.
			// #cbd5e1 is the theme's slate-200 rain-on-thundercloud tone.
			paint: {
				color: { value: [colors.primary, colors.accent, '#cbd5e1'] },
				// Line shapes have no fill path — stroke is the visible streak.
				stroke: { width: 1 },
			},
			shape: { type: 'line' },
			opacity: {
				// Rain does not twinkle — constant per-drop alpha for streak look.
				value: { min: 0.15, max: 0.45 },
			},
			size: {
				// Line "size" is the half-length: 3–6 → 6–12px streaks.
				value: { min: 3, max: 6 },
			},
			// Align each streak with its own velocity vector (the line shape
			// draws horizontally by default; path rotation adds velocity.angle).
			rotate: { path: true },
			move: {
				enable: true,
				direction: 'bottom',
				// Rain speed — faster than snow/embers but each drop still
				// samples ONE constant speed at spawn.
				speed: { min: 1.5, max: 3 },
				// Wind slant: offset tilts the whole fall ~25° off vertical and
				// the ±5° value adds gust variance — constant per drop, NOT
				// `drift` (per-frame velocity accumulator, see frostbyteSnow.ts).
				angle: { offset: 25, value: 10 },
				decay: 0,
				gravity: { enable: false },
				random: false,
				straight: false,
				vibrate: false,
				outModes: { default: 'out' },
			},
		},
		interactivity: {
			detectsOn: 'window',
			events: {
				onHover: { enable: true, mode: 'repulse' },
				resize: { enable: true },
			},
			modes: {
				// Position-based repulse; maxSpeed caps the per-frame push.
				repulse: { distance: 100, duration: 0.4, speed: 0.4, factor: 10, maxSpeed: 6 },
			},
		},
	}
}
