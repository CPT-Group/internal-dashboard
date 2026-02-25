'use client';

import { useEffect, useRef, useCallback } from 'react';

interface AutoScrollOptions {
  /** Pixels per animation frame (~60fps). Lower = slower scroll. Default 0.5. */
  speed?: number;
  /** Pause at top/bottom in ms before reversing. Default 3000. */
  pauseMs?: number;
  /** How often to re-check if overflow exists (ms). Default 2000. */
  checkIntervalMs?: number;
}

/**
 * Auto-scrolls a container up and down when its content overflows.
 * Designed for always-on TV dashboards with no mouse interaction.
 *
 * Returns a ref callback to attach to the scrollable element.
 * If content fits without scrollbar, does nothing.
 */
export function useAutoScroll<T extends HTMLElement>(options: AutoScrollOptions = {}) {
  const { speed = 0.5, pauseMs = 3000, checkIntervalMs = 2000 } = options;

  const containerRef = useRef<T | null>(null);
  const animRef = useRef<number | null>(null);
  const directionRef = useRef<'down' | 'up'>('down');
  const pauseUntilRef = useRef<number>(0);

  const tick = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) {
      animRef.current = requestAnimationFrame(tick);
      return;
    }

    const now = Date.now();
    if (now < pauseUntilRef.current) {
      animRef.current = requestAnimationFrame(tick);
      return;
    }

    if (directionRef.current === 'down') {
      el.scrollTop += speed;
      if (el.scrollTop >= maxScroll) {
        el.scrollTop = maxScroll;
        directionRef.current = 'up';
        pauseUntilRef.current = now + pauseMs;
      }
    } else {
      el.scrollTop -= speed;
      if (el.scrollTop <= 0) {
        el.scrollTop = 0;
        directionRef.current = 'down';
        pauseUntilRef.current = now + pauseMs;
      }
    }

    animRef.current = requestAnimationFrame(tick);
  }, [speed, pauseMs]);

  useEffect(() => {
    const startIfNeeded = () => {
      const el = containerRef.current;
      if (!el) return;

      const hasOverflow = el.scrollHeight > el.clientHeight;
      if (hasOverflow && animRef.current === null) {
        pauseUntilRef.current = Date.now() + pauseMs;
        directionRef.current = 'down';
        animRef.current = requestAnimationFrame(tick);
      } else if (!hasOverflow && animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };

    startIfNeeded();
    const interval = setInterval(startIfNeeded, checkIntervalMs);

    return () => {
      clearInterval(interval);
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, [tick, pauseMs, checkIntervalMs]);

  return containerRef;
}
