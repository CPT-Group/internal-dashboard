'use client';

import type { ReactNode } from 'react';
import { Card } from 'primereact/card';
import styles from './KpiStrip.module.scss';

export interface KpiItem {
  label: string;
  value: string | number;
  severity?: 'success' | 'danger' | 'warning' | 'info';
  badge?: ReactNode;
}

export interface KpiStripProps {
  items: KpiItem[];
}

const severityClass = (severity?: KpiItem['severity']): string => {
  if (!severity) return '';
  const map: Record<string, string> = {
    success: styles.success,
    danger: styles.danger,
    warning: styles.warning,
    info: styles.info,
  };
  return map[severity] ?? '';
};

/**
 * Data-driven row of KPI cards. Each item renders as a compact Card with label, value,
 * optional severity coloring, and optional badge (e.g. TrendBadge).
 */
export const KpiStrip = ({ items }: KpiStripProps) => {
  return (
    <div className={styles.strip}>
      {items.map((item) => (
        <Card key={item.label} className={`${styles.kpiCard} ${severityClass(item.severity)}`}>
          <div className={styles.label}>{item.label}</div>
          <div className={styles.value}>{item.value}</div>
          {item.badge && <div className={styles.badge}>{item.badge}</div>}
        </Card>
      ))}
    </div>
  );
};
