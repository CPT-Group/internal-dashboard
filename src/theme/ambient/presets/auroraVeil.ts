import type { ISourceOptions } from '@tsparticles/engine'
import type { ThemeAmbientColors } from '../types'

/**
 * Aurora — northern-lights motes.
 *
 * Emerald/cyan/violet points drift slowly SIDEWAYS across the viewport like
 * curtains of light sliding along the horizon, twinkling in and out (opacity
 * animation). The cursor gently REPULSES nearby motes. Pairs with the
 * 'aurora-glow' static overlay (green/violet sky washes at the top corners).
 *
 * Motion is CONSTANT by construction — see `frostbyteSnow.ts` for the full
 * rationale (per-frame `move.drift` velocity accumulation was the
 * speed-creep bug; every per-frame velocity source stays off here too).
 */
export function buildAuroraVeilOptions(colors: ThemeAmbientColors): ISourceOptions {
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
			// Violet is hardcoded: the palette trio (primary emerald, accent
			// cyan, chrome teal) cannot express the aurora's purple band — the
			// theme keeps it in `info`/backdrop gradients (#c084fc), which
			// `ThemeAmbientColors` does not carry.
			paint: { color: { value: [colors.primary, colors.accent, '#c084fc'] } },
			shape: { type: 'circle' },
			opacity: {
				value: { min: 0.1, max: 0.55 },
				animation: { enable: true, speed: 0.6, sync: false },
			},
			size: {
				value: { min: 1, max: 3 },
				animation: { enable: true, speed: 1, sync: false },
			},
			move: {
				enable: true,
				direction: 'right',
				// Curtain glide. Each mote samples ONE constant speed at spawn;
				// nothing below ever changes it afterwards.
				speed: { min: 0.15, max: 0.45 },
				// Vertical shimmer comes from the constant per-mote launch angle
				// (±20° off horizontal) — NOT from `drift` (per-frame velocity
				// accumulator, see frostbyteSnow.ts).
				angle: { offset: 0, value: 40 },
				// decay 0 + no per-frame velocity sources = constant velocity.
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
				// Position-based repulse (cannot accumulate speed); maxSpeed caps
				// the per-frame push (engine default is a violent 50).
				repulse: { distance: 100, duration: 0.4, speed: 0.3, factor: 8, maxSpeed: 4 },
			},
		},
	}
}
