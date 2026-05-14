/**
 * Team **Analytics** CSV has **no dollar columns** — this module turns `Models Time Series Data` model rows into cents
 * using **Cursor public list $/1M** from `cursorModelPricingUsdPer1M.ts` (aligned to https://cursor.com/docs/models).
 */
import { getCursorModelUsdPer1M, resolveCursorModelPricingSlug } from '@/constants/cursorModelPricingUsdPer1M';
import type {
  CursorAnalyticsByDayModelRequests,
  CursorAnalyticsModelDayBreakdown,
  CursorAnalyticsSummary,
} from '@/types/cursorAnalytics';

import { eachIsoDayInclusive } from '@/utils/cursorAnalyticsTeamTrend';

/** Weighted blend of list input vs output $/1M when CSV has no token split. */
const ESTIMATE_INPUT_WEIGHT = 0.65;
const ESTIMATE_OUTPUT_WEIGHT = 0.35;

/** Assumed tokens per usage request when CSV only reports request counts (no token fields). */
const DEFAULT_TOKENS_PER_REQUEST = 28_000;

/**
 * When a day has team usage but **no** `model_breakdown`, impute using list **Auto + Composer pool** rates (not a
 * single cheap API model) — matches Cursor docs “Auto pricing” for typical editor usage.
 */
const DEFAULT_PRICING_SLUG_FOR_SYNTHETIC = '__auto_composer_pool__';

/** Optional overrides by canonical pricing slug (after alias resolution). */
const TOKENS_PER_REQUEST_BY_CANONICAL: Readonly<Record<string, number>> = {
  __auto_composer_pool__: 32_000,
  'gpt-5.5': 32_000,
  'gpt-5.4': 28_000,
  'gpt-5.2': 26_000,
  'gpt-5.1-codex': 28_000,
  'gpt-5-codex': 28_000,
  'gpt-5-mini': 14_000,
  'composer-2': 18_000,
  'claude-4.5-opus': 30_000,
  __fallback__: 22_000,
};

export type CsvMoneyImputationMode = 'none' | 'rate_from_model_days' | 'default_pricing';

export interface CsvMoneyEstimateMeta {
  unknownModels: string[];
  daysWithModelBreakdown: number;
  daysMissingBreakdownInRange: number;
  calibrationApplied: boolean;
  calibrationK: number | null;
  /** Days where team CSV had usage requests but no model JSON — filled from empirical $/req or list pricing. */
  daysImputedFromUsage: number;
  imputationMode: CsvMoneyImputationMode;
  /** Days where team CSV usage requests exceeded summed model `requests` and model cents were scaled up. */
  daysScaledToTeamUsageLine: number;
}

export interface CsvMoneyEstimateResult {
  byDayCents: Record<string, number>;
  usdByDay: Record<string, number>;
  totalRangeCents: number;
  meta: CsvMoneyEstimateMeta;
}

function blendedUsdPer1MForEstimate(rate: ReturnType<typeof getCursorModelUsdPer1M>): number {
  return ESTIMATE_INPUT_WEIGHT * rate.inputPer1M + ESTIMATE_OUTPUT_WEIGHT * rate.outputPer1M;
}

function tokensPerRequestForCanonical(canonical: string): number {
  const o = TOKENS_PER_REQUEST_BY_CANONICAL[canonical];
  if (typeof o === 'number' && Number.isFinite(o) && o > 0) return o;
  const fb = TOKENS_PER_REQUEST_BY_CANONICAL.__fallback__;
  if (typeof fb === 'number' && Number.isFinite(fb) && fb > 0) return fb;
  return DEFAULT_TOKENS_PER_REQUEST;
}

function estimateModelRowCents(
  rawSlug: string,
  row: CursorAnalyticsModelDayBreakdown,
  unknownSet: Set<string>,
): number {
  const rate = getCursorModelUsdPer1M(rawSlug);
  const canonical = resolveCursorModelPricingSlug(rawSlug);
  if (canonical === '__fallback__') {
    unknownSet.add(rawSlug);
  }

  const inputT = row.inputTokens;
  const outputT = row.outputTokens;
  const totalT = row.totalTokens;

  if (typeof inputT === 'number' && Number.isFinite(inputT) && inputT > 0) {
    const outN = typeof outputT === 'number' && Number.isFinite(outputT) && outputT >= 0 ? outputT : 0;
    const usd = (inputT / 1_000_000) * rate.inputPer1M + (outN / 1_000_000) * rate.outputPer1M;
    return Math.round(usd * 100);
  }

  if (typeof totalT === 'number' && Number.isFinite(totalT) && totalT > 0) {
    const blendedPer1M = blendedUsdPer1MForEstimate(rate);
    const usd = (totalT / 1_000_000) * blendedPer1M;
    return Math.round(usd * 100);
  }

  const requests = row.requests;
  if (!Number.isFinite(requests) || requests <= 0) return 0;
  const blendedPer1M = blendedUsdPer1MForEstimate(rate);
  const tpr = tokensPerRequestForCanonical(canonical);
  const estTokens = requests * tpr;
  const usd = (estTokens / 1_000_000) * blendedPer1M;
  return Math.round(usd * 100);
}

