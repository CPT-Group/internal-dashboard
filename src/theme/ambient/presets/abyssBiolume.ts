import type { ISourceOptions } from '@tsparticles/engine'
import type { ThemeAmbientColors } from '../types'

/**
 * Abyss — deep-ocean bioluminescence.
 *
 * Tiny teal/cyan plankton motes rise slowly through the water column, pulsing
 * opacity like breathing. The cursor lightly ATTRACTS nearby motes — plankton
 * drawn to a diver's light — with a tight maxSpeed cap so the pull stays
 * dreamy, never snappy. Cooler, slower, and smaller than Embercore's embers.
 *
 * Motion is CONSTANT by construction — see `frostbyteSnow.ts` for the full
 * drift/decay rationale.
 */
export function buildAbyssBiolumeOptions(colors: ThemeAmbientColors): ISourceOptions {
	return {
		fullScreen: { enable: false },
		detectRetina: true,
		fpsLimit: 60,
		pauseOnBlur: true,
		pauseOnOutsideViewport: true,
		background: { color: { value: 'transparent' } },
		particles: {
			number: {
				value: 55,
				density: { enable: true, width: 1920, height: 1080 },
			},
			paint: { color: { value: [colors.primary, colors.accent, colors.chrome] } },
			shape: { type: 'circle' },
			opacity: {
				// Slow breathing pulse — the bioluminescent glow.
				value: { min: 0.1, max: 0.6 },
				animation: { enable: true, speed: 0.4, sync: false },
			},
			size: {
				value: { min: 1, max: 2.5 },
				animation: { enable: true, speed: 0.8, sync: false },
			},
			move: {
				enable: true,
				direction: 'top',
				// Slower than embers (0.25–0.7) — deep water resistance. ONE
				// constant speed per mote, sampled at spawn.
				speed: { min: 0.15, max: 0.45 },
				// Lateral wander from the constant per-mote launch angle (±12°
				// off straight up) — NOT from `drift` (see frostbyteSnow.ts).
				angle: { offset: 0, value: 24 },
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
				onHover: { enable: true, mode: 'attract' },
				resize: { enable: true },
			},
			modes: {
				// Position-based attract (cannot accumulate speed); maxSpeed 2.5
				// keeps the "fish to light" pull slower than Embercore's 3.
				attract: { distance: 130, duration: 0.4, factor: 1.2, speed: 0.5, maxSpeed: 2.5 },
			},
		},
	}
}
