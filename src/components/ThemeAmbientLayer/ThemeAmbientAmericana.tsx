'use client';

import type { CSSProperties, JSX } from 'react';

/**
 * All American ambient layer — pure CSS/SVG, no particle engine. Three elements:
 *
 * 1. A drifting field of twinkling 5-point stars (red / white / blue), gently
 *    swaying as a group so the sky feels alive without a seamless-tile scroll.
 * 2. A few larger stars that rise from the bottom — the directional motion.
 * 3. Fireworks: four burst origins whose sparks fly out from center, flash, then
 *    fade with a slight gravity droop. Bursts land ~every 24 s (staggered).
 *
 * Colors come from CSS vars (`--aa-*`) scoped per theme in theme-ambient.scss, so
 * the light and dark variants each get tuned tones. Concrete hex/rgba only — NO
 * color-mix() — for Samsung Tizen TV compatibility. All animation is transform +
 * opacity (mix-blend-mode: screen on the dark variant is the one post-2022 CSS
 * feature; it degrades to normal compositing on old Tizen, still legible).
 * Rendered inside `.app-ambient-overlay` (z-index 900, pointer-events: none).
 */

type StarColor = 'red' | 'white' | 'blue';

interface FieldStar {
  readonly cx: number;
  readonly cy: number;
  readonly s: number;
  readonly color: StarColor;
  readonly delay: number;
  readonly dur: number;
}

interface RisingStar {
  readonly cx: number;
  readonly s: number;
  readonly color: StarColor;
  readonly delay: number;
  readonly dur: number;
}

interface Firework {
  readonly cx: number;
  readonly cy: number;
  readonly color: StarColor;
  readonly delay: number;
  readonly dur: number;
  readonly radius: number;
  readonly spokes: number;
}

const COLOR_CYCLE: readonly StarColor[] = ['red', 'white', 'blue'];

const FIELD_STARS: readonly FieldStar[] = [
  [70, 90], [180, 190], [300, 70], [430, 150], [560, 60], [690, 130],
  [820, 80], [950, 170], [1080, 60], [1210, 140], [1340, 90], [120, 300],
  [260, 380], [400, 300], [540, 400], [680, 320], [820, 400], [960, 320],
  [1100, 390], [1250, 310], [1380, 400], [60, 520], [220, 560], [360, 500],
  [500, 590], [640, 520], [780, 600], [920, 520], [1060, 590], [1200, 520],
  [1330, 580], [150, 700], [340, 690], [520, 720], [700, 680], [880, 720],
  [1050, 690], [1240, 710],
].map(([cx, cy], i) => ({
  cx,
  cy,
  s: 0.45 + ((i * 7) % 9) / 12,
  color: COLOR_CYCLE[i % 3],
  delay: -((i * 0.83) % 6),
  dur: 3.2 + ((i * 5) % 7) * 0.4,
}));

const RISING_STARS: readonly RisingStar[] = [
  { cx: 240, s: 1.6, color: 'red', delay: 0, dur: 23 },
  { cx: 560, s: 1.2, color: 'white', delay: -6, dur: 26 },
  { cx: 830, s: 1.9, color: 'blue', delay: -12, dur: 21 },
  { cx: 1120, s: 1.3, color: 'red', delay: -4, dur: 25 },
  { cx: 1330, s: 1.5, color: 'blue', delay: -16, dur: 24 },
];

// Shared 96 s cycle, evenly staggered by 24 s → one burst about every 24 s.
const FW_CYCLE = 96;
const FIREWORKS: readonly Firework[] = [
  { cx: 300, cy: 240, color: 'red', delay: 0, dur: FW_CYCLE, radius: 78, spokes: 16 },
  { cx: 1080, cy: 200, color: 'blue', delay: -24, dur: FW_CYCLE, radius: 92, spokes: 18 },
  { cx: 720, cy: 140, color: 'white', delay: -48, dur: FW_CYCLE, radius: 84, spokes: 16 },
  { cx: 520, cy: 320, color: 'red', delay: -72, dur: FW_CYCLE, radius: 70, spokes: 14 },
];

const STAR_PATH =
  'M0,-10 L2.939,-4.045 L9.511,-3.09 L4.755,1.545 L5.878,8.09 ' +
  'L0,5 L-5.878,8.09 L-4.755,1.545 L-9.511,-3.09 L-2.939,-4.045 Z';

function spokeEnds(count: number, radius: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
  });
}

export function ThemeAmbientAmericana(): JSX.Element {
  return (
    <>
      <svg
        className="app-ambient-overlay__americana-stars"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <path id="aa-star" d={STAR_PATH} />
        </defs>

        <g className="aa-starfield">
          {FIELD_STARS.map((st, i) => (
            <use
              key={`f${i}`}
              href="#aa-star"
              className={`aa-star aa-star--${st.color}`}
              transform={`translate(${st.cx} ${st.cy}) scale(${st.s})`}
              style={{ animationDelay: `${st.delay}s`, animationDuration: `${st.dur}s` } as CSSProperties}
            />
          ))}
        </g>

        <g className="aa-rising">
          {RISING_STARS.map((st, i) => (
            <g
              key={`r${i}`}
              className="aa-riser"
              style={{ animationDelay: `${st.delay}s`, animationDuration: `${st.dur}s` } as CSSProperties}
            >
              <use
                href="#aa-star"
                className={`aa-star--${st.color}`}
                transform={`translate(${st.cx} 980) scale(${st.s})`}
              />
            </g>
          ))}
        </g>
      </svg>

      <svg
        className="app-ambient-overlay__americana-fw"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {FIREWORKS.map((fw, i) => (
          <g
            key={`fw${i}`}
            className={`aa-fw aa-fw--${fw.color}`}
            transform={`translate(${fw.cx} ${fw.cy})`}
            style={{ '--aa-dur': `${fw.dur}s`, '--aa-delay': `${fw.delay}s` } as CSSProperties}
          >
            <g className="aa-fw__burst">
              {spokeEnds(fw.spokes, fw.radius).map((p, j) => (
                <g key={`s${j}`}>
                  <line className="aa-fw__trail" x1={p.x * 0.35} y1={p.y * 0.35} x2={p.x} y2={p.y} />
                  <circle className="aa-fw__spark" cx={p.x} cy={p.y} r={2.4} />
                </g>
              ))}
            </g>
            <circle className="aa-fw__core" cx={0} cy={0} r={6} />
          </g>
        ))}
      </svg>
    </>
  );
}
