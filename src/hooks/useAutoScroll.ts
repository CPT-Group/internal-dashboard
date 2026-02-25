'use client';

import { useEffect, useRef } from 'react';

interface AutoScrollOptions {
  /** Pixels per second to scroll. Default 20. */
  pixelsPerSecond?: number;
  /** Pause at top/bottom in ms before reversing. Default 3000. */
  pauseMs?: number;
}

/**
 * Auto-scrolls a container up and down when its content overflows.
 * Designed for always-on TV dashboards with no mouse interaction.
 *
 * Returns a ref to attach to the scrollable element.
 * If content fits without scrollbar, does nothing.
 */
export function useAutoScroll<T extends HTMLElement>(options: AutoScrollOptions = {}) {
  const { pixelsPerSecond = 20, pauseMs = 3000 } = options;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    let direction: 'down' | 'up' = 'down';
    let pauseUntil = Date.now() + pauseMs;
    let fractionalPos = 0;

    const TICK_MS = 50;
    const pxPerTick = pixelsPerSecond * (TICK_MS / 1000);

    const id = setInterval(() => {
      const el = ref.current;
      if (!el) return;

      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 1) return;

      if (Date.now() < pauseUntil) return;

      if (direction === 'down') {
        fractionalPos += pxPerTick;
        const newTop = Math.min(Math.round(fractionalPos), maxScroll);
        el.scrollTop = newTop;
        if (newTop >= maxScroll) {
          direction = 'up';
          fractionalPos = maxScroll;
          pauseUntil = Date.now() + pauseMs;
        }
      } else {
        fractionalPos -= pxPerTick;
        const newTop = Math.max(Math.round(fractionalPos), 0);
        el.scrollTop = newTop;
        if (newTop <= 0) {
          direction = 'down';
          fractionalPos = 0;
          pauseUntil = Date.now() + pauseMs;
        }
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [pixelsPerSecond, pauseMs]);

  return ref;
}
