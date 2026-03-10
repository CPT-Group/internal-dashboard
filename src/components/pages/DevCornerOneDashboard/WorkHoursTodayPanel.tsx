'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { HorizontalBarChart } from '@/components/charts';
import type { HorizontalBarChartData } from '@/types/charts';
import { NOVA_CORE_DEVS } from '@/constants';
import { useWorkHoursToday } from '@/hooks';
import styles from './DevCornerOneDashboard.module.scss';

interface HourThemeColors {
  success: string;
  successBorder: string;
  warning: string;
  warningBorder: string;
  orange: string;
  orangeBorder: string;
  danger: string;
  dangerBorder: string;
}

const formatHours = (seconds: number): number =>
  Math.round((seconds / 3600) * 10) / 10;

function getBarColor(hours: number, t: HourThemeColors): { bg: string; border: string } {
  if (hours < 4) return { bg: t.danger, border: t.dangerBorder };
  if (hours < 6) return { bg: t.warning, border: t.warningBorder };
  if (hours <= 7) return { bg: t.success, border: t.successBorder };
  if (hours <= 8) return { bg: t.warning, border: t.warningBorder };
  if (hours <= 9) return { bg: t.orange, border: t.orangeBorder };
  return { bg: t.danger, border: t.dangerBorder };
}

function shouldFlash(hours: number): boolean {
  return hours > 0 && (hours < 4 || hours > 8);
}

export const WorkHoursTodayPanel = () => {
  const { hours, loading } = useWorkHoursToday();
  const [themeColors, setThemeColors] = useState<HourThemeColors | null>(null);

  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    setThemeColors({
      success: s.getPropertyValue('--chart-success').trim() || 'rgba(34,197,94,0.75)',
      successBorder: s.getPropertyValue('--chart-success-border').trim() || 'rgb(34,197,94)',
      warning: s.getPropertyValue('--chart-warning').trim() || 'rgba(234,179,8,0.75)',
      warningBorder: s.getPropertyValue('--chart-warning-border').trim() || 'rgb(234,179,8)',
      orange: s.getPropertyValue('--chart-orange').trim() || 'rgba(249,115,22,0.75)',
      orangeBorder: s.getPropertyValue('--chart-orange-border').trim() || 'rgb(249,115,22)',
      danger: s.getPropertyValue('--chart-danger').trim() || 'rgba(239,68,68,0.75)',
      dangerBorder: s.getPropertyValue('--chart-danger-border').trim() || 'rgb(239,68,68)',
    });
  }, []);

  const chartData: HorizontalBarChartData = useMemo(() => {
    const members = NOVA_CORE_DEVS.map((m) => ({
      name: m.displayName.split(' ')[0],
      hours: formatHours(hours.get(m.accountId) ?? 0),
    })).sort((a, b) => b.hours - a.hours);

    if (!themeColors) {
      return {
        labels: members.map((m) => m.name),
        values: members.map((m) => m.hours),
        suffix: 'h',
      };
    }

    const borderColors = members.map((m) => getBarColor(m.hours, themeColors).border);
    const flashIndices = members
      .map((m, i) => (shouldFlash(m.hours) ? i : -1))
      .filter((i) => i >= 0);

    return {
      labels: members.map((m) => m.name),
      values: members.map((m) => m.hours),
      borderColors,
      suffix: 'h',
      flashIndices,
    };
  }, [hours, themeColors]);

  return (
    <Card className={styles.panelCard}>
      <div className={styles.panelHeader}>Work Hours Today</div>
      {loading && hours.size === 0 ? (
        <div className={styles.loadingWrap}>
          <ProgressSpinner style={{ width: '2rem', height: '2rem' }} />
        </div>
      ) : (
        <div className={styles.chartWrap}>
          <HorizontalBarChart data={chartData} />
        </div>
      )}
    </Card>
  );
};
