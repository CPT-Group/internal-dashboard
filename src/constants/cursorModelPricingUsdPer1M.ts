/**
 * Snapshot of public list rates from Cursor docs "Models & Pricing" (API pool, $ per 1M tokens).
 * https://cursor.com/docs/models-and-pricing — captured 2026-05-13 for CSV cost estimates only (not invoices).
 *
 * Where the doc omits cache write, `cacheWritePer1M` is null (estimator treats like input for cache-write slot).
 */

export const CURSOR_MODEL_PRICING_DOC_SNAPSHOT_ISO = '2026-05-13';

export interface CursorModelUsdPer1M {
  inputPer1M: number;
  outputPer1M: number;
  cacheReadPer1M: number;
  cacheWritePer1M: number | null;
}

/** Canonical slug → list API-pool rates ($ / 1M tokens). Slugs match Cursor Analytics team CSV `model_breakdown` keys when possible. */
export const CURSOR_MODEL_PRICING_USD_PER_1M: Readonly<Record<string, CursorModelUsdPer1M>> = Object.freeze({
  // Anthropic (Claude 4.x / 4.5 / 4.6 / 4.7 family — representative API row)
  'claude-4-sonnet': { inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.3, cacheWritePer1M: 3.75 },
  'claude-4.5-haiku': { inputPer1M: 1, outputPer1M: 5, cacheReadPer1M: 0.1, cacheWritePer1M: 1.25 },
  'claude-4.5-opus': { inputPer1M: 5, outputPer1M: 25, cacheReadPer1M: 0.5, cacheWritePer1M: 6.25 },
  'claude-4.5-sonnet': { inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.3, cacheWritePer1M: 3.75 },
  'claude-4.6-opus': { inputPer1M: 5, outputPer1M: 25, cacheReadPer1M: 0.5, cacheWritePer1M: 6.25 },
  'claude-4.6-sonnet': { inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.3, cacheWritePer1M: 3.75 },
  'claude-4.7-opus': { inputPer1M: 5, outputPer1M: 25, cacheReadPer1M: 0.5, cacheWritePer1M: 6.25 },
  // Cursor Composer
  'composer-1': { inputPer1M: 1.25, outputPer1M: 10, cacheReadPer1M: 0.125, cacheWritePer1M: null },
  'composer-1.5': { inputPer1M: 3.5, outputPer1M: 17.5, cacheReadPer1M: 0.35, cacheWritePer1M: null },
  'composer-2': { inputPer1M: 0.5, outputPer1M: 2.5, cacheReadPer1M: 0.2, cacheWritePer1M: null },
  // Google Gemini
  'gemini-2.5-flash': { inputPer1M: 0.3, outputPer1M: 2.5, cacheReadPer1M: 0.03, cacheWritePer1M: null },
  'gemini-3-flash': { inputPer1M: 0.5, outputPer1M: 3, cacheReadPer1M: 0.05, cacheWritePer1M: null },
  'gemini-3-pro': { inputPer1M: 2, outputPer1M: 12, cacheReadPer1M: 0.2, cacheWritePer1M: null },
  'gemini-3.1-pro': { inputPer1M: 2, outputPer1M: 12, cacheReadPer1M: 0.2, cacheWritePer1M: null },
  // OpenAI GPT-5 family
  'gpt-5': { inputPer1M: 1.25, outputPer1M: 10, cacheReadPer1M: 0.125, cacheWritePer1M: null },
  'gpt-5-fast': { inputPer1M: 2.5, outputPer1M: 20, cacheReadPer1M: 0.25, cacheWritePer1M: null },
  'gpt-5-mini': { inputPer1M: 0.25, outputPer1M: 2, cacheReadPer1M: 0.025, cacheWritePer1M: null },
  'gpt-5-codex': { inputPer1M: 1.25, outputPer1M: 10, cacheReadPer1M: 0.125, cacheWritePer1M: null },
  'gpt-5.1-codex': { inputPer1M: 1.25, outputPer1M: 10, cacheReadPer1M: 0.125, cacheWritePer1M: null },
  'gpt-5.1-codex-max': { inputPer1M: 1.25, outputPer1M: 10, cacheReadPer1M: 0.125, cacheWritePer1M: null },
  'gpt-5.1-codex-mini': { inputPer1M: 0.25, outputPer1M: 2, cacheReadPer1M: 0.025, cacheWritePer1M: null },
  'gpt-5.2': { inputPer1M: 1.75, outputPer1M: 14, cacheReadPer1M: 0.175, cacheWritePer1M: null },
  'gpt-5.2-codex': { inputPer1M: 1.75, outputPer1M: 14, cacheReadPer1M: 0.175, cacheWritePer1M: null },
  'gpt-5.3-codex': { inputPer1M: 1.75, outputPer1M: 14, cacheReadPer1M: 0.175, cacheWritePer1M: null },
  'gpt-5.4': { inputPer1M: 2.5, outputPer1M: 15, cacheReadPer1M: 0.25, cacheWritePer1M: null },
  'gpt-5.4-mini': { inputPer1M: 0.75, outputPer1M: 4.5, cacheReadPer1M: 0.075, cacheWritePer1M: null },
  'gpt-5.4-nano': { inputPer1M: 0.2, outputPer1M: 1.25, cacheReadPer1M: 0.02, cacheWritePer1M: null },
  'gpt-5.5': { inputPer1M: 5, outputPer1M: 30, cacheReadPer1M: 0.5, cacheWritePer1M: null },
  // xAI / Moonshot (representative)
  'grok-4.20': { inputPer1M: 2, outputPer1M: 6, cacheReadPer1M: 0.2, cacheWritePer1M: null },
  'grok-4.3': { inputPer1M: 1.25, outputPer1M: 2.5, cacheReadPer1M: 0.2, cacheWritePer1M: null },
  'kimi-k2.5': { inputPer1M: 0.6, outputPer1M: 3, cacheReadPer1M: 0.1, cacheWritePer1M: null },
  /** Auto + Composer pool list row (used only when no API slug match — rough ceiling vs API pool). */
  __auto_composer_pool__: { inputPer1M: 1.25, outputPer1M: 6, cacheReadPer1M: 0.25, cacheWritePer1M: null },
  /** When slug unknown after alias pass. */
  __fallback__: { inputPer1M: 1.25, outputPer1M: 10, cacheReadPer1M: 0.125, cacheWritePer1M: null },
});

