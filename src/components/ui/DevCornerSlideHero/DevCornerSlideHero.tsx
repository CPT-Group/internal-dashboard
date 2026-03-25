'use client';

import type { ReactNode } from 'react';
import styles from './DevCornerSlideHero.module.scss';

export interface DevCornerSlideHeroProps {
  title: string;
  /** Short accent label (e.g. Today, 7d, Queue). */
  pill?: string;
  /** Detail line(s) under the title row — scope, stats, etc. */
  description?: ReactNode;
  /** Right side of title row — tags, counts (PrimeReact Tag, etc.). */
  trailing?: ReactNode;
}

export const DevCornerSlideHero = ({
  title,
  pill,
  description,
  trailing,
}: DevCornerSlideHeroProps) => {
  const showMeta = pill != null || description != null;

  return (
    <header className={styles.hero}>
      <div className={styles.heroTop}>
        <div className={styles.heroTitle}>{title}</div>
        {trailing != null && <div className={styles.heroTrailing}>{trailing}</div>}
      </div>
      {showMeta && (
        <div className={styles.heroMeta}>
          {pill != null && pill !== '' && <span className={styles.heroPill}>{pill}</span>}
          {description}
        </div>
      )}
    </header>
  );
};
