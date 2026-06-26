import type { ISourceOptions } from '@tsparticles/engine'
import type { ThemeAmbientColors } from '../types'

/**
 * Arcane — rising spell sparks.
 *
 * Small violet/rose/gold sparks rise and twinkle hard (fast, wide opacity
 * animation) like motes of spellfire. The cursor ATTRACTS sparks — magic
 * drawn to the caster's hand — with the same capped pull as Embercore.
 *
 * Motion is CONSTANT by construction — see `frostbyteSnow.ts` for the full
 * drift/decay rationale.
 */
export function buildArcaneSparksOptions(colors: ThemeAmbientColors): ISourceOptions {
	return {
		fullScreen: { enable: false },
		detectRetina: true,
		fpsLimit: 60,
		pauseOnBlur: true,
		pauseOnOutsideViewport: true,
		background: { color: { value: 'transparent' } },
		particles: {
			number: {
				value: 70,
				density: { enable: true, width: 1920, height: 1080 },
			},
			// Gold is hardcoded: the palette trio is violet/rose/lilac (chrome
			// #c084fc sits too close to primary) and the spell-spark contrast
			// hue lives in the palette's `warn` slot (#facc15), which
			// `ThemeAmbientColors` does not carry.
			paint: { color: { value: [colors.primary, colors.accent, '#facc15'] } },
			shape: { type: 'circle' },
			opacity: {
				// Hard twinkle — sparks flare and vanish.
				value: { min: 0.05, max: 0.8 },
				animation: { enable: true, speed: 1.5, sync: false },
			},
			size: {
				value: { min: 0.8, max: 2.5 },
				animation: { enable: true, speed: 2, sync: false },
			},
			move: {
				enable: true,
				direction: 'top',
				// Ember-like rise. ONE constant speed per spark.
				speed: { min: 0.3, max: 0.8 },
				// Flutter from the constant per-spark launch angle (±15° off
				// straight up) — NOT from `drift` (see frostbyteSnow.ts).
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
				onHover: { enable: true, mode: 'attract' },
				resize: { enable: true },
			},
			modes: {
				// Position-based attract; maxSpeed caps the per-frame pull.
				attract: { distance: 140, duration: 0.4, factor: 1.5, speed: 0.6, maxSpeed: 3 },
			},
		},
	}
}
