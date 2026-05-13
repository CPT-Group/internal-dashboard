import type { BarFlashLevel } from '@/types/charts';

/**
 * Rolling intraday target for “work hours today” charts (9–17 local), shared by
 * Dev Corner One and Trevor’s Screen.
 */
export type WorkHoursZone = 'critical' | 'warn' | 'onTrack' | 'overTarget' | 'plaid';

/** Theme tokens needed to color bars by zone (read from CSS variables in components). */
export interface WorkHoursChartTheme {
  successFill: string;
  warningFill: string;
  superFill: string;
  dangerFill: string;
  neutralFill: string;
  successBorder: string;
  warningBorder: string;
  superBorder: string;
  dangerBorder: string;
}

export function getCurrentTargetHours(now: Date): number {
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const startMinutes = 9 * 60;
  const endMinutes = 17 * 60;

  if (minutesNow <= startMinutes) return 0.1;
  if (minutesNow >= endMinutes) return 8;
  return Math.max(0.1, (minutesNow - startMinutes) / 60);
}

export function getWorkHoursZone(hours: number, targetHours: number): WorkHoursZone {
  const ratio = targetHours > 0 ? hours / targetHours : Number.POSITIVE_INFINITY;
  if (ratio <= 0.5) return 'critical';
  if (ratio <= 0.75) return 'warn';
  if (ratio <= 1) return 'onTrack';
  if (ratio < 2) return 'overTarget';
  return 'plaid';
}

export function getWorkHoursBarFill(zone: WorkHoursZone, t: WorkHoursChartTheme): string {
  switch (zone) {
    case 'critical':
      return t.dangerFill;
    case 'warn':
      return t.warningFill;
    case 'onTrack':
      return t.successFill;
    case 'overTarget':
    case 'plaid':
      return t.superFill;
    default:
      return t.neutralFill;
  }
}

export function getWorkHoursBarBorder(zone: WorkHoursZone, t: WorkHoursChartTheme): string {
  switch (zone) {
    case 'critical':
      return t.dangerBorder;
    case 'warn':
      return t.warningBorder;
    case 'onTrack':
      return t.successBorder;
    case 'overTarget':
    case 'plaid':
      return t.superBorder;
    default:
      return t.warningBorder;
  }
}

export function getWorkHoursFlashLevel(zone: WorkHoursZone, hours: number): BarFlashLevel {
  if (hours <= 0) return 'none';
  if (zone === 'critical' || zone === 'warn') return 'full';
  if (zone === 'overTarget' || zone === 'plaid') return 'full';
  return 'subtle';
}