function estimateDayRawCentsFromModels(
  day: string,
  byDayModelRequests: CursorAnalyticsByDayModelRequests | undefined,
  unknownSet: Set<string>,
): number {
  if (!byDayModelRequests) return 0;
  const models = byDayModelRequests[day];
  if (!models || Object.keys(models).length === 0) return 0;
  let cents = 0;
  for (const [rawSlug, row] of Object.entries(models)) {
    cents += estimateModelRowCents(rawSlug, row, unknownSet);
  }
  return cents;
}

function usageRequestsForDay(summary: CursorAnalyticsSummary, day: string): number {
  const b = summary.byDay[day];
  const a = b?.amount;
  return typeof a === 'number' && Number.isFinite(a) && a > 0 ? Math.round(a) : 0;
}

/** Sum of `requests` in model_breakdown for the day (Cursor often reports fewer than team "Chats Usage Based Requests"). */
function modelRequestSumForDay(byDayModels: Record<string, CursorAnalyticsModelDayBreakdown> | undefined): number {
  if (!byDayModels) return 0;
  let n = 0;
  for (const row of Object.values(byDayModels)) {
    const r = row.requests;
    if (typeof r === 'number' && Number.isFinite(r) && r > 0) n += Math.round(r);
  }
  return n;
}

/**
 * When team daily **Chats Usage Based Requests** exceeds the sum of per-model `requests` in the JSON, model-derived
 * cents are scaled up so the day reflects full CSV volume (model mix is held constant).
 */
function scaleModelCentsToTeamUsageLine(
  day: string,
  modelCents: number,
  summary: CursorAnalyticsSummary,
  byDayModels: Record<string, CursorAnalyticsModelDayBreakdown> | undefined,
): number {
  const teamUsage = usageRequestsForDay(summary, day);
  const modelReqSum = modelRequestSumForDay(byDayModels);
  if (modelCents <= 0 || teamUsage <= 0 || modelReqSum <= 0) return modelCents;
  if (teamUsage <= modelReqSum) return modelCents;
  return Math.round(modelCents * (teamUsage / modelReqSum));
}

function defaultSyntheticCentsPerUsageRequest(): number {
  const raw = DEFAULT_PRICING_SLUG_FOR_SYNTHETIC;
  const canonical = resolveCursorModelPricingSlug(raw);
  const rate = getCursorModelUsdPer1M(raw);
  const blended = blendedUsdPer1MForEstimate(rate);
  const tpr = tokensPerRequestForCanonical(canonical);
  const usd = (tpr / 1_000_000) * blended;
  return Math.max(1, Math.round(usd * 100));
}

/**
 * Spread model-derived dollars across days that have **team usage** in `summary.byDay` but no (or zero)
 * model-breakdown estimate, using empirical cents/request from days where both exist; otherwise list pricing.
 */
function applyUsageImputation(
  days: string[],
  rawByDay: Record<string, number>,
  summary: CursorAnalyticsSummary,
): { byDay: Record<string, number>; imputedDays: number; mode: CsvMoneyImputationMode } {
  const out: Record<string, number> = { ...rawByDay };
  let sumRawOnModelDays = 0;
  let sumUsageOnModelDays = 0;

  for (const d of days) {
    const raw = rawByDay[d] ?? 0;
    const u = usageRequestsForDay(summary, d);
    if (raw > 0 && u > 0) {
      sumRawOnModelDays += raw;
      sumUsageOnModelDays += u;
    }
  }

  let centsPerUsage: number | null = null;
  let mode: CsvMoneyImputationMode = 'none';

  if (sumRawOnModelDays > 0 && sumUsageOnModelDays > 0) {
    centsPerUsage = sumRawOnModelDays / sumUsageOnModelDays;
    mode = 'rate_from_model_days';
  } else {
    centsPerUsage = defaultSyntheticCentsPerUsageRequest();
    mode = 'default_pricing';
  }

  let imputedDays = 0;
  for (const d of days) {
    const raw = rawByDay[d] ?? 0;
    const u = usageRequestsForDay(summary, d);
    if (raw <= 0 && u > 0 && centsPerUsage != null && Number.isFinite(centsPerUsage) && centsPerUsage > 0) {
      out[d] = Math.round(centsPerUsage * u);
      imputedDays += 1;
    }
  }

  if (imputedDays === 0) {
    mode = 'none';
  }

  return { byDay: out, imputedDays, mode };
}

