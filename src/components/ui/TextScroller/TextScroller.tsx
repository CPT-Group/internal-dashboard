'use client';

import type { ReactNode } from 'react';

export interface TextScrollerProps {
  /** Content to scroll (e.g. text, spans). Rendered at paragraph size; duplicated for seamless infinite loop—when one copy scrolls out, the other follows so it never stops. */
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
      className={`text-scroller ${className}`.trim()}
      style={{ '--text-scroller-duration': `${duration}s` } as React.CSSProperties}
    >
      <div className="text-scroller-track">
        <span className="text-scroller-content">{children}</span>
        <span className="text-scroller-content" aria-hidden="true">
          {children}
        </span>
      </div>
    </div>
  );
};
