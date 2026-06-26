import type { ISourceOptions } from '@tsparticles/engine'
import type { ThemeAmbientColors } from '../types'

/**
 * Embercore — rising embers.
 *
 * Orange/amber/gold motes float upward with a slow constant drift, fading in
 * and out (opacity animation) like sparks above a forge. The cursor lightly
 * ATTRACTS nearby embers — a "drawn toward heat" feel that stays subtle so it
 * never distracts from the UI. Canvas is `pointer-events: none`; interactivity
 * reads the window mouse position.
 *
 * Motion is CONSTANT by construction — see the `move` block comments and the
 * matching rationale in `frostbyteSnow.ts` (per-frame `move.drift` velocity
 * accumulation was the speed-creep bug).
 */
export function buildEmbercoreEmbersOptions(colors: ThemeAmbientColors): ISourceOptions {
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
				// softer embers than a background field so text stays readable.
				value: 60,
				density: { enable: true, width: 1920, height: 1080 },
			},
			// tsparticles v4 reads particle color from `paint.color` — the v3
			// `particles.color` key is silently ignored (the options interface's
			// index signature hides it from TS) and every particle falls back to
			// the engine default `#fff`, rendering white regardless of palette.
			paint: { color: { value: [colors.primary, colors.accent, colors.chrome] } },
			shape: { type: 'circle' },
			opacity: {
				value: { min: 0.15, max: 0.65 },
				animation: { enable: true, speed: 0.8, sync: false },
			},
			size: {
				value: { min: 1.5, max: 4.5 },
				animation: { enable: true, speed: 2, sync: false },
			},
			move: {
				enable: true,
				direction: 'top',
				// Slow ember drift. Each mote samples ONE constant speed from this
				// range at spawn; nothing below ever changes it afterwards.
				speed: { min: 0.25, max: 0.7 },
				// Lateral wander comes from the constant per-mote launch angle
				// (±10° off straight up) — NOT from `drift`, which plugin-move
				// adds to velocity.x every frame and would accelerate forever.
				angle: { offset: 0, value: 20 },
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
				onHover: { enable: true, mode: 'attract' },
				resize: { enable: true },
			},
			modes: {
				// Hover attract shifts POSITION (not velocity) in tsparticles 4.x,
				// so it cannot accumulate speed. maxSpeed clamps the per-frame pull
				// (engine default is 50 — a harsh snap toward the cursor).
				attract: { distance: 140, duration: 0.4, factor: 1.5, speed: 0.6, maxSpeed: 3 },
			},
		},
	}
}
