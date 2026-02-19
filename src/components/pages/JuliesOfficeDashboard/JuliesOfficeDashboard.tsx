'use client';

import { useEffect, useState } from 'react';
import { JULIES_BACKGROUND_SLIDES } from '@/constants';
import styles from './JuliesOfficeDashboard.module.css';

const SLIDE_INTERVAL_MS = 6000;

/**
 * Julie's Office dashboard – rotating unicorn-themed background from public/JuliesUnicorns/backgrounds/.
 * Content (scroller, widgets) can be added later; for now background only.
 */
export const JuliesOfficeDashboard = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const slideCount: number = JULIES_BACKGROUND_SLIDES.length;

  useEffect(() => {
    if (slideCount === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slideCount);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [slideCount]);

  return (
    <div className={styles.juliesDashboardContent}>
      {slideCount === 0 ? (
        <div className={styles.juliesFallback} aria-hidden />
      ) : (
        <div className={styles.juliesSlideshow} aria-hidden>
          {JULIES_BACKGROUND_SLIDES.map((src, index) => (
            <div
              key={src}
              className={`${styles.juliesSlide} ${index === currentIndex ? styles.active : ''}`}
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
