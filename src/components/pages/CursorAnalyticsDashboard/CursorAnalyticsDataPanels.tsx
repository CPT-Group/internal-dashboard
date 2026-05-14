'use client';

import { useCallback, useMemo, useRef } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Message } from 'primereact/message';
import { TabPanel, TabView } from 'primereact/tabview';

import type { CursorBillingSnapshot, CursorTeamMemberSpend } from '@/lib/cursorAdminApi';
import type { CursorEnterpriseAgentEditDay, CursorEnterpriseFetchResult } from '@/lib/cursorAnalyticsEnterpriseApi';
import type { CursorAnalyticsMonetarySource, CursorAnalyticsSummary } from '@/types/cursorAnalytics';
import { isCursorChargedByDayTruncated } from '@/utils/cursorAnalyticsBillingGuards';
import { formatUsdFromCents } from '@/utils/cursorBillingFormat';
import type { CsvMoneyEstimateResult } from '@/utils/cursorAnalyticsCsvModelMoneyEstimate';
import { teamDailyUsdTrendHybrid } from '@/utils/cursorAnalyticsDailyCostTrend';
import { buildDeveloperMoneyRangeRows } from '@/utils/cursorAnalyticsMonetaryJoin';
import { eachIsoDayInclusive } from '@/utils/cursorAnalyticsTeamTrend';
import { downloadCsv, rowsToCsv } from '@/utils/csvDownload';

import { CursorAnalyticsMonetaryRangePanel } from './CursorAnalyticsMonetaryRangePanel';
import { CursorSpendTrendChart } from './CursorSpendTrendChart';
import type { CursorSpendTrendDataSource } from './CursorSpendTrendChart';
import styles from './CursorAnalyticsDashboard.module.scss';

function rangeFileToken(r: { startDate: string; endDate: string }): string {
  return `${r.startDate.replace(/:/g, '-')}_${r.endDate.replace(/:/g, '-')}`;
}

export interface CursorAnalyticsDataPanelsProps {
  summary: CursorAnalyticsSummary;
  enterprise: CursorEnterpriseFetchResult | undefined;
  billing: CursorBillingSnapshot | undefined;
  range: { startDate: string; endDate: string };
  monetarySource: CursorAnalyticsMonetarySource;
  csvMoneyEstimate: CsvMoneyEstimateResult | null;
}

function spendCell(row: CursorTeamMemberSpend) {
  return formatUsdFromCents(row.spendCents);
}

function overallCell(row: CursorTeamMemberSpend) {
  return formatUsdFromCents(row.overallSpendCents);
}

function chargedRangeCell(row: CursorTeamMemberSpend & { chargedRangeCents: number }) {
  return formatUsdFromCents(row.chargedRangeCents);
}

function centsCell<T extends { chargedCents: number }>(row: T) {
  return formatUsdFromCents(row.chargedCents);
}

function pctRepoBody(row: { pctOfRepo: number | null }) {
  if (row.pctOfRepo == null) return '—';
  return `${row.pctOfRepo.toFixed(1)}%`;
}

type RepoMoneyBasis = 'usage_events' | 'ai_lines_share' | 'ai_lines_csv_estimate';

interface RepoMoneyRow {
  repo: string;
  chargedCents: number;
  dataBasis: RepoMoneyBasis;
}

interface RepoDevMoneyRow {
  repo: string;
  developer: string;
  chargedCents: number;
  dataBasis: RepoMoneyBasis;
}

function dataBasisBody(row: { dataBasis: RepoMoneyBasis }) {
  if (row.dataBasis === 'usage_events') return 'Usage events';
  if (row.dataBasis === 'ai_lines_csv_estimate') return 'AI lines × CSV est. total';
  return 'AI lines × charged (est.)';
}