/** CSV / API variant slug → canonical key in `CURSOR_MODEL_PRICING_USD_PER_1M`. */
export const CURSOR_MODEL_PRICING_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'claude-4-sonnet-1m': 'claude-4-sonnet',
  'claude-3-5-sonnet': 'claude-4.5-sonnet',
  'claude-3-5-haiku': 'claude-4.5-haiku',
  'claude-3-opus': 'claude-4.5-opus',
  'claude-4.6-opus-high-thinking': 'claude-4.6-opus',
  'composer-2-fast': 'composer-2',
  'gpt-5.5-medium': 'gpt-5.5',
  /** Premium pool — approximate with flagship API row for list-rate sanity checks only. */
  premium: 'gpt-5.5',
  'gpt-5.1': 'gpt-5',
  'gpt-5.2-high': 'gpt-5.2',
  'gpt-5-high': 'gpt-5',
  'gpt-5-high-fast': 'gpt-5-fast',
  'gpt-5-low-fast': 'gpt-5-fast',
});

export function resolveCursorModelPricingSlug(rawSlug: string): string {
  const s = rawSlug.trim().toLowerCase();
  if (!s) return '__fallback__';
  if (CURSOR_MODEL_PRICING_USD_PER_1M[s]) return s;
  const alias = CURSOR_MODEL_PRICING_ALIASES[s];
  if (alias && CURSOR_MODEL_PRICING_USD_PER_1M[alias]) return alias;
  return '__fallback__';
}

export function getCursorModelUsdPer1M(rawSlug: string): CursorModelUsdPer1M {
  const key = resolveCursorModelPricingSlug(rawSlug);
  const row = CURSOR_MODEL_PRICING_USD_PER_1M[key];
  return row ?? CURSOR_MODEL_PRICING_USD_PER_1M.__fallback__;
}
