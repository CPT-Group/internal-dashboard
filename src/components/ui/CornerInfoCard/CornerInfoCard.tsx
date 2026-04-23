'use client';

import styles from './CornerInfoCard.module.scss';

export type CornerInfoCardWidgetType = 'weather' | 'cpt' | 'none';

export interface CornerInfoCardProps {
  /** Main title (e.g. person name). */
  name: string;
  /** Subtitle / position (e.g. role). */
  title: string;
  /** Optional widget slot; 'none' shows only name/title. 'weather' and 'cpt' reserved for future content. */
  widgetType?: CornerInfoCardWidgetType;
  /** Optional hidden action (e.g. theme cycle) when the card is clicked. */
  onActivate?: () => void;
}

/**
 * Small horizontal glassy card for corner placement: name (main text), title (smaller), and optional widget slot.
 * Parent should position with e.g. position: absolute; top: 3rem; left: 3rem; so it floats in the corner on any screen.
 */
export const CornerInfoCard = ({
  name,
  title,
  widgetType = 'none',
  onActivate,
}: CornerInfoCardProps) => {
  const interactive = typeof onActivate === 'function';

  return (
    <div
      className={`${styles.card}${interactive ? ` ${styles.cardInteractive}` : ''}`}
      role={interactive ? 'button' : 'complementary'}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? 'Next visual style' : `${name}, ${title}`}
      onClick={interactive ? onActivate : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate();
              }
            }
          : undefined
      }
    >
      <div className={styles.main}>
        <div className={styles.name}>{name}</div>
        <div className={styles.title}>{title}</div>
      </div>
      {widgetType === 'weather' && <div className={styles.widgetSlot} data-widget="weather" />}
      {widgetType === 'cpt' && <div className={styles.widgetSlot} data-widget="cpt" />}
    </div>
  );
};
