'use client';

import type { ReactNode } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import styles from './ThemeCycleHitTarget.module.scss';

export type ThemeCycleHitTargetVariant = 'strip' | 'title';

export interface ThemeCycleHitTargetProps {
  /** `strip` = narrow KPI-bar tile (no visible text). `title` = large heading-style (pass children). */
  variant?: ThemeCycleHitTargetVariant;
  className?: string;
  children?: ReactNode;
}

export const ThemeCycleHitTarget = ({
  variant = 'strip',
  className,
  children,
}: ThemeCycleHitTargetProps) => {
  const { cycleTheme } = useTheme();
  const variantClass = variant === 'title' ? styles.title : styles.strip;
  const root = [styles.hit, variantClass, className].filter(Boolean).join(' ');

  return (
    <button type="button" className={root} onClick={cycleTheme} aria-label="Next visual style">
      {children}
    </button>
  );
};
