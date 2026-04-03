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
  aheadFill: string;
  superFill: string;
  dangerFill: string;
  neutralFill: string;
  successBorder: string;
  warningBorder: string;
  orangeBorder: string;
  aheadBorder: string;
  superBorder: string;
  dangerBorder: string;
  markerColor: string;
}

type HourZone = 'critical' | 'warn' | 'onTrack' | 'ahead' | 'high' | 'super';

const formatHours = (seconds: number): number =>
  Math.round((seconds / 3600) * 100) / 100;

function getCurrentTargetHours(now: Date): number {
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const startMinutes = 9 * 60;
  const endMinutes = 17 * 60;

  if (minutesNow <= startMinutes) return 0.1;
  if (minutesNow >= endMinutes) return 8;
  return Math.max(0.1, (minutesNow - startMinutes) / 60);
}

function getHourZone(hours: number, targetHours: number): HourZone {
  const ratio = targetHours > 0 ? hours / targetHours : Number.POSITIVE_INFINITY;
  if (ratio <= 0.5) return 'critical';
  if (ratio <= 0.75) return 'warn';
  if (ratio <= 1) return 'onTrack';
  if (ratio <= 1.25) return 'ahead';
  if (ratio <= 1.5) return 'high';
  return 'super';
}

function getBarFill(zone: HourZone, t: HourThemeColors): string {
  switch (zone) {
    case 'critical':
      return t.dangerFill;
    case 'warn':
      return t.warningFill;
    case 'onTrack':
      return t.successFill;
    case 'ahead':
      return t.aheadFill;
    case 'high':
      return t.orangeFill;
    case 'super':
      return t.superFill;
    default:
      return t.neutralFill;
  }
}

function getBorderColor(zone: HourZone, t: HourThemeColors): string {
  switch (zone) {
    case 'critical':
      return t.dangerBorder;
    case 'warn':
      return t.warningBorder;
    case 'onTrack':
      return t.successBorder;
    case 'ahead':
      return t.aheadBorder;
    case 'high':
      return t.orangeBorder;
    case 'super':
      return t.superBorder;
    default:
      return t.warningBorder;
  }
}

function getFlashLevel(zone: HourZone, hours: number): BarFlashLevel {
  if (hours <= 0) return 'none';
  if (zone === 'critical' || zone === 'super') return 'full';
  if (zone === 'warn') return 'full';
  if (zone === 'high') return 'intense';
  if (zone === 'ahead') return 'medium';
  return 'subtle';
}

export const WorkHoursTodayPanel = () => {
  const { hours, loading } = useWorkHoursToday();
  const [themeColors, setThemeColors] = useState<HourThemeColors | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    setThemeColors({
      successFill: 'rgba(34,197,94,0.35)',
      warningFill: 'rgba(234,179,8,0.35)',
      orangeFill: 'rgba(249,115,22,0.35)',
      aheadFill: 'rgba(36,205,197,0.35)',
      superFill: 'rgba(34,211,238,0.45)',
      dangerFill: s.getPropertyValue('--chart-danger').trim() || 'rgba(239,68,68,0.78)',
      neutralFill: 'rgba(36,205,197,0.35)',
      successBorder: s.getPropertyValue('--chart-success-border').trim() || 'rgb(34,197,94)',
      warningBorder: s.getPropertyValue('--chart-warning-border').trim() || 'rgb(234,179,8)',
      orangeBorder: s.getPropertyValue('--chart-orange-border').trim() || 'rgb(249,115,22)',
      aheadBorder: s.getPropertyValue('--chart-bar-primary-border').trim() || 'rgb(36,205,197)',
      superBorder: 'rgb(34,211,238)',
      dangerBorder: s.getPropertyValue('--chart-danger-border').trim() || 'rgb(239,68,68)',
      markerColor:
        s.getPropertyValue('--work-hours-target-line-color').trim()
        || s.getPropertyValue('--primary-color').trim()
        || 'rgb(36,205,197)',
    });
  }, []);

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
        const zone = getHourZone(m.hours, targetHours);
        if (m.hours <= 0) acc.zero += 1;
        if (zone === 'critical') acc.critical += 1;
        if (zone === 'onTrack') acc.onTrack += 1;
        if (zone === 'super') acc.super += 1;
        return acc;
      },
      { zero: 0, critical: 0, onTrack: 0, super: 0 }
    );
  }, [members, targetHours]);

  const chartData: HorizontalBarChartData = useMemo(() => {
    const zones = members.map((m) => getHourZone(m.hours, targetHours));

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
      colors: zones.map((z) => getBarFill(z, themeColors)),
      borderColors: zones.map((z) => getBorderColor(z, themeColors)),
      labelColors: members.map((m) => (m.hours <= 0 ? 'rgb(239,68,68)' : '')),
      targetMarker: {
        value: targetHours,
        color: themeColors.markerColor,
        label: `Target ${targetHours.toFixed(1)}h`,
      },
      suffix: 'h',
      flashLevels: zones.map((z, i) => getFlashLevel(z, members[i]?.hours ?? 0)),
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
          {zoneSummary.super > 0 && (
            <span className={`${styles.workHoursBadge} ${styles.badgeSuper}`}>150%+ {zoneSummary.super}</span>
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