function calibrationFactor(
  days: string[],
  rawByDay: Record<string, number>,
  chargedByDayCents: Record<string, number>,
): { k: number | null; applied: boolean } {
  let sumOverlapCharged = 0;
  let sumOverlapRaw = 0;
  let sumRangeCharged = 0;
  let sumRangeRaw = 0;

  for (const d of days) {
    const ch = chargedByDayCents[d] ?? 0;
    const raw = rawByDay[d] ?? 0;
    if (ch > 0) sumRangeCharged += ch;
    if (raw > 0) sumRangeRaw += raw;
    if (ch > 0 && raw > 0) {
      sumOverlapCharged += ch;
      sumOverlapRaw += raw;
    }
  }

  let k: number | null = null;
  if (sumOverlapRaw > 0 && sumOverlapCharged > 0) {
    k = sumOverlapCharged / sumOverlapRaw;
  } else if (sumRangeRaw > 0 && sumRangeCharged > 0) {
    k = sumRangeCharged / sumRangeRaw;
  }

  return { k, applied: k != null && Number.isFinite(k) && k > 0 };
}

/**
 * Team **Chats Usage Based Requests** in the selected UTC range (`summary.byDay[].amount`).
 */
export function sumUsageRequestsInRange(summary: CursorAnalyticsSummary, range: { startDate: string; endDate: string }): number {
  let n = 0;
  for (const d of eachIsoDayInclusive(range.startDate, range.endDate)) {
    n += usageRequestsForDay(summary, d);
  }
  return n;
}

/**
 * CSV model (and optional token) data × public list rates, with **usage imputation** for days missing model JSON,
 * optionally **scaled** to Admin API `chargedByDay` when provided and complete.
 */
export function computeCsvMoneyEstimate(options: {
  summary: CursorAnalyticsSummary;
  range: { startDate: string; endDate: string };
  /** When present and not truncated, used to derive calibration `k` (optional). */
  chargedByDayCents?: Record<string, number>;
  /** When true, skip calibration even if charged cents exist (e.g. incomplete events). */
  disableCalibration?: boolean;
}): CsvMoneyEstimateResult {
  const { summary, range, chargedByDayCents, disableCalibration } = options;
  const days = eachIsoDayInclusive(range.startDate, range.endDate);
  const byDayModelRequests = summary.byDayModelRequests;

  const unknownSet = new Set<string>();
  const modelOnlyRaw: Record<string, number> = {};
  let daysWithModelBreakdown = 0;
  let daysScaledToTeamUsageLine = 0;

  for (const d of days) {
    const rawModel = estimateDayRawCentsFromModels(d, byDayModelRequests, unknownSet);
    const models = byDayModelRequests?.[d];
    const scaled = scaleModelCentsToTeamUsageLine(d, rawModel, summary, models);
    if (scaled !== rawModel && scaled > rawModel) daysScaledToTeamUsageLine += 1;
    modelOnlyRaw[d] = scaled;
    const m = byDayModelRequests?.[d];
    if (m && Object.keys(m).length > 0) {
      const hasReq = Object.values(m).some((row) => row.requests > 0);
      if (hasReq) daysWithModelBreakdown += 1;
    }
  }

  const { byDay: afterImpute, imputedDays, mode: imputationMode } = applyUsageImputation(days, modelOnlyRaw, summary);

  const { k, applied } =
    !disableCalibration && chargedByDayCents && Object.keys(chargedByDayCents).length > 0
      ? calibrationFactor(days, afterImpute, chargedByDayCents)
      : { k: null, applied: false };

  const factor = applied && k != null && Number.isFinite(k) && k > 0 ? k : 1;

  const byDayCents: Record<string, number> = {};
  let totalRangeCents = 0;
  for (const d of days) {
    const v = Math.round((afterImpute[d] ?? 0) * factor);
    byDayCents[d] = v;
    totalRangeCents += v;
  }

  const usdByDay: Record<string, number> = {};
  for (const d of days) {
    usdByDay[d] = (byDayCents[d] ?? 0) / 100;
  }

  const meta: CsvMoneyEstimateMeta = {
    unknownModels: [...unknownSet].sort(),
    daysWithModelBreakdown,
    daysMissingBreakdownInRange: Math.max(0, days.length - daysWithModelBreakdown),
    calibrationApplied: applied && factor !== 1,
    calibrationK: applied && k != null && Number.isFinite(k) ? k : null,
    daysImputedFromUsage: imputedDays,
    imputationMode,
    daysScaledToTeamUsageLine,
  };

  return { byDayCents, usdByDay, totalRangeCents, meta };
}
