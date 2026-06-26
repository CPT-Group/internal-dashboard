import type { ISourceOptions } from '@tsparticles/engine'
import type { ThemeAmbientColors } from '../types'

/**
 * Frostbyte — interactive snowfall.
 *
 * White/cyan flakes fall with a gentle diagonal sway and twinkle (size +
 * opacity oscillation). The cursor REPULSES nearby flakes so the snow "parts"
 * around the pointer. Density scales the count with viewport area; the canvas
 * is `pointer-events: none` and interactivity reads the window mouse position.
 *
 * Motion is CONSTANT by construction — see the `move` block comments. The
 * tsparticles move plugin adds `move.drift` to `velocity.x` every frame and
 * only `move.decay` bleeds velocity back off, so a non-zero drift with the
 * default decay (0) accelerates particles forever. We keep every per-frame
 * velocity source off (drift/gravity/vibrate/path) instead of fighting them
 * with decay, which would also bleed the base falling speed to zero.
 */
export function buildFrostbyteSnowOptions(colors: ThemeAmbientColors): ISourceOptions {
	return {
		fullScreen: { enable: false },
		detectRetina: true,
		fpsLimit: 60,
		pauseOnBlur: true,
		pauseOnOutsideViewport: true,
		background: { color: { value: 'transparent' } },
		particles: {
			number: {
				// Rendered as an overlay above the app surfaces — slightly fewer,
				// softer flakes than a background field so text stays readable.
				value: 85,
				density: { enable: true, width: 1920, height: 1080 },
			},
			// tsparticles v4 reads particle color from `paint.color` — see the
			// matching comment in `embercoreEmbers.ts`. White-first masked the
			// dead v3 `color` key here (default fallback is also white).
			paint: { color: { value: ['#ffffff', colors.primary, colors.accent] } },
			shape: { type: 'circle' },
			opacity: {
				value: { min: 0.3, max: 0.7 },
				animation: { enable: true, speed: 0.5, sync: false },
			},
			size: {
				value: { min: 1, max: 3.5 },
				animation: { enable: true, speed: 1.5, sync: false },
			},
			move: {
				enable: true,
				direction: 'bottom',
				// Lazy snowfall. Each flake samples ONE constant speed from this
				// range at spawn; nothing below ever changes it afterwards.
				speed: { min: 0.3, max: 0.8 },
				// Lateral sway comes from the constant per-flake launch angle
				// (±15° off straight down) — NOT from `drift`, which plugin-move
				// adds to velocity.x every frame and would accelerate forever.
				angle: { offset: 0, value: 30 },
				// decay 0 + no per-frame velocity sources = constant velocity.
				// A positive decay would bleed the base falling speed to zero.
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
				// Hover repulse shifts POSITION (not velocity) in tsparticles 4.x,
				// so it cannot accumulate speed. speed * factor caps the per-frame
				// push near the cursor; maxSpeed clamps it (engine default is 50,
				// which made the snow violently part around the pointer).
				repulse: { distance: 110, duration: 0.4, speed: 0.4, factor: 10, maxSpeed: 6 },
			},
		},
	}
}
