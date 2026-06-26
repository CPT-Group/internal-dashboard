import type { ISourceOptions } from '@tsparticles/engine'
import type { ThemeAmbientColors } from '../types'

/**
 * Midas — gold dust with a click burst.
 *
 * Bank-vault restraint: ~22 near-invisible specks of gold dust settle slowly
 * downward and twinkle. No hover effect at all — the single indulgence is a
 * CLICK burst: each click pushes 6 extra gold specks at the pointer (slim's
 * external-push interaction). Pushed specks inherit the base dust options
 * (gold paint, slow fall, twinkle) and `number.limit` (delete mode, scaled by
 * density like the base count) caps the total so bursts never accumulate.
 *
 * Motion is CONSTANT by construction — see `frostbyteSnow.ts` for the full
 * drift/decay rationale.
 */
export function buildMidasDustOptions(colors: ThemeAmbientColors): ISourceOptions {
	return {
		fullScreen: { enable: false },
		detectRetina: true,
		fpsLimit: 60,
		pauseOnBlur: true,
		pauseOnOutsideViewport: true,
		background: { color: { value: 'transparent' } },
		particles: {
			number: {
				// Ultra-sparse — luxury is what you almost don't see.
				value: 22,
				density: { enable: true, width: 1920, height: 1080 },
				// Hard ceiling for click bursts. The engine multiplies this by
				// the same density factor as `value`, so it scales with viewport
				// and always leaves headroom above the base count.
				limit: { mode: 'delete', value: 60 },
			},
			paint: { color: { value: [colors.primary, colors.accent, colors.chrome] } },
			shape: { type: 'circle' },
			opacity: {
				// Glint-twinkle between near-invisible and a soft shimmer.
				value: { min: 0.1, max: 0.6 },
				animation: { enable: true, speed: 1, sync: false },
			},
			size: {
				value: { min: 0.6, max: 1.8 },
				animation: { enable: true, speed: 1, sync: false },
			},
			move: {
				enable: true,
				direction: 'bottom',
				// Dust settling. ONE constant speed per speck.
				speed: { min: 0.15, max: 0.4 },
				// Faint scatter from the constant per-speck launch angle (±10°
				// off straight down) — NOT from `drift` (see frostbyteSnow.ts).
				angle: { offset: 0, value: 20 },
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
				// No hover mode — understatement is the theme. Click-only.
				onClick: { enable: true, mode: 'push' },
				resize: { enable: true },
			},
			modes: {
				// Small burst; the number.limit above is the accumulation guard.
				push: { quantity: 6 },
			},
		},
	}
}
