import type { ISourceOptions } from '@tsparticles/engine'
import type { ThemeAmbientColors } from '../types'

/**
 * Tundra — sparse arctic flurry.
 *
 * Distinct from Frostbyte's snowfall: roughly half the flakes, slower fall,
 * a much wider wind sway, Nord frost-blue/sage tones instead of white/cyan,
 * and NO frost overlay. The cursor gently REPULSES nearby flakes.
 *
 * Motion is CONSTANT by construction — see `frostbyteSnow.ts` for the full
 * drift/decay rationale.
 */
export function buildTundraFlurryOptions(colors: ThemeAmbientColors): ISourceOptions {
	return {
		fullScreen: { enable: false },
		detectRetina: true,
		fpsLimit: 60,
		pauseOnBlur: true,
		pauseOnOutsideViewport: true,
		background: { color: { value: 'transparent' } },
		particles: {
			number: {
				// Sparser than Frostbyte's 85 — open-plain flurry, not a storm.
				value: 45,
				density: { enable: true, width: 1920, height: 1080 },
			},
			// Sage is hardcoded: Tundra keeps its Nord green in the palette's
			// `success` slot (#a3be8c), which `ThemeAmbientColors` does not
			// carry — and the chrome slot duplicates primary (#88c0d0).
			paint: { color: { value: [colors.primary, colors.accent, '#a3be8c'] } },
			shape: { type: 'circle' },
			opacity: {
				value: { min: 0.25, max: 0.6 },
				animation: { enable: true, speed: 0.4, sync: false },
			},
			size: {
				value: { min: 1, max: 3 },
				animation: { enable: true, speed: 1, sync: false },
			},
			move: {
				enable: true,
				direction: 'bottom',
				// Slower than Frostbyte (0.3–0.8). ONE constant speed per flake.
				speed: { min: 0.2, max: 0.5 },
				// Wide wind sway from the constant per-flake launch angle (±25°
				// vs Frostbyte's ±15°) — NOT from `drift` (see frostbyteSnow.ts).
				angle: { offset: 0, value: 50 },
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
				repulse: { distance: 90, duration: 0.4, speed: 0.3, factor: 8, maxSpeed: 4 },
			},
		},
	}
}
