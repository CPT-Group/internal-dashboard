'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Chart } from 'primereact/chart';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import type { Plugin } from 'chart.js';
import type { HorizontalBarChartData, BarFlashLevel } from '@/types/charts';
import { useTheme } from '@/providers/ThemeProvider';
import styles from './HorizontalBarChart.module.scss';

export interface HorizontalBarChartProps {
  data: HorizontalBarChartData;
}

interface ChartTheme {
  text: string;
  grid: string;
  surfaceCard: string;
  barPrimary: string;
  barPrimaryBorder: string;
  labelColor: string;
}

interface MarkerScale {
  left: number;
  right: number;
  getPixelForValue: (value: number) => number;
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

/**
 * Rounded rect for legacy WebKit / older Tizen browsers without `ctx.roundRect`.
 */
function pathRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** Multi-stripe plaid drawn in Canvas (no CSS) for 110%+ target tiers on TV. */
function drawPlaidOverlay(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  phase01: number,
  pulse: number
): void {
  if (bw <= 0 || bh <= 0) return;
  const redStep = 14;
  const greenStep = 13;
  // Keep motion as clear left-to-right x-axis travel on TV.
  const redShiftX = phase01 * redStep;
  const greenShiftX = phase01 * greenStep;
  const darkBandShiftX = phase01 * 8;
  const redAlpha = (0.42 + 0.22 * pulse).toFixed(2);
  const greenAlpha = (0.38 + 0.2 * pulse).toFixed(2);
  const darkAlpha = (0.12 + 0.1 * pulse).toFixed(2);
  ctx.save();
  pathRoundedRect(ctx, bx, by, bw, bh, 3);
  ctx.clip();
  // Dark tint underlay keeps cross-stripes readable on bright fill colors.
  ctx.fillStyle = `rgba(40, 15, 15, ${(0.14 + 0.08 * pulse).toFixed(2)})`;
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = `rgba(24, 53, 31, ${(0.1 + 0.06 * pulse).toFixed(2)})`;
  ctx.fillRect(bx, by, bw, bh);
  // Diagonal red family.
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(196, 48, 48, ${redAlpha})`;
  for (let k = -bh - redStep + redShiftX; k < bw + bh; k += redStep) {
    ctx.beginPath();
    ctx.moveTo(bx + k, by);
    ctx.lineTo(bx + k + bh, by + bh);
    ctx.stroke();
  }
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = `rgba(255, 140, 140, ${(0.26 + 0.2 * pulse).toFixed(2)})`;
  for (let k = -bh - redStep + redShiftX + 4; k < bw + bh; k += redStep) {
    ctx.beginPath();
    ctx.moveTo(bx + k, by);
    ctx.lineTo(bx + k + bh, by + bh);
    ctx.stroke();
  }

  // Opposite diagonal green family.
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = `rgba(40, 136, 72, ${greenAlpha})`;
  for (let k = -bh - greenStep + greenShiftX; k < bw + bh; k += greenStep) {
    ctx.beginPath();
    ctx.moveTo(bx + k, by + bh);
    ctx.lineTo(bx + k + bh, by);
    ctx.stroke();
  }
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = `rgba(143, 227, 152, ${(0.24 + 0.18 * pulse).toFixed(2)})`;
  for (let k = -bh - greenStep + greenShiftX + 3; k < bw + bh; k += greenStep) {
    ctx.beginPath();
    ctx.moveTo(bx + k, by + bh);
    ctx.lineTo(bx + k + bh, by);
    ctx.stroke();
  }

  // Dark accent bands reinforce a woven plaid feel without noisy flicker.
  ctx.fillStyle = `rgba(18, 11, 11, ${darkAlpha})`;
  const vBandStep = 11;
  for (
    let x = bx - vBandStep + (darkBandShiftX % vBandStep);
    x < bx + bw;
    x += vBandStep
  ) {
    ctx.fillRect(x, by, 1.2, bh);
  }
  const hBandStep = 7;
  for (let y = by - hBandStep; y < by + bh; y += hBandStep) {
    ctx.fillRect(bx, y, bw, 0.9);
  }
  ctx.restore();
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

function pulseForPhase01(phase01: number): number {
  return 0.5 - 0.5 * Math.cos(phase01 * Math.PI * 2);
}

function speedForLevel(level: BarFlashLevel): number {
  switch (level) {
    case 'full':
      return 1.9;
    case 'intense':
      return 1.5;
    case 'medium':
      return 1.25;
    case 'subtle':
      return 1.05;
    default:
      return 1;
  }
}

interface FlashProfile {
  fillMin: number;
  fillRange: number;
  borderMin: number;
  borderRange: number;
  widthBoost: number;
  maxBlur: number;
  shimmerPeak: number;
  surgePeak: number;
}

function profileForLevel(level: BarFlashLevel): FlashProfile {
  switch (level) {
    case 'full':
      return {
        fillMin: 0.5,
        fillRange: 0.5,
        borderMin: 0.25,
        borderRange: 0.75,
        widthBoost: 1.6,
        maxBlur: 16,
        shimmerPeak: 0.32,
        surgePeak: 0.38,
      };
    case 'intense':
      return {
        fillMin: 0.46,
        fillRange: 0.52,
        borderMin: 0.28,
        borderRange: 0.72,
        widthBoost: 1.35,
        maxBlur: 13,
        shimmerPeak: 0.3,
        surgePeak: 0.34,
      };
    case 'medium':
      return {
        fillMin: 0.42,
        fillRange: 0.46,
        borderMin: 0.24,
        borderRange: 0.62,
        widthBoost: 1.05,
        maxBlur: 10,
        shimmerPeak: 0.26,
        surgePeak: 0.28,
      };
    case 'subtle':
      return {
        fillMin: 0.34,
        fillRange: 0.34,
        borderMin: 0.16,
        borderRange: 0.42,
        widthBoost: 0.55,
        maxBlur: 6,
        shimmerPeak: 0.18,
        surgePeak: 0.18,
      };
    default:
      return {
        fillMin: 0.35,
        fillRange: 0.2,
        borderMin: 0.2,
        borderRange: 0.2,
        widthBoost: 0,
        maxBlur: 4,
        shimmerPeak: 0.12,
        surgePeak: 0.12,
      };
  }
}

/**
 * Horizontal bar chart with themed per-bar border colors, smooth pulsing
 * glow animation (per-bar flash levels), and optional suffix on data labels.
 */
export const HorizontalBarChart = ({ data }: HorizontalBarChartProps) => {
  const { theme: activeTheme } = useTheme();
  const [theme, setTheme] = useState<ChartTheme | null>(null);
  const chartRef = useRef<Chart>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    const s = getComputedStyle(root);
    setTheme({
      text: s.getPropertyValue('--text-color').trim() || '#e2e8f0',
      grid: s.getPropertyValue('--surface-border').trim() || 'rgba(255,255,255,0.1)',
      surfaceCard: s.getPropertyValue('--surface-card').trim() || 'rgba(12, 0, 32, 0.92)',
      barPrimary: s.getPropertyValue('--chart-bar-primary').trim() || 'rgba(36,205,197,0.82)',
      barPrimaryBorder: s.getPropertyValue('--chart-bar-primary-border').trim() || 'rgb(36,205,197)',
      labelColor: s.getPropertyValue('--chart-label-color').trim() || '#ffffff',
    });
  }, [activeTheme]);

  const hasAnimation = useMemo(
    () =>
      (data.flashLevels ?? []).some((l) => l !== 'none') ||
      data.values.some((v) => v <= 0) ||
      (data.plaidOverlay?.some(Boolean) ?? false),
    [data.flashLevels, data.plaidOverlay, data.values]
  );

  const applyFlash = useCallback(() => {
    const chart = chartRef.current?.getChart();
    if (!chart) return;
    const ds = chart.data.datasets[0];
    if (!ds) return;

    const levels = data.flashLevels ?? [];
    const borders = data.borderColors ?? [];
    const plaidFlags = data.plaidOverlay ?? [];

    phaseRef.current += STEP;
    if (phaseRef.current > 1) phaseRef.current -= 1;
    const globalPhase = phaseRef.current;

    if (levels.length > 0 && borders.length > 0) {
      const newFills: string[] = [];
      const newBorders: string[] = [];
      const newWidths: number[] = [];
      const hasCustomColors = Array.isArray(data.colors) && data.colors.length === borders.length;
      const baseFills = hasCustomColors
        ? data.colors as string[]
        : Array.from({ length: borders.length }, () => theme?.barPrimary ?? 'rgba(36,205,197,0.82)');

      for (let i = 0; i < borders.length; i++) {
        const level = levels[i] ?? 'none';
        const fillRgb = parseRGB(baseFills[i]);
        const rgb = parseRGB(borders[i]);
        const sweep = (globalPhase * speedForLevel(level)) % 1;
        const pulse = pulseForPhase01(sweep);
        const profile = profileForLevel(level);

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

        newFills.push(rgbaStr(fillRgb, profile.fillMin + profile.fillRange * pulse));
        newBorders.push(rgbaStr(rgb, profile.borderMin + profile.borderRange * pulse));
        newWidths.push(BORDER_WIDTH + profile.widthBoost * pulse);
      }

      ds.backgroundColor = newFills;
      ds.borderColor = newBorders;
      ds.borderWidth = newWidths;
    }

    chart.update('none');
  }, [data.flashLevels, data.borderColors, data.colors, data.plaidOverlay, theme?.barPrimary]);

  const animatedOverlayPlugin = useMemo<Plugin<'bar'>>(
    () => ({
      id: 'horizontal-bar-animated-overlay',
      afterDatasetsDraw: (chart) => {
        const levels = data.flashLevels ?? [];
        const borders = data.borderColors ?? [];
        const plaidFlags = data.plaidOverlay ?? [];
        const globalPhase = phaseRef.current;
        const ctx: CanvasRenderingContext2D = chart.ctx;
        const meta = chart.getDatasetMeta(0);

        for (let i = 0; i < meta.data.length; i++) {
          const bar = meta.data[i];
          if (!bar) continue;

          const props = bar.getProps(['x', 'y', 'width', 'height', 'base'], true);
          const bx = props.base ?? 0;
          const bw = (props.x ?? 0) - bx;
          const by = (props.y ?? 0) - (props.height ?? 0) / 2;
          const bh = props.height ?? 0;
          if (bw <= 0 || bh <= 0) continue;

          const level = levels[i] ?? 'none';
          const plaidLevel = level === 'none' ? 'full' : level;
          const plaidSweep = (globalPhase * speedForLevel(plaidLevel)) % 1;
          // Keep plaid visibly present in static moments, not only at pulse peaks.
          const plaidPulse = 0.6 + 0.4 * pulseForPhase01(plaidSweep);
          if (plaidFlags[i]) {
            drawPlaidOverlay(ctx, bx, by, bw, bh, plaidSweep, plaidPulse);
          }

          if (level === 'none') continue;
          const rgb = parseRGB(borders[i]);
          if (!rgb) continue;

          const sweep = (globalPhase * speedForLevel(level)) % 1;
          const pulse = pulseForPhase01(sweep);
          const profile = profileForLevel(level);
          const blur = profile.maxBlur * pulse;

          if (blur >= 0.5) {
            ctx.save();
            ctx.shadowColor = rgbaStr(rgb, 0.75 * pulse);
            ctx.shadowBlur = blur;
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = rgbaStr(rgb, 0.45 * pulse);
            pathRoundedRect(ctx, bx, by, bw, bh, 3);
            ctx.stroke();
            ctx.restore();

            // Subtle animated gradient sheen so bar bodies feel alive on TV.
            const shimmerWidth = Math.max(20, bw * 0.34);
            const shimmerX = bx + (bw + shimmerWidth) * sweep - shimmerWidth;
            const shimmer = ctx.createLinearGradient(
              shimmerX,
              by,
              shimmerX + shimmerWidth,
              by
            );
            shimmer.addColorStop(0, 'rgba(255,255,255,0)');
            shimmer.addColorStop(
              0.5,
              `rgba(255,255,255,${(profile.shimmerPeak * pulse).toFixed(2)})`
            );
            shimmer.addColorStop(1, 'rgba(255,255,255,0)');

            const surgeWidth = Math.max(22, bw * 0.4);
            const surgeX = bx + (bw + surgeWidth) * ((sweep + 0.35) % 1) - surgeWidth;
            const surge = ctx.createLinearGradient(surgeX, by, surgeX + surgeWidth, by);
            surge.addColorStop(0, 'rgba(0,0,0,0)');
            surge.addColorStop(0.5, rgbaStr(rgb, profile.surgePeak * pulse));
            surge.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.save();
            ctx.fillStyle = shimmer;
            pathRoundedRect(ctx, bx, by, bw, bh, 3);
            ctx.clip();
            ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = surge;
            ctx.fillRect(bx, by, bw, bh);
            ctx.restore();
          }

          // Red/full bars get a blinking hazard icon near the bar end.
          if (level === 'full' && pulse > 0.55) {
            const iconX = (props.x ?? 0) - 10;
            const iconY = props.y ?? 0;
            drawHazardTriangle(ctx, iconX, iconY, 10, rgbaStr(rgb, 0.95));
          }
        }
      },
    }),
    [data.flashLevels, data.borderColors, data.plaidOverlay]
  );

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
  const xMax = useMemo(() => {
    const valuesMax = data.values.length > 0 ? Math.max(...data.values) : 0;
    const markerMax = data.targetMarker?.value ?? 0;
    const base = Math.max(valuesMax, markerMax, 1);
    return Math.ceil((base + 0.5) * 2) / 2;
  }, [data.values, data.targetMarker?.value]);

  const targetMarkerPlugin = useMemo<Plugin<'bar'>>(
    () => ({
      id: 'horizontal-bar-target-marker',
      beforeDatasetsDraw: (chart) => {
        const marker = data.targetMarker;
        if (!marker) return;

        const rawScale = chart.scales.x;
        if (!rawScale) return;
        const scale = rawScale as MarkerScale;
        const x = scale.getPixelForValue(marker.value);
        if (x < scale.left || x > scale.right) return;

        const ctx: CanvasRenderingContext2D = chart.ctx;
        const color = marker.color ?? theme?.barPrimaryBorder ?? 'rgb(34, 211, 238)';
        const label = marker.label ?? '';

        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(x, chart.chartArea.top + 1);
        ctx.lineTo(x, chart.chartArea.bottom - 1);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.restore();
      },

      afterDatasetsDraw: (chart) => {
        const marker = data.targetMarker;
        if (!marker) return;

        const rawScale = chart.scales.x;
        if (!rawScale) return;
        const scale = rawScale as MarkerScale;
        const x = scale.getPixelForValue(marker.value);
        if (x < scale.left || x > scale.right) return;

        const ctx: CanvasRenderingContext2D = chart.ctx;
        const color = marker.color ?? theme?.barPrimaryBorder ?? 'rgb(34, 211, 238)';
        const label = marker.label ?? '';

        if (label) {
          ctx.save();
          ctx.font = '700 11px Lato, Helvetica, sans-serif';
          const textWidth = ctx.measureText(label).width;
          const padX = 6;
          const textHeight = 14;
          const bx = Math.min(
            Math.max(x - textWidth / 2 - padX, chart.chartArea.left + 2),
            chart.chartArea.right - (textWidth + padX * 2) - 2
          );
          const by = chart.chartArea.bottom - textHeight - 2;

          ctx.fillStyle = theme?.surfaceCard ?? 'rgba(12, 0, 32, 0.92)';
          ctx.fillRect(bx, by, textWidth + padX * 2, textHeight);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.strokeRect(bx, by, textWidth + padX * 2, textHeight);
          ctx.fillStyle = color;
          ctx.fillText(label, bx + padX, by + 11);
          ctx.restore();
        }
      },
    }),
    [data.targetMarker, theme?.barPrimaryBorder, theme?.surfaceCard]
  );

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
                max: xMax,
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
    [theme, suffix, data.labelColors, data.values, xMax]
  );

  if (!options || data.labels.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <Chart
        ref={chartRef}
        type="bar"
        data={chartData}
        options={options}
        plugins={[animatedOverlayPlugin, ChartDataLabels, targetMarkerPlugin]}
        className={styles.chart}
      />
    </div>
  );
};
