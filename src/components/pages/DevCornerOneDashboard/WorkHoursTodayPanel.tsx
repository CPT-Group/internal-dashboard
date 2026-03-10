'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { HorizontalBarChart } from '@/components/charts';
import type { HorizontalBarChartData, BarFlashLevel } from '@/types/charts';
import { NOVA_CORE_DEVS } from '@/constants';
import { useWorkHoursToday } from '@/hooks';
import styles from './DevCornerOneDashboard.module.scss';

interface HourThemeColors {
  successBorder: string;
  warningBorder: string;
  orangeBorder: string;
  dangerBorder: string;
}

const formatHours = (seconds: number): number =>
  Math.round((seconds / 3600) * 10) / 10;

function getBorderColor(hours: number, t: HourThemeColors): string {
  if (hours < 4) return t.dangerBorder;
  if (hours < 6) return t.warningBorder;
  if (hours <= 7) return t.successBorder;
  if (hours <= 8) return t.warningBorder;
  if (hours <= 9) return t.orangeBorder;
  return t.dangerBorder;
}

function getFlashLevel(hours: number): BarFlashLevel {
  if (hours <= 0) return 'none';
  if (hours < 4) return 'full';
  if (hours < 6) return 'subtle';
  if (hours <= 7) return 'none';
  if (hours <= 8) return 'subtle';
  if (hours <= 9) return 'full';
  return 'full';
}

export const WorkHoursTodayPanel = () => {
  const { hours, loading } = useWorkHoursToday();
  const [themeColors, setThemeColors] = useState<HourThemeColors | null>(null);

  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    setThemeColors({
      successBorder: s.getPropertyValue('--chart-success-border').trim() || 'rgb(34,197,94)',
      warningBorder: s.getPropertyValue('--chart-warning-border').trim() || 'rgb(234,179,8)',
      orangeBorder: s.getPropertyValue('--chart-orange-border').trim() || 'rgb(249,115,22)',
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

    return {
      labels: members.map((m) => m.name),
      values: members.map((m) => m.hours),
      borderColors: members.map((m) => getBorderColor(m.hours, themeColors)),
      suffix: 'h',
      flashLevels: members.map((m) => getFlashLevel(m.hours)),
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
