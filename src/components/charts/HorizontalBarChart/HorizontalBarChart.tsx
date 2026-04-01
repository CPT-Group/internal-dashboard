'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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

const BORDER_WIDTH = 3.5;
const TICK_MS = 80;
const STEP = 0.06;

function parseRGB(color: string): [number, number, number] | null {
  const m = color.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

function rgbaStr(rgb: [number, number, number], a: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(2)})`;
}

function drawHazardTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  const h = size * 0.9;
  const half = size / 2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x - half, y + h * 0.6);
  ctx.lineTo(x + half, y + h * 0.6);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(x - 1, y - h * 0.38, 2, h * 0.7);
  ctx.fillRect(x - 1.2, y + h * 0.36, 2.4, 2.4);
  ctx.restore();
}

/**
 * Horizontal bar chart with themed per-bar border colors, smooth pulsing
 * glow animation (per-bar flash levels), and optional suffix on data labels.
 */
export const HorizontalBarChart = ({ data }: HorizontalBarChartProps) => {
  const [theme, setTheme] = useState<ChartTheme | null>(null);
  const chartRef = useRef<Chart>(null);
  const phaseRef = useRef(0);
  const dirRef = useRef(1);

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
    () => (data.flashLevels ?? []).some((l) => l !== 'none') || data.values.some((v) => v <= 0),
    [data.flashLevels, data.values]
  );

  const applyFlash = useCallback(() => {
    const chart = chartRef.current?.getChart();
    if (!chart) return;
    const ds = chart.data.datasets[0];
    const levels = data.flashLevels;
    const borders = data.borderColors;
    if (!ds || !levels?.length || !borders?.length) return;

    phaseRef.current += STEP * dirRef.current;
    if (phaseRef.current >= 1) { phaseRef.current = 1; dirRef.current = -1; }
    if (phaseRef.current <= 0) { phaseRef.current = 0; dirRef.current = 1; }
    const f = phaseRef.current;

    const newFills: string[] = [];
    const newBorders: string[] = [];
    const newWidths: number[] = [];
    const hasCustomColors = Array.isArray(data.colors) && data.colors.length === borders.length;
    const baseFills = hasCustomColors
      ? data.colors as string[]
      : Array.from({ length: borders.length }, () => theme?.barPrimary ?? 'rgba(36,205,197,0.82)');

    for (let i = 0; i < borders.length; i++) {
      const level = levels[i];
      const fillRgb = parseRGB(baseFills[i]);
      const rgb = parseRGB(borders[i]);

      if (!rgb) {
        newFills.push(baseFills[i]);
        newBorders.push(borders[i]);
        newWidths.push(BORDER_WIDTH);
        continue;
      }

      if (level === 'none' || !fillRgb) {
        newFills.push(baseFills[i]);
        newBorders.push(borders[i]);
        newWidths.push(BORDER_WIDTH);
        continue;
      }

      if (level === 'full') {
        newFills.push(rgbaStr(fillRgb, 0.45 + 0.5 * f));
        newBorders.push(rgbaStr(rgb, 0.1 + 0.9 * f));
        newWidths.push(BORDER_WIDTH + 1.1 * f);
      } else {
        newFills.push(rgbaStr(fillRgb, 0.35 + 0.55 * f));
        newBorders.push(rgbaStr(rgb, 0.2 + 0.75 * f));
        newWidths.push(BORDER_WIDTH + 1.0 * f);
      }
    }

    ds.backgroundColor = newFills;
    ds.borderColor = newBorders;
    ds.borderWidth = newWidths;

    const ctx: CanvasRenderingContext2D = chart.ctx;
    chart.update('none');

    const meta = chart.getDatasetMeta(0);
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      if (level === 'none') continue;
      const bar = meta.data[i];
      if (!bar) continue;
      const rgb = parseRGB(borders[i]);
      if (!rgb) continue;

      const maxBlur = level === 'full' ? 14 : 5;
      const blur = maxBlur * f;
      if (blur < 0.5) continue;

      const props = bar.getProps(['x', 'y', 'width', 'height', 'base'], true);
      const bx = props.base ?? 0;
      const bw = (props.x ?? 0) - bx;
      const by = (props.y ?? 0) - (props.height ?? 0) / 2;
      const bh = props.height ?? 0;
      if (bw <= 0 || bh <= 0) continue;

      ctx.save();
      ctx.shadowColor = rgbaStr(rgb, 0.7 * f);
      ctx.shadowBlur = blur;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rgbaStr(rgb, 0.4 * f);
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 3);
      ctx.stroke();
      ctx.restore();

      // Subtle animated gradient sheen so bar bodies feel alive on TV.
      const shimmerWidth = Math.max(18, bw * 0.26);
      const shimmerX = bx + (bw + shimmerWidth) * f - shimmerWidth;
      const shimmer = ctx.createLinearGradient(shimmerX, by, shimmerX + shimmerWidth, by);
      shimmer.addColorStop(0, 'rgba(255,255,255,0)');
      shimmer.addColorStop(0.5, level === 'full' ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.22)');
      shimmer.addColorStop(1, 'rgba(255,255,255,0)');

      const surgeWidth = Math.max(20, bw * 0.34);
      const surgeX = bx + (bw + surgeWidth) * ((f + 0.35) % 1) - surgeWidth;
      const surge = ctx.createLinearGradient(surgeX, by, surgeX + surgeWidth, by);
      surge.addColorStop(0, 'rgba(0,0,0,0)');
      surge.addColorStop(0.5, level === 'full' ? rgbaStr(rgb, 0.3) : rgbaStr(rgb, 0.24));
      surge.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.save();
      ctx.fillStyle = shimmer;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 3);
      ctx.clip();
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = surge;
      ctx.fillRect(bx, by, bw, bh);
      ctx.restore();

      // Red/full bars get a blinking hazard icon near the bar end.
      if (level === 'full' && f > 0.55) {
        const iconX = (props.x ?? 0) - 10;
        const iconY = props.y ?? 0;
        drawHazardTriangle(ctx, iconX, iconY, 10, rgbaStr(rgb, 0.95));
      }
    }
  }, [data.flashLevels, data.borderColors, data.colors, theme?.barPrimary]);

  useEffect(() => {
    if (!hasAnimation) return;
    const id = setInterval(applyFlash, TICK_MS);
    return () => clearInterval(id);
  }, [hasAnimation, applyFlash]);

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
                ticks: {
                  color: (ctx: { index?: number }) => {
                    const idx = ctx.index ?? 0;
                    const explicit = data.labelColors?.[idx];
                    if (explicit && explicit.trim()) {
                      const rgb = parseRGB(explicit);
                      if (!rgb) return explicit;
                      const pulse = 0.45 + 0.55 * phaseRef.current;
                      return rgbaStr(rgb, pulse);
                    }

                    if ((data.values[idx] ?? 0) <= 0) {
                      const pulse = 0.45 + 0.55 * phaseRef.current;
                      return `rgba(239,68,68,${pulse.toFixed(2)})`;
                    }

                    return theme.text;
                  },
                },
              },
            },
          }
        : null,
    [theme, suffix, data.labelColors, data.values]
  );

  if (!options || data.labels.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <Chart
        ref={chartRef}
        type="bar"
        data={chartData}
        options={options}
        plugins={[ChartDataLabels]}
        className={styles.chart}
      />
    </div>
  );
};
