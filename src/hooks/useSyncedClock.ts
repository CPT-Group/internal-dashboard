'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const TICK_MS = 1000;
const RESYNC_MS = 5 * 60 * 1000;

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
});

interface TimeResponse {
  nowMs: number;
}

const isTimeResponse = (value: unknown): value is TimeResponse => {
  if (typeof value !== 'object' || value == null) return false;
  const candidate = value as { nowMs?: unknown };
  return typeof candidate.nowMs === 'number';
};

/**
 * Clock synced against server time, then advanced locally with performance.now().
 * This avoids drift from long-running displays while keeping render work minimal.
 */
export const useSyncedClock = () => {
  const [baseEpochAtMono, setBaseEpochAtMono] = useState<number>(() => Date.now() - performance.now());
  const [tick, setTick] = useState(0);

  const syncToServerTime = useCallback(async () => {
    const requestStartMono = performance.now();
    const response = await fetch('/api/time', {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const requestEndMono = performance.now();
    const payload: unknown = await response.json();
    if (!isTimeResponse(payload)) return;

    const midpointMono = requestStartMono + (requestEndMono - requestStartMono) / 2;
    setBaseEpochAtMono(payload.nowMs - midpointMono);
  }, []);

  useEffect(() => {
    void syncToServerTime();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncToServerTime();
      }
    }, RESYNC_MS);
    return () => window.clearInterval(id);
  }, [syncToServerTime]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setTick((value) => value + 1);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncToServerTime();
        setTick((value) => value + 1);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [syncToServerTime]);

  return useMemo(() => {
    const nowMs = baseEpochAtMono + performance.now();
    const nowDate = new Date(nowMs);
    return {
      timeLabel: TIME_FORMATTER.format(nowDate),
      dateLabel: DATE_FORMATTER.format(nowDate),
    };
  }, [baseEpochAtMono, tick]);
};

