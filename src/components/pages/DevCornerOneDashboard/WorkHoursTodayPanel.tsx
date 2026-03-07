'use client';

import { useMemo } from 'react';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { HorizontalBarChart } from '@/components/charts';
import type { HorizontalBarChartData } from '@/types/charts';
import { NOVA_CORE_DEVS } from '@/constants';
import { useWorkHoursToday } from '@/hooks';
import styles from './DevCornerOneDashboard.module.scss';

const formatHours = (seconds: number): number =>
  Math.round((seconds / 3600) * 10) / 10;

export const WorkHoursTodayPanel = () => {
  const { hours, loading } = useWorkHoursToday();

  const chartData: HorizontalBarChartData = useMemo(() => {
    const members = NOVA_CORE_DEVS.map((m) => ({
      name: m.displayName.split(' ')[0],
      hours: formatHours(hours.get(m.accountId) ?? 0),
    })).sort((a, b) => b.hours - a.hours);

    return {
      labels: members.map((m) => m.name),
      values: members.map((m) => m.hours),
    };
  }, [hours]);

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
