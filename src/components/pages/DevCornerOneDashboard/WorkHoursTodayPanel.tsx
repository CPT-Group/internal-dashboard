'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { HorizontalBarChart } from '@/components/charts';
import type { HorizontalBarChartData, BarFlashLevel } from '@/types/charts';
import { LOADING_NOVA_DATA_PLEASE_WAIT, NOVA_CORE_DEVS } from '@/constants';
import { useWorkHoursToday } from '@/hooks';
import styles from './DevCornerOneDashboard.module.scss';

interface HourThemeColors {
  successFill: string;
  warningFill: string;
  orangeFill: string;
  dangerFill: string;
  neutralFill: string;
  successBorder: string;
  warningBorder: string;
  orangeBorder: string;
  dangerBorder: string;
}

type HourZone = 'low' | 'warn' | 'good' | 'over';

const formatHours = (seconds: number): number =>
  Math.round((seconds / 3600) * 100) / 100;

function getHourZone(hours: number): HourZone {
  if (hours < 4) return 'low';
  if (hours < 6) return 'warn';
  if (hours <= 8) return 'good';
  return 'over';
}

function getBarFill(zone: HourZone, t: HourThemeColors): string {
  switch (zone) {
    case 'low':
      return t.dangerFill;
    case 'warn':
      return t.neutralFill;
    case 'good':
      return t.successFill;
    case 'over':
      return t.orangeFill;
    default:
      return t.neutralFill;
  }
}

function getBorderColor(zone: HourZone, t: HourThemeColors): string {
  switch (zone) {
    case 'low':
      return t.dangerBorder;
    case 'warn':
      return t.warningBorder;
    case 'good':
      return t.successBorder;
    case 'over':
      return t.orangeBorder;
    default:
      return t.warningBorder;
  }
}

function getFlashLevel(zone: HourZone, hours: number): BarFlashLevel {
  if (hours <= 0) return 'none';
  if (zone === 'low') return 'full';
  if (zone === 'warn' || zone === 'over') return 'full';
  return 'subtle';
}

export const WorkHoursTodayPanel = () => {
  const { hours, loading } = useWorkHoursToday();
  const [themeColors, setThemeColors] = useState<HourThemeColors | null>(null);

  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    setThemeColors({
      successFill: 'rgba(34,197,94,0.35)',
      warningFill: 'rgba(36,205,197,0.35)',
      orangeFill: 'rgba(249,115,22,0.35)',
      dangerFill: s.getPropertyValue('--chart-danger').trim() || 'rgba(239,68,68,0.78)',
      neutralFill: 'rgba(36,205,197,0.35)',
      successBorder: s.getPropertyValue('--chart-success-border').trim() || 'rgb(34,197,94)',
      warningBorder: s.getPropertyValue('--chart-warning-border').trim() || 'rgb(234,179,8)',
      orangeBorder: s.getPropertyValue('--chart-orange-border').trim() || 'rgb(249,115,22)',
      dangerBorder: s.getPropertyValue('--chart-danger-border').trim() || 'rgb(239,68,68)',
    });
  }, []);

  const members = useMemo(
    () => NOVA_CORE_DEVS.map((m) => ({
      name: m.displayName.split(' ')[0],
      hours: formatHours(hours.get(m.accountId) ?? 0),
    })).sort((a, b) => b.hours - a.hours),
    [hours]
  );

  const zoneSummary = useMemo(() => {
    return members.reduce(
      (acc, m) => {
        const zone = getHourZone(m.hours);
        if (m.hours <= 0) acc.zero += 1;
        if (zone === 'low') acc.low += 1;
        if (zone === 'good') acc.good += 1;
        if (zone === 'over') acc.over += 1;
        return acc;
      },
      { zero: 0, low: 0, good: 0, over: 0 }
    );
  }, [members]);

  const chartData: HorizontalBarChartData = useMemo(() => {
    const zones = members.map((m) => getHourZone(m.hours));

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
      colors: zones.map((z) => getBarFill(z, themeColors)),
      borderColors: zones.map((z) => getBorderColor(z, themeColors)),
      labelColors: members.map((m) => (m.hours <= 0 ? 'rgb(239,68,68)' : '')),
      suffix: 'h',
      flashLevels: zones.map((z, i) => getFlashLevel(z, members[i]?.hours ?? 0)),
    };
  }, [members, themeColors]);

  return (
    <Card className={styles.panelCard}>
      <div className={`${styles.panelHeader} ${styles.workHoursHeader}`}>
        <span>Work Hours Today</span>
        <div className={styles.workHoursBadges}>
          {zoneSummary.zero > 0 && (
            <span className={`${styles.workHoursBadge} ${styles.badgeZero}`}>Zero Hours {zoneSummary.zero}</span>
          )}
          {zoneSummary.low > 0 && (
            <span className={`${styles.workHoursBadge} ${styles.badgeDanger}`}>Low {zoneSummary.low}</span>
          )}
          {zoneSummary.good > 0 && (
            <span className={`${styles.workHoursBadge} ${styles.badgeSuccess}`}>Healthy {zoneSummary.good}</span>
          )}
          {zoneSummary.over > 0 && (
            <span className={`${styles.workHoursBadge} ${styles.badgeOver}`}>Over 8h {zoneSummary.over}</span>
          )}
        </div>
      </div>
      {loading && hours.size === 0 ? (
        <div
          className={`${styles.loadingWrap} ${styles.loadingWrapStacked}`}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <ProgressSpinner style={{ width: '2rem', height: '2rem' }} aria-hidden />
          <span className={styles.loadingPanelMessage}>{LOADING_NOVA_DATA_PLEASE_WAIT}</span>
        </div>
      ) : (
        <div className={styles.chartWrap}>
          <HorizontalBarChart data={chartData} />
        </div>
      )}
    </Card>
  );
};
