'use client';

import type { ReactNode } from 'react';
import styles from './TextScroller.module.css';

export interface TextScrollerProps {
  /** Content to scroll (e.g. text, spans). Bold, slightly larger than body; duplicated for seamless infinite loop. */
  children: ReactNode;
  /** Optional class for the outer wrapper. */
  className?: string;
  /** Scroll duration in seconds for one full cycle (default 30). */
  duration?: number;
}

export const TextScroller = ({
  children,
  className = '',
  duration = 30,
}: TextScrollerProps) => {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      style={{ '--text-scroller-duration': `${duration}s` } as React.CSSProperties}
    >
      <div className={styles.track}>
        <span className={styles.content}>{children}</span>
        <span className={styles.content} aria-hidden="true">
          {children}
        </span>
      </div>
    </div>
  );
};
