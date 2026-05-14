'use client';

/**
 * PrimeReact `Chart` dynamically imports `chart.js/auto` when no global `Chart` exists.
 * Under Next.js Turbopack + HMR, that async chunk can fail after tab/toggle re-renders (ChunkLoadError).
 * Eagerly register once on `globalThis` so Prime uses synchronous init.
 */
import Chart from 'chart.js/auto';

type ChartConstructor = typeof Chart;

const g = globalThis as typeof globalThis & { Chart?: ChartConstructor };

if (g.Chart === undefined) {
  g.Chart = Chart;
}

export {};
