'use client';

import { useEffect, useState } from 'react';
import styles from './BackgroundSlideshow.module.css';

export type BackgroundSlideshowTransition =
  | 'fade'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight';

export interface BackgroundSlideshowProps {
  /** Image URLs (e.g. from generated constants or any string array). */
  slides: readonly string[];
  /** Milliseconds between slide changes (default 6000). */
  intervalMs?: number;
  /** Transition duration in ms (default 1500). */
  transitionDurationMs?: number;
  /** Transition type (default 'fade'). */
  transition?: BackgroundSlideshowTransition;
  /** Optional class name for the outer wrapper. */
  className?: string;
  /** Optional class for fallback when slides.length === 0 (e.g. theme background). */
  fallbackClassName?: string;
}

const DEFAULT_INTERVAL_MS = 6000;
const DEFAULT_DURATION_MS = 1500;

/**
 * Reusable full-bleed background slideshow. Pass any array of image URLs (e.g. from
 * CONFERENCE_BACKGROUND_SLIDES or JULIES_BACKGROUND_SLIDES). Handles empty list with
 * optional fallback. Transitions: fade, slideUp, slideDown, slideLeft, slideRight.
 */
export const BackgroundSlideshow = ({
  slides,
  intervalMs = DEFAULT_INTERVAL_MS,
  transitionDurationMs = DEFAULT_DURATION_MS,
  transition = 'fade',
  className = '',
  fallbackClassName,
}: BackgroundSlideshowProps) => {
  const slideCount: number = slides.length;
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (slideCount === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slideCount);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [slideCount, intervalMs]);

  if (slideCount === 0) {
    return (
      <div
        className={fallbackClassName ?? styles.fallback}
        aria-hidden
        data-slideshow-fallback
      />
    );
  }

  return (
    <div
      className={`${styles.wrapper} ${className}`.trim()}
      aria-hidden
      data-transition={transition}
      style={{ '--slideshow-duration': `${transitionDurationMs}ms` } as React.CSSProperties}
    >
      <div className={styles.slideshow}>
        {slides.map((src, index) => (
          <div
            key={src}
            className={`${styles.slide} ${index === currentIndex ? styles.active : ''}`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
      </div>
    </div>
  );
};
