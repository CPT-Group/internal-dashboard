'use client';

import { useMemo } from 'react';
import { Chart } from 'primereact/chart';

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

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '78%',
      animation: { duration: 600 },
      plugins: {
        legend: {
          position: 'right' as const,
          labels: {
            boxWidth: 12,
            padding: 6,
            font: { size: 11 },
            color: 'var(--p-text-color)',
            usePointStyle: true,
          },
        },
        tooltip: { enabled: true },
      },
    }),
    []
  );

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: `${height}px` }}
    >
      <Chart type="doughnut" data={chartData} options={options} style={{ height: `${height}px` }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>
          {centerValue}
        </span>
        {centerLabel != null && centerLabel !== '' && (
          <span
            className="text-color-secondary"
            style={{ fontSize: '0.75rem', marginTop: '2px' }}
          >
            {centerLabel}
          </span>
        )}
      </div>
    </div>
  );
}
