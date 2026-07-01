'use client';

import type { CSSProperties, JSX } from 'react';

/**
 * All American ambient layer — pure CSS/SVG, no particle engine. Two elements:
 *
 * 1. A dense tiled star wallpaper (`.app-ambient-overlay__americana-stars`, styled
 *    in theme-ambient.scss) — a repeating red/white/blue star tile drifting
 *    diagonally in a seamless loop, the same mechanism as the Barbie hearts.
 * 2. Fireworks: six burst origins whose sparks fly out from center, flash, then
 *    fade with a slight gravity droop. Shared 66 s cycle staggered by 11 s → a big
 *    burst about every 11 s. Colors cycle red → white → blue.
 *
 * Colors come from CSS vars (`--aa-*`) scoped per theme. Concrete hex/rgba only —
 * no color-mix() — for Tizen TV. mix-blend-mode: screen (dark fireworks) degrades
 * to normal compositing on pre-2022 Tizen. Rendered inside `.app-ambient-overlay`
 * (z-index 900, pointer-events: none).
 */

type StarColor = 'red' | 'white' | 'blue';

interface Firework {
  readonly cx: number;
  readonly cy: number;
  readonly color: StarColor;
  readonly delay: number;
  readonly dur: number;
  readonly radius: number;
  readonly spokes: number;
}

const FW_CYCLE = 66;
const FIREWORKS: readonly Firework[] = [
  { cx: 280, cy: 220, color: 'red', delay: 0, dur: FW_CYCLE, radius: 120, spokes: 22 },
  { cx: 560, cy: 150, color: 'white', delay: -11, dur: FW_CYCLE, radius: 100, spokes: 18 },
  { cx: 860, cy: 250, color: 'blue', delay: -22, dur: FW_CYCLE, radius: 135, spokes: 24 },
  { cx: 1120, cy: 180, color: 'red', delay: -33, dur: FW_CYCLE, radius: 96, spokes: 18 },
  { cx: 700, cy: 330, color: 'blue', delay: -44, dur: FW_CYCLE, radius: 112, spokes: 20 },
  { cx: 1300, cy: 290, color: 'white', delay: -55, dur: FW_CYCLE, radius: 90, spokes: 16 },
];

function spokeEnds(count: number, radius: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
  });
}

export function ThemeAmbientAmericana(): JSX.Element {
  return (
    <>
      {/* Dense drifting star wallpaper — all styling (tile + drift) is in CSS. */}
      <div className="app-ambient-overlay__americana-stars" aria-hidden="true" />

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
                  <circle className="aa-fw__spark" cx={p.x} cy={p.y} r={3} />
                </g>
              ))}
            </g>
            <circle className="aa-fw__core" cx={0} cy={0} r={8} />
          </g>
        ))}
      </svg>
    </>
  );
}
