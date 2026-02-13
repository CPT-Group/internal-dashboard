'use client';

import type { ReactNode } from 'react';
import styles from './TextScroller.module.css';

export interface TextScrollerProps {
  /** Content to scroll (e.g. text, spans). Bold, slightly larger than body; duplicated for seamless infinite loop. */
  children: ReactNode;
  /** Optional class for the outer wrapper. */
  className?: string;
  /** Scroll duration in seconds for one full cycle (default 26). */
  duration?: number;
  /** Text color (e.g. "white", "#fff"). Default: theme (--text-color). */
  textColor?: string;
  /** Background color of the scroller strip (e.g. "black", "#000"). Default: theme / transparent. */
  backgroundColor?: string;
}

export const TextScroller = ({
  children,
  className = '',
  duration = 26,
  textColor,
  backgroundColor,
}: TextScrollerProps) => {
  const style: React.CSSProperties = { '--text-scroller-duration': `${duration}s` } as React.CSSProperties;
  if (textColor != null) style.color = textColor;
  if (backgroundColor != null) style.backgroundColor = backgroundColor;

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      style={style}
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
