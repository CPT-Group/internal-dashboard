'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './MarqueeTicker.module.scss';

export interface MarqueeTickerProps {
  text: string;
  className?: string;
  durationSeconds?: number;
  gapRem?: number;
  forceMarquee?: boolean;
}

export const MarqueeTicker = ({
  text,
  className = '',
  durationSeconds = 24,
  gapRem = 2,
  forceMarquee = false,
}: MarqueeTickerProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const segmentRef = useRef<HTMLSpanElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const segment = segmentRef.current;
    if (!viewport || !segment) return;

    const updateOverflow = () => {
      const overflowing = segment.scrollWidth > viewport.clientWidth + 1;
      setIsOverflowing(overflowing);
    };

    updateOverflow();

    const observer = new ResizeObserver(() => {
      updateOverflow();
    });
    observer.observe(viewport);
    observer.observe(segment);

    return () => observer.disconnect();
  }, [text]);

  const rootClass = useMemo(
    () => [styles.root, className].filter(Boolean).join(' '),
    [className]
  );

  const cssVars = useMemo(
    () =>
      ({
        '--marquee-duration': `${durationSeconds}s`,
        '--marquee-gap': `${gapRem}rem`,
      }) as React.CSSProperties,
    [durationSeconds, gapRem]
  );

  const renderedText = text.trim() === '' ? '—' : text;

  const shouldAnimate = forceMarquee || isOverflowing;

  return (
    <div
      className={rootClass}
      style={cssVars}
      data-animate={shouldAnimate ? 'true' : 'false'}
    >
      <div ref={viewportRef} className={styles.viewport}>
        <div className={styles.track}>
          <span ref={segmentRef} className={styles.segment}>
            {renderedText}
          </span>
          {shouldAnimate ? (
            <span className={styles.segment} aria-hidden="true">
              {renderedText}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
