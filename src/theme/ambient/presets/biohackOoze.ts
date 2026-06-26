import type { ISourceOptions } from '@tsparticles/engine'
import type { ThemeAmbientColors } from '../types'

/**
 * Biohack — phosphor ooze bubbles.
 *
 * Goopy green motes rise VERY slowly like gas bubbles through biowaste, with
 * a strong size pulse (grow/shrink reads gloopy) and a wide opacity range so
 * some blobs glow hot while others barely surface. Occasional larger blobs
 * (size up to 6). The cursor attracts bubbles only faintly — sluggish ooze,
 * not eager fish — with a tight maxSpeed cap.
 *
 * Motion is CONSTANT by construction — see `frostbyteSnow.ts` for the full
 * drift/decay rationale.
 */
export function buildBiohackOozeOptions(colors: ThemeAmbientColors): ISourceOptions {
	return {
		fullScreen: { enable: false },
		detectRetina: true,
		fpsLimit: 60,
		pauseOnBlur: true,
		pauseOnOutsideViewport: true,
		background: { color: { value: 'transparent' } },
		particles: {
			number: {
				value: 50,
				density: { enable: true, width: 1920, height: 1080 },
			},
			// Lime is hardcoded: Biohack's chrome slot duplicates primary
			// (#00ff88), so the third hue comes from the palette's `warn` lime
			// (#bef264), which `ThemeAmbientColors` does not carry.
			paint: { color: { value: [colors.primary, colors.accent, '#bef264'] } },
			shape: { type: 'circle' },
			opacity: {
				// Wide variance — hot phosphor blobs next to barely-lit ones.
				value: { min: 0.1, max: 0.7 },
				animation: { enable: true, speed: 1, sync: false },
			},
			size: {
				// 2–6 with a fast pulse — the grow/shrink is the gloop.
				value: { min: 2, max: 6 },
				animation: { enable: true, speed: 3, sync: false },
			},
			move: {
				enable: true,
				direction: 'top',
				// Ooze-slow rise. ONE constant speed per bubble.
				speed: { min: 0.1, max: 0.35 },
				// Wobble from the constant per-bubble launch angle (±10° off
				// straight up) — NOT from `drift` (see frostbyteSnow.ts).
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
				onHover: { enable: true, mode: 'attract' },
				resize: { enable: true },
			},
			modes: {
				// Very weak position-based attract — ooze barely reacts; maxSpeed
				// 2 keeps the pull below Abyss's 2.5 and Embercore's 3.
				attract: { distance: 110, duration: 0.4, factor: 0.8, speed: 0.4, maxSpeed: 2 },
			},
		},
	}
}
