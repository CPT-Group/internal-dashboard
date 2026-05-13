/** Team `/teams/spend` fields are integer cents. */
export function formatUsdFromCents(cents: number): string {
  if (!Number.isFinite(cents)) return '—';
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Arbitrary USD number (e.g. pro-rata allocation). */
export function formatUsdNumber(usd: number): string {
  if (!Number.isFinite(usd)) return '—';
  return usd.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * `filtered-usage-events` sums `chargedCents` — field name says cents but samples can be fractional "dollars".
 * Heuristic for **display only**: fractional → treat as USD; large integers → cents÷100; small integers → USD.
 */
export function chargedFieldToUsdHeuristic(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  if (raw === 0) return 0;
  const frac = Math.abs(raw % 1) > 1e-9;
  if (frac) return raw;
  const a = Math.abs(raw);
  if (a >= 10_000) return raw / 100;
  if (a >= 1000 && Number.isInteger(raw)) return raw / 100;
  return raw;
}

/** `/teams/filtered-usage-events` `chargedCents` — API name; values may be fractional. */
export function formatChargedField(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
