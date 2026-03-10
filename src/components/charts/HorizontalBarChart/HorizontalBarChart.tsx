'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart } from 'primereact/chart';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import type { HorizontalBarChartData, BarFlashLevel } from '@/types/charts';
import styles from './HorizontalBarChart.module.scss';

export interface HorizontalBarChartProps {
  data: HorizontalBarChartData;
}

interface ChartTheme {
  text: string;
  grid: string;
  barPrimary: string;
  barPrimaryBorder: string;
  labelColor: string;
}

const BORDER_WIDTH = 4;
const CYCLE_SPEED = 0.0025;
const GLOW_FULL_MAX = 12;
const GLOW_SUBTLE_MAX = 5;

function lerpColor(color: string, factor: number): string {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return color;
  const [r, g, b] = [+m[1], +m[2], +m[3]];
  return `rgba(${r},${g},${b},${(0.3 + 0.7 * factor).toFixed(2)})`;
}

/**
 * Horizontal bar chart with themed per-bar border colors, smooth pulsing
 * glow animation (per-bar flash levels), and optional "h" suffix labels.
 */
export const HorizontalBarChart = ({ data }: HorizontalBarChartProps) => {
  const [theme, setTheme] = useState<ChartTheme | null>(null);
  const chartRef = useRef<Chart>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef(0);
  const levelsRef = useRef<BarFlashLevel[]>([]);
  const bordersRef = useRef<string[]>([]);

  useEffect(() => {
    levelsRef.current = data.flashLevels ?? [];
    bordersRef.current = data.borderColors ?? [];
  }, [data.flashLevels, data.borderColors]);

  useEffect(() => {
    const root = document.documentElement;
    const s = getComputedStyle(root);
    setTheme({
      text: s.getPropertyValue('--text-color').trim() || '#e2e8f0',
      grid: s.getPropertyValue('--surface-border').trim() || 'rgba(255,255,255,0.1)',
      barPrimary: s.getPropertyValue('--chart-bar-primary').trim() || 'rgba(36,205,197,0.82)',
      barPrimaryBorder: s.getPropertyValue('--chart-bar-primary-border').trim() || 'rgb(36,205,197)',
      labelColor: s.getPropertyValue('--chart-label-color').trim() || '#ffffff',
    });
  }, []);

  const hasAnimation = useMemo(
    () => (data.flashLevels ?? []).some((l) => l !== 'none'),
    [data.flashLevels]
  );

  const glowPlugin = useMemo(() => ({
    id: 'barGlow',
    beforeDatasetDraw(chart: { ctx: CanvasRenderingContext2D; getDatasetMeta: (i: number) => { data: { options: { borderColor: string } }[] } }) {
      const levels = levelsRef.current;
      if (!levels.length) return;
      const factor = (Math.sin(phaseRef.current) + 1) / 2;
      const meta = chart.getDatasetMeta(0);
      const ctx = chart.ctx;
      ctx.save();
      for (let i = 0; i < levels.length; i++) {
        const level = levels[i];
        if (level === 'none') continue;
        const bar = meta.data[i];
        if (!bar) continue;
        const color = bar.options?.borderColor ?? bordersRef.current[i] ?? 'transparent';
        if (color === 'transparent') continue;
        const maxBlur = level === 'full' ? GLOW_FULL_MAX : GLOW_SUBTLE_MAX;
        ctx.shadowColor = color;
        ctx.shadowBlur = maxBlur * factor;
      }
    },
    afterDatasetDraw(chart: { ctx: CanvasRenderingContext2D }) {
      chart.ctx.restore();
    },
  }), []);

  useEffect(() => {
    if (!hasAnimation) return;

    let lastTime = performance.now();
    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      phaseRef.current += dt * CYCLE_SPEED;

      const chart = chartRef.current?.getChart();
      if (chart) {
        const levels = levelsRef.current;
        const borders = bordersRef.current;
        const ds = chart.data.datasets[0];
        if (ds && levels.length && borders.length) {
          const factor = (Math.sin(phaseRef.current) + 1) / 2;
          ds.borderColor = borders.map((c, i) => {
            const level = levels[i];
            if (level === 'none' || level === 'subtle') return c;
            return lerpColor(c, factor);
          });
        }
        chart.update('none');
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [hasAnimation]);

  const chartData = useMemo(() => {
    const hasCustomColors = data.colors && data.colors.length === data.values.length;
    const hasCustomBorders = data.borderColors && data.borderColors.length === data.values.length;
    return {
      labels: data.labels,
      datasets: [
        {
          label: data.labels.length ? 'Count' : '',
          data: data.values,
          backgroundColor: hasCustomColors ? data.colors : theme?.barPrimary ?? 'rgba(36,205,197,0.82)',
          borderColor: hasCustomBorders
            ? data.borderColors
            : hasCustomColors
              ? data.colors!.map((c) => c.replace(/0\.\d+\)/, '1)'))
              : theme?.barPrimaryBorder ?? 'rgb(36,205,197)',
          borderWidth: hasCustomBorders ? BORDER_WIDTH : 1,
          borderRadius: 3,
        },
      ],
    };
  }, [data, theme]);

  const suffix = data.suffix ?? '';

  const options = useMemo(
    () =>
      theme
        ? {
            indexAxis: 'y' as const,
            responsive: true,
            maintainAspectRatio: false,
            animation: false as const,
            plugins: {
              legend: { display: false },
              datalabels: {
                display: (ctx: { dataset: { data: number[] }; dataIndex: number }) =>
                  (ctx.dataset.data[ctx.dataIndex] ?? 0) > 0,
                anchor: 'end' as const,
                align: 'start' as const,
                offset: 4,
                color: theme.labelColor,
                textStrokeColor: 'rgba(80, 20, 120, 0.75)',
                textStrokeWidth: 3,
                font: { weight: 'bold' as const, size: 13 },
                formatter: (value: number) => (value > 0 ? `${value}${suffix}` : ''),
              },
            },
            scales: {
              x: {
                beginAtZero: true,
                grid: { color: theme.grid },
                ticks: { color: theme.text },
              },
              y: {
                grid: { display: false },
                ticks: { color: theme.text },
              },
            },
          }
        : null,
    [theme, suffix]
  );

  if (!options || data.labels.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <Chart
        ref={chartRef}
        type="bar"
        data={chartData}
        options={options}
        plugins={[ChartDataLabels, glowPlugin]}
        className={styles.chart}
      />
    </div>
  );
};
