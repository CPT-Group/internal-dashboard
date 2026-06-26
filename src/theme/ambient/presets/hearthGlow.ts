import type { ISourceOptions } from '@tsparticles/engine'
import type { ThemeAmbientColors } from '../types'

/**
 * Hearth — lazy fireside glow.
 *
 * Deliberately DIFFERENT from Embercore: far fewer, larger, softer amber and
 * orange motes float up at a crawl with a slow size pulse — fireflies dozing
 * by the fireplace rather than sparks racing off a forge. A barely-there
 * cursor repulse keeps the working area calm.
 *
 * Motion is CONSTANT by construction — see `frostbyteSnow.ts` for the full
 * drift/decay rationale.
 */
export function buildHearthGlowOptions(colors: ThemeAmbientColors): ISourceOptions {
	return {
		fullScreen: { enable: false },
		detectRetina: true,
		fpsLimit: 60,
		pauseOnBlur: true,
		pauseOnOutsideViewport: true,
		background: { color: { value: 'transparent' } },
		particles: {
			number: {
				// Very low — a handful of fireflies, not an ember column.
				value: 35,
				density: { enable: true, width: 1920, height: 1080 },
			},
			// Two-tone on purpose: Hearth's chrome slot duplicates primary
			// (#fabd2f), and Gruvbox amber + orange alone carry the fireside.
			paint: { color: { value: [colors.primary, colors.accent] } },
			shape: { type: 'circle' },
			opacity: {
				value: { min: 0.1, max: 0.5 },
				animation: { enable: true, speed: 0.4, sync: false },
			},
			size: {
				// Larger and softer than Embercore's 1.5–4.5, with a slow pulse.
				value: { min: 2.5, max: 6 },
				animation: { enable: true, speed: 0.8, sync: false },
			},
			move: {
				enable: true,
				direction: 'top',
				// Lazy float — the slowest rising preset. ONE constant speed per
				// mote, sampled at spawn.
				speed: { min: 0.1, max: 0.3 },
				// Drowsy wander from the constant per-mote launch angle (±15°
				// off straight up) — NOT from `drift` (see frostbyteSnow.ts).
				angle: { offset: 0, value: 30 },
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
				// Barely-there position-based repulse; maxSpeed caps the push.
				repulse: { distance: 80, duration: 0.4, speed: 0.2, factor: 6, maxSpeed: 3 },
			},
		},
	}
}
