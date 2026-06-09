'use client';

import { useEffect, useRef } from 'react';
import { useCodeFreezeNotice } from '@/hooks/useCodeFreezeNotice';
import { CODE_FREEZE_NOTICE_MESSAGE, CODE_FREEZE_NOTICE_SUBTEXT } from '@/constants/CODE_FREEZE';
import styles from './CodeFreezeOverlay.module.scss';

const FREEZE_THEME = 'code-freeze';

interface Props {
  children: React.ReactNode;
}

/**
 * Wraps a TV dashboard with freeze-mode visuals and a periodic CODE FREEZE notice.
 *
 * Theme locking: sets data-theme="code-freeze" on <html> via a MutationObserver so
 * ThemeProvider cannot override it while this overlay is mounted. The prior theme is
 * restored on unmount.
 *
 * Renders: animated canvas snowfall, SVG frost-edge vignette, corner crystals, and
 * the periodic blinking CODE FREEZE modal (wall-clock schedule from useCodeFreezeNotice).
 */
export function CodeFreezeOverlay({ children }: Props) {
  const noticeVisible = useCodeFreezeNotice(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  // Lock data-theme="code-freeze" on <html> — MutationObserver immediately corrects
  // any override by ThemeProvider (localStorage read on mount).
  useEffect(() => {
    const root = document.documentElement;
    const prevTheme = root.getAttribute('data-theme');

    root.setAttribute('data-theme', FREEZE_THEME);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'data-theme') {
          if (root.getAttribute('data-theme') !== FREEZE_THEME) {
            root.setAttribute('data-theme', FREEZE_THEME);
          }
        }
      }
    });

    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      observer.disconnect();
      if (prevTheme) {
        root.setAttribute('data-theme', prevTheme);
      } else {
        root.removeAttribute('data-theme');
      }
    };
  }, []);

  // Animate falling snow particles on canvas (Tizen-compatible: Canvas 2D only)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to fill viewport
    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Snowflake state
    const FLAKE_COUNT = 80;
    type Flake = {
      x: number;
      y: number;
      r: number;
      speed: number;
      drift: number;
      alpha: number;
    };

    function makeFlake(): Flake {
      const w = canvas ? canvas.width : 1920;
      const h = canvas ? canvas.height : 1080;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1.2 + Math.random() * 2.8,
        speed: 0.4 + Math.random() * 0.8,
        drift: (Math.random() - 0.5) * 0.3,
        alpha: 0.3 + Math.random() * 0.55,
      };
    }

    const flakes: Flake[] = Array.from({ length: FLAKE_COUNT }, makeFlake);

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const f of flakes) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210,235,255,${f.alpha.toFixed(2)})`;
        ctx.fill();

        f.y += f.speed;
        f.x += f.drift;

        if (f.y > canvas.height + 4) {
          f.y = -4;
          f.x = Math.random() * canvas.width;
        }
        if (f.x < -4) f.x = canvas.width + 4;
        if (f.x > canvas.width + 4) f.x = -4;
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.wrapper}>
      {/* Underlying dashboard content */}
      {children}

      {/* Snow particle canvas */}
      <canvas ref={canvasRef} className={styles.snowCanvas} aria-hidden="true"/>

      {/* SVG frost edge overlay */}
      <div className={styles.frostEdge} aria-hidden="true"/>

      {/* Corner frost crystals */}
      <div className={styles.crystalTL} aria-hidden="true"/>
      <div className={styles.crystalTR} aria-hidden="true"/>
      <div className={styles.crystalBL} aria-hidden="true"/>
      <div className={styles.crystalBR} aria-hidden="true"/>

      {/* CODE FREEZE periodic notice */}
      {noticeVisible && (
        <div className={styles.noticeBackdrop} aria-live="assertive" role="alert">
          <div className={styles.noticeBox}>
            <div className={styles.noticeIcon} aria-hidden="true">
              ❄
            </div>
            <p className={styles.noticeHeading}>{CODE_FREEZE_NOTICE_MESSAGE}</p>
            <p className={styles.noticeSubtext}>{CODE_FREEZE_NOTICE_SUBTEXT}</p>
          </div>
        </div>
      )}
    </div>
  );
}
