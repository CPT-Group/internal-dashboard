'use client';

import styles from './TrendBadge.module.scss';

export interface TrendBadgeProps {
  /** Delta value to display (positive = up, negative = down, 0 = neutral). */
  value: number;
  /** When true, positive = bad (red) and negative = good (green). */
  invertColor?: boolean;
  /** Optional label prefix (e.g. "vs prev 14d"). */
  label?: string;
}

/**
 * Inline trend indicator with directional arrow and semantic color.
 * Green = favorable, Red = unfavorable (flipped by invertColor).
 */
export const TrendBadge = ({ value, invertColor = false, label }: TrendBadgeProps) => {
  if (value === 0) {
    return (
      <span className={`${styles.badge} ${styles.neutral}`}>
        <i className="pi pi-minus" />
        {label && <span className={styles.label}>{label}</span>}
        <span className={styles.value}>0</span>
      </span>
    );
  }

  const isPositive = value > 0;
  const isFavorable = invertColor ? !isPositive : isPositive;
  const severityClass = isFavorable ? styles.good : styles.bad;
  const icon = isPositive ? 'pi pi-arrow-up' : 'pi pi-arrow-down';
  const display = isPositive ? `+${value}` : `${value}`;

  return (
    <span className={`${styles.badge} ${severityClass}`}>
      <i className={icon} />
      {label && <span className={styles.label}>{label}</span>}
      <span className={styles.value}>{display}</span>
    </span>
  );
};