export const CursorAnalyticsDataPanels = ({
  summary,
  enterprise,
  billing,
  range,
  monetarySource,
  csvMoneyEstimate,
}: CursorAnalyticsDataPanelsProps) => {
  const spendMembersDtRef = useRef<DataTable<(CursorTeamMemberSpend & { chargedRangeCents: number })[]> | null>(null);
  const requestsByDevDtRef = useRef<
    DataTable<{ developer: string; usageReqs: number; includedReqs: number; chargedCents: number }[]> | null
  >(null);
  const chargedByDevDtRef = useRef<DataTable<{ developer: string; chargedCents: number }[]> | null>(null);
  const reposDtRef = useRef<DataTable<RepoMoneyRow[]> | null>(null);
  const repoDevDtRef = useRef<
    DataTable<{ repo: string; developer: string; chargedCents: number; dataBasis: RepoMoneyBasis; pctOfRepo: number | null }[]> | null
  >(null);
  const monthDevDtRef = useRef<DataTable<{ month: string; developer: string; chargedCents: number }[]> | null>(null);
  const byMonthDtRef = useRef<DataTable<{ month: string; chargedCents: number }[]> | null>(null);
  const enterpriseDtRef = useRef<DataTable<CursorEnterpriseAgentEditDay[]> | null>(null);

  const csvBaselinePeriod = useMemo(() => {
    const months = Object.keys(summary.byMonth).sort();
    if (months.length === 0) return '—';
    if (months.length === 1) return months[0] ?? '—';
    return `${months[0]} → ${months[months.length - 1]}`;
  }, [summary.byMonth]);

  const useCsvMoney = monetarySource === 'csv_estimate' && csvMoneyEstimate != null;

  const billingChargedByDay =
    billing?.chargedByDay.ok === true ? billing.chargedByDay.data.byDay : {};
  const chargedTruncated = isCursorChargedByDayTruncated(billing);

  const billingMessages = useMemo(() => {
    if (!billing) return [];
    const out: string[] = [];
    if (!billing.spend.ok) {
      out.push(`Billing · team cycle spend: ${billing.spend.status || '—'} — ${billing.spend.message}`);
    }
    if (!billing.dailyByDay.ok) {
      out.push(`Billing · daily usage: ${billing.dailyByDay.status || '—'} — ${billing.dailyByDay.message}`);
    }
    if (!billing.chargedByDay.ok) {
      out.push(`Billing · usage events: ${billing.chargedByDay.status || '—'} — ${billing.chargedByDay.message}`);
    }
    if (billing.chargedByDay.ok && billing.chargedByDay.data.warnings) {
      for (const w of billing.chargedByDay.data.warnings) {
        out.push(`Billing · ${w}`);
      }
    }
    if (billing.chargedByDay.ok && chargedTruncated) {
      const reported = billing.chargedByDay.data.usageEventsTotalReported;
      const reportedPart =
        typeof reported === 'number' && reported > 0
          ? ` API reported ${reported.toLocaleString()} events in range vs ${billing.chargedByDay.data.eventsRead.toLocaleString()} rows parsed.`
          : '';
      out.push(
        `Billing · usage events incomplete — daily $ and repo splits may be wrong.${reportedPart} Raise CURSOR_ANALYTICS_USAGE_EVENTS_MAX_PAGES_PER_DAY, narrow the date range, or rely on disk cache after a full pull completes.`,
      );
    }
    return out;
  }, [billing, chargedTruncated]);

  const spendMembers = useMemo((): CursorTeamMemberSpend[] => {
    if (!billing?.spend.ok) return [];
    return [...billing.spend.data.members].sort((a, b) => b.overallSpendCents - a.overallSpendCents);
  }, [billing]);

  const showFastPremiumRequestsColumn = useMemo(
    () => spendMembers.some((m) => m.fastPremiumRequests !== 0),
    [spendMembers],
  );

  const usageEventsRead = billing?.chargedByDay.ok === true ? billing.chargedByDay.data.eventsRead : 0;

  const usageEventsRepoLoadHint = useMemo((): string => {
    if (!billing?.chargedByDay.ok) {
      return 'Usage events are unavailable — fix billing errors above to load repo-level charges.';
    }
    if (chargedTruncated) {
      return `Usage events are incomplete for this range (per-day API pagination or parse mismatch). Repo totals may be wrong — raise CURSOR_ANALYTICS_USAGE_EVENTS_MAX_PAGES_PER_DAY, narrow dates, or wait for cache after a successful full pull.`;
    }
    if (usageEventsRead === 0) {
      return 'No usage events returned for this date range. Widen the range or confirm the Admin API key can read /teams/filtered-usage-events.';
    }
    return 'Events loaded, but no repository/workspace field matched our parsers — the payload may omit repo, or use a new shape. A dedicated repo AI-edits CSV in the summary folder still works as a fallback when present.';
  }, [billing, usageEventsRead, chargedTruncated]);

  const chargedByDeveloper = useMemo(() => {
    if (!billing?.chargedByDay.ok) return [];
    return Object.entries(billing.chargedByDay.data.byDeveloper)
      .map(([developer, chargedCents]) => ({ developer, chargedCents }))
      .sort((a, b) => b.chargedCents - a.chargedCents);
  }, [billing]);

  const requestsByDeveloper = useMemo(() => {
    if (!billing?.dailyByDay.ok) return [];
    return Object.entries(billing.dailyByDay.data.developerByDay)
      .map(([developer, perDev]) => {
        const usageReqs = Object.values(perDev.usageBasedByDay).reduce((sum, value) => sum + value, 0);
        const includedReqs = Object.values(perDev.includedByDay).reduce((sum, value) => sum + value, 0);
        const chargedCents =
          billing.chargedByDay.ok === true ? (billing.chargedByDay.data.byDeveloper[developer] ?? 0) : 0;
        return { developer, usageReqs, includedReqs, chargedCents };
      })
      .sort((a, b) => b.usageReqs - a.usageReqs);
  }, [billing]);

  const chargedByRepo = useMemo(() => {
    if (!billing?.chargedByDay.ok) return [];
    return Object.entries(billing.chargedByDay.data.byRepo)
      .map(([repo, chargedCents]) => ({ repo, chargedCents }))
      .sort((a, b) => b.chargedCents - a.chargedCents);
  }, [billing]);

  const chargedTotalCents = useMemo(() => {
    if (useCsvMoney && csvMoneyEstimate) return csvMoneyEstimate.totalRangeCents;
    if (!billing?.chargedByDay.ok) return null;
    return Object.values(billing.chargedByDay.data.byDay).reduce((sum, value) => sum + value, 0);
  }, [billing, useCsvMoney, csvMoneyEstimate]);

  const allocatedRepoRows = useMemo(() => {
    const repoMap = summary.repoAiEdits ?? {};
    const rows = Object.entries(repoMap).map(([repo, metric]) => ({ repo, ...metric }));
    const totalAiLines = rows.reduce((sum, row) => sum + row.aiLines, 0);
    if (chargedTotalCents == null || chargedTotalCents <= 0 || totalAiLines <= 0) return [];
    return rows
      .map((row) => ({
        repo: row.repo,
        chargedCents: (row.aiLines / totalAiLines) * chargedTotalCents,
      }))
      .sort((a, b) => b.chargedCents - a.chargedCents);
  }, [summary.repoAiEdits, chargedTotalCents]);

  const chargedByRepoDeveloper = useMemo(() => {
    if (!billing?.chargedByDay.ok) return [];
    return Object.entries(billing.chargedByDay.data.byRepoDeveloper)
      .map(([key, chargedCents]) => {
        const [repo, ...rest] = key.split('\t');
        return { repo: repo ?? key, developer: rest.join('\t'), chargedCents };
      })
      .sort((a, b) => b.chargedCents - a.chargedCents);
  }, [billing]);

  const allocatedRepoDeveloperRows = useMemo(() => {
    const byKey = summary.repoDeveloperAiEdits ?? {};
    const rows = Object.entries(byKey).map(([key, metric]) => {
      const [repo, ...rest] = key.split('\t');
      return { repo: repo ?? key, developer: rest.join('\t'), ...metric };
    });
    const totalAiLines = rows.reduce((sum, row) => sum + row.aiLines, 0);
    if (chargedTotalCents == null || chargedTotalCents <= 0 || totalAiLines <= 0) return [];
    return rows
      .map((row) => ({
        repo: row.repo,
        developer: row.developer,
        chargedCents: (row.aiLines / totalAiLines) * chargedTotalCents,
      }))
      .sort((a, b) => b.chargedCents - a.chargedCents);
  }, [summary.repoDeveloperAiEdits, chargedTotalCents]);

  const repoMoneyRows = useMemo((): RepoMoneyRow[] => {
    if (useCsvMoney) {
      if (allocatedRepoRows.length > 0) {
        return allocatedRepoRows.map((r) => ({ ...r, dataBasis: 'ai_lines_csv_estimate' as const }));
      }
      return [];
    }
    if (chargedByRepo.length > 0) {
      return chargedByRepo.map((r) => ({ ...r, dataBasis: 'usage_events' as const }));
    }
    return allocatedRepoRows.map((r) => ({ ...r, dataBasis: 'ai_lines_share' as const }));
  }, [useCsvMoney, chargedByRepo, allocatedRepoRows]);

  const repoDevMoneyRows = useMemo((): RepoDevMoneyRow[] => {
    if (useCsvMoney) {
      if (allocatedRepoDeveloperRows.length > 0) {
        return allocatedRepoDeveloperRows.map((r) => ({ ...r, dataBasis: 'ai_lines_csv_estimate' as const }));
      }
      return [];
    }
    if (chargedByRepoDeveloper.length > 0) {
      return chargedByRepoDeveloper.map((r) => ({ ...r, dataBasis: 'usage_events' as const }));
    }
    return allocatedRepoDeveloperRows.map((r) => ({ ...r, dataBasis: 'ai_lines_share' as const }));
  }, [useCsvMoney, chargedByRepoDeveloper, allocatedRepoDeveloperRows]);

  const repoTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of repoDevMoneyRows) {
      totals[row.repo] = (totals[row.repo] ?? 0) + row.chargedCents;
    }
    return totals;
  }, [repoDevMoneyRows]);

  const repoDeveloperRowsWithPct = useMemo(() => {
    return repoDevMoneyRows.map((row) => {
      const total = repoTotals[row.repo] ?? 0;
      const pctOfRepo = total > 0 ? (row.chargedCents / total) * 100 : null;
      return { ...row, pctOfRepo };
    });
  }, [repoDevMoneyRows, repoTotals]);

  const developerMoneyRangeRows = useMemo(() => {
    if (!billing?.spend.ok || !billing.chargedByDay.ok || !billing.dailyByDay.ok) return [];
    return buildDeveloperMoneyRangeRows({
      spendMembers: billing.spend.data.members,
      chargedByDeveloper: billing.chargedByDay.data.byDeveloper,
      developerByDay: billing.dailyByDay.data.developerByDay,
      range,
    });
  }, [billing, range]);

  const chargedByMonthDeveloper = useMemo(() => {
    if (!billing?.chargedByDay.ok) return [];
    return Object.entries(billing.chargedByDay.data.byMonthDeveloper)
      .map(([key, chargedCents]) => {
        const [month, ...rest] = key.split('\t');
        return { month: month ?? key, developer: rest.join('\t'), chargedCents };
      })
      .sort((a, b) => b.chargedCents - a.chargedCents);
  }, [billing]);

  const chargedByMonth = useMemo(() => {
    if (useCsvMoney && csvMoneyEstimate) {
      const map: Record<string, number> = {};
      for (const [day, cents] of Object.entries(csvMoneyEstimate.byDayCents)) {
        if (day.length < 7) continue;
        const mk = day.slice(0, 7);
        map[mk] = (map[mk] ?? 0) + cents;
      }
      return Object.entries(map)
        .map(([month, chargedCents]) => ({ month, chargedCents }))
        .sort((a, b) => a.month.localeCompare(b.month));
    }
    if (!billing?.chargedByDay.ok) return [];
    return Object.entries(billing.chargedByDay.data.byMonth)
      .map(([month, chargedCents]) => ({ month, chargedCents }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [billing, useCsvMoney, csvMoneyEstimate]);

  const enterpriseRows = useMemo(() => {
    if (!enterprise?.ok) return [];
    return [...enterprise.agentEdits].sort((a, b) => b.event_date.localeCompare(a.event_date));
  }, [enterprise]);

  const spendMemberRows = useMemo(() => {
    if (!billing?.spend.ok) return [];
    const byEmail =
      billing.chargedByDay.ok === true ? billing.chargedByDay.data.byDeveloper : null;
    return spendMembers.map((m) => ({
      ...m,
      chargedRangeCents: byEmail != null ? (byEmail[m.email.trim().toLowerCase()] ?? 0) : 0,
    }));
  }, [billing, spendMembers]);

  const hybridDailyTrend = useMemo(() => {
    if (useCsvMoney) return null;
    if (!billing) return null;
    return teamDailyUsdTrendHybrid({
      range,
      chargedByDayCents: billingChargedByDay,
      summary,
      disableCsvDollarBackfill: chargedTruncated,
    });
  }, [billing, range, summary, billingChargedByDay, chargedTruncated, useCsvMoney]);

  const trendUsdByDay = useMemo(() => {
    if (useCsvMoney && csvMoneyEstimate) return csvMoneyEstimate.usdByDay;
    return hybridDailyTrend?.usdByDay ?? {};
  }, [hybridDailyTrend, useCsvMoney, csvMoneyEstimate]);

  const trendDataSource = useMemo((): CursorSpendTrendDataSource => {
    if (useCsvMoney && csvMoneyEstimate) {
      return csvMoneyEstimate.meta.calibrationApplied ? 'csv_model_estimate_calibrated' : 'csv_model_estimate';
    }
    return hybridDailyTrend?.source ?? 'usage_events';
  }, [hybridDailyTrend, useCsvMoney, csvMoneyEstimate]);

  const comparisonUsdByDay = useMemo((): Record<string, number> | undefined => {
    if (!useCsvMoney || !billing?.chargedByDay.ok) return undefined;
    const days = eachIsoDayInclusive(range.startDate, range.endDate);
    const out: Record<string, number> = {};
    for (const d of days) {
      const c = billing.chargedByDay.data.byDay[d] ?? 0;
      if (c > 0) out[d] = c / 100;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }, [useCsvMoney, billing, range.startDate, range.endDate]);

  const exportTrendDailyCsv = useCallback(() => {
    const keys = [...Object.keys(trendUsdByDay)].sort();
    const rows = keys.map((date) => [date, trendUsdByDay[date] ?? 0] as [string, number]);
    downloadCsv(
      `cursor-analytics-trend-daily_${rangeFileToken(range)}.csv`,
      rowsToCsv(['date', 'team_cost_usd'], rows),
    );
  }, [trendUsdByDay, range]);

  const csvEstimateBanner = useMemo(() => {
    if (!useCsvMoney || !csvMoneyEstimate) return null;
    const m = csvMoneyEstimate.meta;
    const unknownPart =
      m.unknownModels.length > 0
        ? ` Unknown model slugs (fallback list rate): ${m.unknownModels.join(', ')}.`
        : '';
    const calPart =
      m.calibrationApplied && m.calibrationK != null
        ? ` Overlap calibration k≈${m.calibrationK.toFixed(4)} applied vs Admin API charged cents where both series have data.`
        : chargedTruncated
          ? ' Calibration skipped: usage events incomplete for this range (see billing warnings).'
          : ' No calibration applied (toggle Monetary to API + Refresh to load billing, or overlap was unusable).';
    const scalePart =
      m.daysScaledToTeamUsageLine > 0
        ? ` ${String(m.daysScaledToTeamUsageLine)} day(s): team Chats Usage Based Requests exceeded summed model requests in the export — that day’s model dollars were scaled up to match the CSV usage line (same model mix, full request volume).`
        : '';
    const imputePart =
      m.daysImputedFromUsage > 0
        ? ` ${String(m.daysImputedFromUsage)} day(s): team usage in the CSV but no usable model_breakdown — dollars imputed using ${
            m.imputationMode === 'rate_from_model_days'
              ? 'average cents per usage-request from days that had per-model data'
              : 'list pricing (default model blend × assumed tokens/request)'
          }.`
        : '';
    return `CSV mode — estimates from the team export + public list $/M (not Cursor billing). ${String(m.daysWithModelBreakdown)} days with per-model rows in range.${scalePart}${imputePart}${calPart}${unknownPart}`;
  }, [useCsvMoney, csvMoneyEstimate, chargedTruncated]);

  return (
    <section className={styles.dataSection} aria-label="Cursor analytics detail">
      {billingMessages.map((text) => (
        <Message key={text} className={styles.apiMessage} severity="warn" text={text} />
      ))}
      {enterprise && !enterprise.ok ? (
        <Message
          className={styles.apiMessage}
          severity="warn"
          text={`Enterprise Analytics (opt-in · agent-edits): ${enterprise.status || '—'} — ${enterprise.message}`}
        />
      ) : null}
      {csvEstimateBanner ? (
        <Message className={styles.apiMessage} severity="info" text={csvEstimateBanner} />
      ) : null}
      <TabView className={styles.tabView}>
        <TabPanel header="Trend (daily)">
          {useCsvMoney ? (
            <p className={styles.hint}>
              Range: <strong>{range.startDate}</strong> → <strong>{range.endDate}</strong>. Solid line:{' '}
              <strong>estimated team USD/day</strong> from <code>byDayModelRequests</code> (Models Time Series): per-model
              list $/M on <strong>input/output tokens</strong> when the export includes them, otherwise requests × assumed
              tokens/request. Days without model JSON but with team daily usage get <strong>imputed</strong> dollars from
              the average cents/request on days that do have model data (or list-default pricing). Optional dashed line:
              Admin API <code>chargedCents</code> when you load billing (toggle Monetary to API + Refresh). Regenerate{' '}
              <code>cursor-analytics-summary.json</code> after changing exports.
            </p>
          ) : (
            <p className={styles.hint}>
              Range: <strong>{range.startDate}</strong> → <strong>{range.endDate}</strong>. Chart uses{' '}
              <strong>usage-event charged cents per day</strong> (÷ 100 for USD) summed from full per-day pagination of{' '}
              <code>/teams/filtered-usage-events</code>. When event coverage is incomplete, CSV request-count scaling is{' '}
              <strong>disabled</strong> so the chart is not misleading. CSV baseline in summary covers <strong>
                {csvBaselinePeriod}
              </strong>{' '}
              (volume / merge metadata — not raw dollars in export).
            </p>
          )}
          <div className={styles.tabExportBar}>
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="pi pi-download"
              label="Export CSV"
              disabled={Object.keys(trendUsdByDay).length === 0}
              onClick={exportTrendDailyCsv}
            />
          </div>
          <CursorSpendTrendChart
            usdByDay={trendUsdByDay}
            dataSource={trendDataSource}
            chargedTruncated={chargedTruncated}
            comparisonUsdByDay={comparisonUsdByDay}
            comparisonLabel="API (usage events)"
          />
          {!useCsvMoney && chargedTruncated ? (
            <Message
              className={styles.apiMessage}
              severity="error"
              text="Daily team cost may be wrong: usage events were not fully loaded for this range. Fix warnings above, narrow the date range, or increase limits — then Refresh (cached billing may load faster)."
            />
          ) : null}
        </TabPanel>
        <TabPanel header="Money (range)">
          {useCsvMoney ? (
            <Message
              severity="info"
              className={styles.apiMessage}
              text="Per-member cycle spend vs range charged requires Team Admin API (spend + daily usage + usage events). The Analytics Team rollup CSV has no per-email billing — switch Monetary toggle to API for this view."
            />
          ) : developerMoneyRangeRows.length > 0 ? (
            <CursorAnalyticsMonetaryRangePanel rows={developerMoneyRangeRows} />
          ) : (
            <p className={styles.hint}>
              Joined monetary view needs billing <code>spend</code>, <code>daily-usage-data</code>, and{' '}
              <code>filtered-usage-events</code> for this date range — check messages above or Refresh after fixing API
              access.
            </p>
          )}
        </TabPanel>
        <TabPanel header="Developers">
          {useCsvMoney ? (
            <Message
              severity="info"
              className={styles.apiMessage}
              text="Per-developer cycle spend, usage requests, and event charges are not available from the team rollup CSV alone. Switch Monetary toggle to API (or add a per-user export merged into the summary)."
            />
          ) : (
            <>
              {spendMembers.length > 0 ? (
                <>
                  <p className={styles.hint}>
                    Per-member amounts from Cursor billing <code>/teams/spend</code> for the <strong>current subscription cycle only</strong>{' '}
                    (Cursor API field semantics — not lifetime all-time since account creation).{' '}
                    <strong>Charged (range)</strong> is sum of <code>chargedCents</code> from <code>/teams/filtered-usage-events</code> for the
                    selected date range (UTC days), matched by member email.
                  </p>
                  <div className={styles.tabExportBar}>
                    <Button
                      type="button"
                      size="small"
                      severity="secondary"
                      outlined
                      icon="pi pi-download"
                      label="Export cycle spend"
                      onClick={() => spendMembersDtRef.current?.exportCSV({ selectionOnly: false })}
                    />
                  </div>
                  <DataTable
                    ref={spendMembersDtRef}
                    value={spendMemberRows}
                    paginator
                    rows={20}
                    sortMode="multiple"
                    removableSort
                    size="small"
                  >
                    <Column field="name" header="Name" sortable />
                    <Column field="email" header="Email" sortable />
                    <Column field="role" header="Role" sortable />
                    <Column field="spendCents" header="Cycle billed" sortable body={spendCell} />
                    <Column field="overallSpendCents" header="Cycle overall (API)" sortable body={overallCell} />
                    <Column field="chargedRangeCents" header="Charged (range)" sortable body={chargedRangeCell} />
                    {showFastPremiumRequestsColumn ? (
                      <Column field="fastPremiumRequests" header="Fast premium reqs" sortable />
                    ) : null}
                  </DataTable>
                </>
              ) : null}
              {requestsByDeveloper.length > 0 ? (
                <>
                  <div className={`${styles.tabExportBar} ${styles.devTableBlock}`}>
                    <Button
                      type="button"
                      size="small"
                      severity="secondary"
                      outlined
                      icon="pi pi-download"
                      label="Export usage by developer"
                      onClick={() => requestsByDevDtRef.current?.exportCSV({ selectionOnly: false })}
                    />
                  </div>
                  <DataTable
                    ref={requestsByDevDtRef}
                    value={requestsByDeveloper}
                    paginator
                    rows={20}
                    sortMode="multiple"
                    removableSort
                    size="small"
                  >
                    <Column field="developer" header="Developer" sortable />
                    <Column field="usageReqs" header="Usage reqs" sortable />
                    <Column field="includedReqs" header="Included reqs" sortable />
                    <Column field="chargedCents" header="Charged" sortable body={centsCell} />
                  </DataTable>
                </>
              ) : (
                <p className={styles.hint}>
                  Developer usage data is empty for this range.
                </p>
              )}
              {chargedByDeveloper.length > 0 ? (
                <>
                  <div className={`${styles.tabExportBar} ${styles.devTableBlock}`}>
                    <Button
                      type="button"
                      size="small"
                      severity="secondary"
                      outlined
                      icon="pi pi-download"
                      label="Export charged (events)"
                      onClick={() => chargedByDevDtRef.current?.exportCSV({ selectionOnly: false })}
                    />
                  </div>
                  <DataTable
                    ref={chargedByDevDtRef}
                    value={chargedByDeveloper}
                    paginator
                    rows={20}
                    sortMode="multiple"
                    removableSort
                    size="small"
                  >
                    <Column field="developer" header="Developer (events)" sortable />
                    <Column field="chargedCents" header="Charged" sortable body={centsCell} />
                  </DataTable>
                </>
              ) : null}
            </>
          )}
        </TabPanel>
        <TabPanel header="Repos">
          {useCsvMoney ? (
            <p className={styles.hint}>
              CSV estimate mode: dollars are <strong>AI-edit line counts</strong> from the merged summary (repo / repo×dev
              exports) scaled to the <strong>estimated team charged total</strong> for the selected range — not
              per-repository usage events.
            </p>
          ) : (
            <p className={styles.hint}>
              Repo-level cost comes from <code>/teams/filtered-usage-events</code> when repository or workspace fields are
              present (GitHub URLs are normalized to <code>owner/repo</code>). If events omit repo, allocation can fall
              back to a dedicated repo AI-edits CSV merged into the summary.
            </p>
          )}
          {repoMoneyRows.length > 0 ? (
            <>
              <div className={styles.tabExportBar}>
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  icon="pi pi-download"
                  label="Export CSV"
                  onClick={() => reposDtRef.current?.exportCSV({ selectionOnly: false })}
                />
              </div>
              <DataTable
                ref={reposDtRef}
                value={repoMoneyRows}
                paginator
                rows={25}
                sortMode="multiple"
                removableSort
                size="small"
              >
                <Column field="repo" header="Repo" sortable />
                <Column field="chargedCents" header="Charged" sortable body={centsCell} />
                <Column field="dataBasis" header="Basis" sortable body={dataBasisBody} />
              </DataTable>
            </>
          ) : (
            <p className={styles.hint}>
              {useCsvMoney
                ? 'No repo AI-edits metrics in the summary to split the estimated total — add a repo AI-edits CSV export and regenerate cursor-analytics-summary.json, or switch to API mode if usage events include repositories.'
                : usageEventsRepoLoadHint}
            </p>
          )}
        </TabPanel>
        <TabPanel header="Repo × developer">
          {repoDeveloperRowsWithPct.length > 0 ? (
            <>
              <div className={styles.tabExportBar}>
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  icon="pi pi-download"
                  label="Export CSV"
                  onClick={() => repoDevDtRef.current?.exportCSV({ selectionOnly: false })}
                />
              </div>
              <DataTable
                ref={repoDevDtRef}
                value={repoDeveloperRowsWithPct}
                paginator
                rows={25}
                sortMode="multiple"
                removableSort
                size="small"
              >
                <Column field="repo" header="Repo" sortable />
                <Column field="developer" header="Dev" sortable />
                <Column field="chargedCents" header="Charged" sortable body={centsCell} />
                <Column field="dataBasis" header="Basis" sortable body={dataBasisBody} />
                <Column field="pctOfRepo" header="% of repo" sortable body={pctRepoBody} />
              </DataTable>
            </>
          ) : (
            <p className={styles.hint}>
              {useCsvMoney
                ? 'No repo×developer AI-edits metrics in the summary to split the estimated total — merge the appropriate CSV export and regenerate cursor-analytics-summary.json.'
                : `${usageEventsRepoLoadHint} Repo × developer pairs need both a parsed repo and an email on each event.`}
            </p>
          )}
        </TabPanel>
        <TabPanel header="Month × developer">
          {useCsvMoney ? (
            <Message
              severity="info"
              className={styles.apiMessage}
              text="Month × developer charged requires usage events with developer attribution. Switch Monetary toggle to API, or use a tabular export that includes both dimensions."
            />
          ) : chargedByMonthDeveloper.length > 0 ? (
            <>
              <div className={styles.tabExportBar}>
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  icon="pi pi-download"
                  label="Export CSV"
                  onClick={() => monthDevDtRef.current?.exportCSV({ selectionOnly: false })}
                />
              </div>
              <DataTable
                ref={monthDevDtRef}
                value={chargedByMonthDeveloper}
                paginator
                rows={25}
                sortMode="multiple"
                removableSort
                size="small"
              >
                <Column field="month" header="Month" sortable />
                <Column field="developer" header="Dev" sortable />
                <Column field="chargedCents" header="Charged" sortable body={centsCell} />
              </DataTable>
            </>
          ) : (
            <p className={styles.hint}>No month+developer pairs available in usage events for this range.</p>
          )}
        </TabPanel>
        <TabPanel header="By month (cost)">
          <p className={styles.hint}>
            {useCsvMoney
              ? 'Estimated charged totals by calendar month from CSV model pricing (summed daily estimates in the selected range).'
              : 'Charged totals grouped by month for the selected range.'}
          </p>
          {chargedByMonth.length > 0 ? (
            <>
              <div className={styles.tabExportBar}>
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  icon="pi pi-download"
                  label="Export CSV"
                  onClick={() => byMonthDtRef.current?.exportCSV({ selectionOnly: false })}
                />
              </div>
              <DataTable
                ref={byMonthDtRef}
                value={chargedByMonth}
                paginator
                rows={20}
                sortMode="multiple"
                removableSort
                size="small"
              >
                <Column field="month" header="Month" sortable />
                <Column field="chargedCents" header="Charged" sortable body={centsCell} />
              </DataTable>
            </>
          ) : (
            <p className={styles.hint}>No monthly charges in this range.</p>
          )}
        </TabPanel>
        {enterprise?.ok ? (
          <TabPanel header="Enterprise · agent-edits">
            <p className={styles.hint}>
              Line counts only — no USD from this Enterprise endpoint. {enterprise.fetchedAt}
              {enterprise.fromCache ? ' · cached (6h)' : ''}
            </p>
            <div className={styles.tabExportBar}>
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="pi pi-download"
                label="Export CSV"
                onClick={() => enterpriseDtRef.current?.exportCSV({ selectionOnly: false })}
              />
            </div>
            <DataTable
              ref={enterpriseDtRef}
              value={enterpriseRows}
              paginator
              rows={31}
              sortMode="multiple"
              removableSort
              size="small"
            >
              <Column field="event_date" header="Date" sortable />
              <Column field="total_lines_accepted" header="Lines accepted" sortable />
              <Column field="total_lines_suggested" header="Lines suggested" sortable />
            </DataTable>
          </TabPanel>
        ) : null}
      </TabView>
    </section>
  );
};
