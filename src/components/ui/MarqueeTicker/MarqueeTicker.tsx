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
  const [effectiveGapPx, setEffectiveGapPx] = useState<number>(Math.max(0, gapRem) * 16);

  useEffect(() => {
    const viewport = viewportRef.current;
    const segment = segmentRef.current;
    if (!viewport || !segment) return;

    const updateOverflow = () => {
      const viewportWidth = viewport.clientWidth;
      const segmentWidth = segment.scrollWidth;
      const overflowing = segmentWidth > viewportWidth + 1;
      setIsOverflowing(overflowing);

      const rootFontSize = Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize
      );
      const safeRootFontSize = Number.isFinite(rootFontSize) ? rootFontSize : 16;
      const baseGapPx = Math.max(0, gapRem) * safeRootFontSize;
      const adaptiveGapPx =
        forceMarquee && !overflowing
          ? Math.max(baseGapPx, viewportWidth - segmentWidth + baseGapPx)
          : baseGapPx;
      setEffectiveGapPx((prev) => (Math.abs(prev - adaptiveGapPx) < 0.5 ? prev : adaptiveGapPx));
    };

    updateOverflow();

    const observer = new ResizeObserver(() => {
      updateOverflow();
    });
    observer.observe(viewport);
    observer.observe(segment);

    return () => observer.disconnect();
  }, [text, gapRem, forceMarquee]);

  const rootClass = useMemo(
    () => [styles.root, className].filter(Boolean).join(' '),
    [className]
  );

  const cssVars = useMemo(
    () =>
      ({
        '--marquee-duration': `${durationSeconds}s`,
        '--marquee-gap': `${effectiveGapPx}px`,
      }) as React.CSSProperties,
    [durationSeconds, effectiveGapPx]
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
