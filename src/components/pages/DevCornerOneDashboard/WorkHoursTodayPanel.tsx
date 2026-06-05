'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { HorizontalBarChart } from '@/components/charts';
import type { HorizontalBarChartData } from '@/types/charts';
import { LOADING_NOVA_DATA_PLEASE_WAIT, NOVA_CORE_DEVS } from '@/constants';
import { useTheme } from '@/providers/ThemeProvider';
import {
  getCurrentTargetHours,
  getWorkHoursBarBorder,
  getWorkHoursBarFill,
  getWorkHoursFlashLevel,
  getWorkHoursZone,
} from '@/utils/workHoursRollingTarget';
import type { WorkHoursChartTheme } from '@/utils/workHoursRollingTarget';
import styles from './DevCornerOneDashboard.module.scss';

interface HourThemeColors extends WorkHoursChartTheme {
  orangeFill: string;
  aheadFill: string;
  orangeBorder: string;
  aheadBorder: string;
  markerColor: string;
}

const formatHours = (seconds: number): number =>
  Math.round((seconds / 3600) * 100) / 100;

export interface WorkHoursTodayPanelProps {
  hours: Map<string, number>;
  loading: boolean;
}

export const WorkHoursTodayPanel = ({ hours, loading }: WorkHoursTodayPanelProps) => {
  const { theme } = useTheme();
  const [themeColors, setThemeColors] = useState<HourThemeColors | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    const readToken = (name: string, fallback: string): string => {
      const value = s.getPropertyValue(name).trim();
      return value || fallback;
    };
    setThemeColors({
      successFill: readToken('--work-hours-success-fill', 'rgba(34,197,94,0.35)'),
      warningFill: readToken('--work-hours-warning-fill', 'rgba(234,179,8,0.35)'),
      orangeFill: readToken('--work-hours-orange-fill', 'rgba(249,115,22,0.35)'),
      aheadFill: readToken('--work-hours-ahead-fill', 'rgba(36,205,197,0.35)'),
      superFill: readToken('--work-hours-super-fill', 'rgba(34,211,238,0.45)'),
      dangerFill: readToken('--work-hours-danger-fill', 'rgba(239,68,68,0.78)'),
      neutralFill: readToken('--work-hours-neutral-fill', 'rgba(36,205,197,0.35)'),
      successBorder: readToken('--chart-success-border', 'rgb(34,197,94)'),
      warningBorder: readToken('--chart-warning-border', 'rgb(234,179,8)'),
      orangeBorder: readToken('--chart-orange-border', 'rgb(249,115,22)'),
      aheadBorder: readToken('--chart-bar-primary-border', 'rgb(36,205,197)'),
      superBorder: readToken('--work-hours-super-border', 'rgb(34,211,238)'),
      dangerBorder: readToken('--chart-danger-border', 'rgb(239,68,68)'),
      markerColor: readToken('--work-hours-target-line-color', readToken('--primary-color', 'rgb(36,205,197)')),
    });
  }, [theme]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const targetHours = useMemo(() => getCurrentTargetHours(now), [now]);

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
        const zone = getWorkHoursZone(m.hours, targetHours);
        if (m.hours <= 0) acc.zero += 1;
        if (zone === 'critical') acc.critical += 1;
        if (zone === 'onTrack') acc.onTrack += 1;
        if (zone === 'overTarget' || zone === 'plaid') acc.atOrAboveTarget += 1;
        return acc;
      },
      { zero: 0, critical: 0, onTrack: 0, atOrAboveTarget: 0 }
    );
  }, [members, targetHours]);

  const chartData: HorizontalBarChartData = useMemo(() => {
    const zones = members.map((m) => getWorkHoursZone(m.hours, targetHours));

    if (!themeColors) {
      return {
        labels: members.map((m) => m.name),
        values: members.map((m) => m.hours),
        targetMarker: {
          value: targetHours,
          label: `Target ${targetHours.toFixed(1)}h`,
        },
        suffix: 'h',
      };
    }

    return {
      labels: members.map((m) => m.name),
      values: members.map((m) => m.hours),
      colors: zones.map((z) => getWorkHoursBarFill(z, themeColors)),
      borderColors: zones.map((z) => getWorkHoursBarBorder(z, themeColors)),
      labelColors: members.map((m) => (m.hours <= 0 ? themeColors.dangerBorder : '')),
      targetMarker: {
        value: targetHours,
        color: themeColors.markerColor,
        label: `Target ${targetHours.toFixed(1)}h`,
      },
      suffix: 'h',
      flashLevels: zones.map((z, i) => getWorkHoursFlashLevel(z, members[i]?.hours ?? 0)),
      plaidOverlay: zones.map((z) => z === 'plaid'),
    };
  }, [members, targetHours, themeColors]);

  return (
    <Card className={styles.panelCard}>
      <div className={`${styles.panelHeader} ${styles.workHoursHeader}`}>
        <span>Work Hours Today</span>
        <div className={styles.workHoursBadges}>
          {zoneSummary.zero > 0 && (
            <span className={`${styles.workHoursBadge} ${styles.badgeZero}`}>Zero Hours {zoneSummary.zero}</span>
          )}
          {zoneSummary.critical > 0 && (
            <span className={`${styles.workHoursBadge} ${styles.badgeDanger}`}>Under 50% {zoneSummary.critical}</span>
          )}
          {zoneSummary.onTrack > 0 && (
            <span className={`${styles.workHoursBadge} ${styles.badgeSuccess}`}>75-100% {zoneSummary.onTrack}</span>
          )}
          {zoneSummary.atOrAboveTarget > 0 && (
            <span className={`${styles.workHoursBadge} ${styles.badgeSuper}`}>
              ≥100% target {zoneSummary.atOrAboveTarget}
            </span>
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
