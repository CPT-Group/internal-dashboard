'use client';

import { useEffect, useState } from 'react';
import {
  CODE_FREEZE_NOTICE_INTERVAL_MS,
  CODE_FREEZE_NOTICE_DURATION_MS,
} from '@/constants/CODE_FREEZE';

/**
 * Wall-clock-driven scheduler for the CODE FREEZE periodic notice.
 *
 * - Open: the first half-hour or hour boundary after load, and every N minutes after.
 * - Close: automatically after DURATION_MS from when it opened.
 * - Safe on TV page reload: recalculates schedule based on current wall time so
 *   it never gets permanently out of sync with the Jira polling / auto-refresh cycle.
 */
export function useCodeFreezeNotice(enabled: boolean): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return;
    }

    /**
     * Returns the number of milliseconds until the next interval boundary.
     * e.g. with interval=30min, boundary at :00 and :30 each hour.
     */
    function msUntilNextBoundary(): number {
      const now = Date.now();
      const elapsed = now % CODE_FREEZE_NOTICE_INTERVAL_MS;
      return CODE_FREEZE_NOTICE_INTERVAL_MS - elapsed;
    }

    /**
     * Returns the ms remaining from "now" inside the current duration window,
     * or 0 if we are currently NOT inside a duration window.
     */
    function msRemainingInCurrentWindow(): number {
      const now = Date.now();
      const positionInCycle = now % CODE_FREEZE_NOTICE_INTERVAL_MS;
      if (positionInCycle < CODE_FREEZE_NOTICE_DURATION_MS) {
        return CODE_FREEZE_NOTICE_DURATION_MS - positionInCycle;
      }
      return 0;
    }

    let openTimer: ReturnType<typeof setTimeout> | null = null;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;

    function openNotice(): void {
      setVisible(true);
      if (closeTimer !== null) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        setVisible(false);
        scheduleNext();
      }, CODE_FREEZE_NOTICE_DURATION_MS);
    }

    function scheduleNext(): void {
      if (openTimer !== null) clearTimeout(openTimer);
      openTimer = setTimeout(() => {
        openNotice();
      }, msUntilNextBoundary());
    }

    // On mount, check if we are currently inside an open window.
    const remaining = msRemainingInCurrentWindow();
    if (remaining > 0) {
      // We reloaded while a window was active — show the notice immediately.
      setVisible(true);
      closeTimer = setTimeout(() => {
        setVisible(false);
        scheduleNext();
      }, remaining);
    } else {
      scheduleNext();
    }

    return () => {
      if (openTimer !== null) clearTimeout(openTimer);
      if (closeTimer !== null) clearTimeout(closeTimer);
      setVisible(false);
    };
  }, [enabled]);

  return visible;
}
