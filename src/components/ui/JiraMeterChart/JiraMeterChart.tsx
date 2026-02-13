'use client';

import { useMemo } from 'react';
import { Chart } from 'primereact/chart';
import styles from './JiraMeterChart.module.scss';

function getThemeTextColor(): string {
  if (typeof document === 'undefined') return '#e5e7eb';
  const s = getComputedStyle(document.documentElement);
  return (
    s.getPropertyValue('--p-text-color').trim() ||
    s.getPropertyValue('--text-color').trim() ||
    '#e5e7eb'
  );
}

const DEFAULT_COLORS = [
  'rgba(59, 130, 246, 0.82)',
  'rgba(168, 85, 247, 0.82)',
  'rgba(34, 197, 94, 0.82)',
  'rgba(234, 179, 8, 0.82)',
  'rgba(236, 72, 153, 0.82)',
  'rgba(20, 184, 166, 0.82)',
  'rgba(249, 115, 22, 0.82)',
  'rgba(99, 102, 241, 0.82)',
];

export interface JiraMeterChartProps {
  /** Main number shown in the center (e.g. total open). */
  centerValue: number;
  /** Optional label under the number (e.g. "Open"). */
  centerLabel?: string;
  /** Segment labels (e.g. assignee names). */
  labels: string[];
  /** Segment values (same order as labels). */
  data: number[];
  /** Bar/segment colors (optional). */
  colors?: string[];
  /** Chart height in px. */
  height?: number;
  /** Legend position: 'right' (default) or 'bottom'. Use 'bottom' when center text must sit in the donut (e.g. Trevor Distribution). */
  legendPosition?: 'right' | 'bottom';
  /** Optional class for the wrapper. */
  className?: string;
}

/**
 * Meter-style chart: doughnut ring (by assignee/project/type) with a single main number in the center.
 * Use for "total open" or "total done" with distribution around it.
 */
export function JiraMeterChart({
  centerValue,
  centerLabel,
  labels,
  data,
  colors = DEFAULT_COLORS,
  height = 200,
  legendPosition = 'right',
  className,
}: JiraMeterChartProps) {
  const chartData = useMemo(() => {
    const segmentColors = labels.map((_, i) => colors[i % colors.length]);
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: segmentColors,
          borderColor: segmentColors.map((c) => c.replace('0.82', '1').replace('0.78', '1')),
          borderWidth: 2,
          hoverBorderWidth: 3,
        },
      ],
    };
  }, [labels, data, colors]);

  const legendColor = useMemo(() => getThemeTextColor(), []);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '78%',
      animation: { duration: 600 },
      layout: { padding: 0 },
      plugins: {
        legend: {
          position: legendPosition as 'right' | 'bottom',
          labels: {
            boxWidth: 12,
            padding: 6,
            font: { size: 11 },
            color: legendColor,
            usePointStyle: true,
          },
        },
        tooltip: { enabled: true },
      },
    }),
    [legendColor, legendPosition]
  );

  const containerStyle =
    height !== 200
      ? ({ ['--chart-meter-height' as string]: `${height}px` } as React.CSSProperties)
      : undefined;

  const containerClass = [styles.container, className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={containerClass} style={containerStyle}>
      <Chart type="doughnut" data={chartData} options={options} />
      <div className={[styles.center, legendPosition === 'bottom' && styles.legendBottom].filter(Boolean).join(' ')}>
        <span className={styles.centerValue}>{centerValue}</span>
        {centerLabel != null && centerLabel !== '' && (
          <span className={styles.centerLabel}>{centerLabel}</span>
        )}
      </div>
    </div>
  );
}
