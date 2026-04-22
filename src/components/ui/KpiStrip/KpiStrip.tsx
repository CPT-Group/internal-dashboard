'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { Card } from 'primereact/card';
import styles from './KpiStrip.module.scss';

export interface KpiItem {
  label: string;
  value: string | number;
  severity?: 'success' | 'danger' | 'warning' | 'info';
  badge?: ReactNode;
  /** When set, the whole KPI card acts as a silent hit target (e.g. global theme cycle). */
  onActivate?: () => void;
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
      {items.map((item) => {
        const interactive = item.onActivate != null;
        const cardClass = `${styles.kpiCard} ${severityClass(item.severity)}${interactive ? ` ${styles.kpiCardInteractive}` : ''}`;
        const body = (
          <>
            <div className={styles.label}>{item.label}</div>
            <div className={styles.value}>{item.value}</div>
            {item.badge ? <div className={styles.badge}>{item.badge}</div> : null}
          </>
        );
        return (
          <Card
            key={item.label}
            className={cardClass}
            {...(interactive
              ? {
                  onClick: item.onActivate,
                  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      item.onActivate?.();
                    }
                  },
                  role: 'button' as const,
                  tabIndex: 0,
                  'aria-label': 'Next visual style',
                }
              : {})}
          >
            {body}
          </Card>
        );
      })}
    </div>
  );
};
