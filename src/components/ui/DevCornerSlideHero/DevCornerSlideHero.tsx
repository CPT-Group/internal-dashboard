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
  /** Puts the pill after the title on the same row (compact header; omits the meta row when there is no description). */
  pillInline?: boolean;
}

export const DevCornerSlideHero = ({
  title,
  pill,
  description,
  trailing,
  pillInline = false,
}: DevCornerSlideHeroProps) => {
  const hasPill = pill != null && pill !== '';
  const showMetaRow = description != null || (!pillInline && hasPill);

  return (
    <header className={`${styles.hero} ${pillInline ? styles.heroPillInline : ''}`}>
      <div className={styles.heroTop}>
        {pillInline ? (
          <div className={styles.heroTitleRow}>
            <div className={styles.heroTitle}>{title}</div>
            {hasPill && <span className={styles.heroPill}>{pill}</span>}
          </div>
        ) : (
          <div className={styles.heroTitle}>{title}</div>
        )}
        {trailing != null && <div className={styles.heroTrailing}>{trailing}</div>}
      </div>
      {showMetaRow && (
        <div className={styles.heroMeta}>
          {!pillInline && hasPill && <span className={styles.heroPill}>{pill}</span>}
          {description}
        </div>
      )}
    </header>
  );
};
