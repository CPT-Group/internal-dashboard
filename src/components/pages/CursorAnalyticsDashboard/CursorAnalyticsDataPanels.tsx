'use client';

import { useCallback, useMemo, useRef } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Message } from 'primereact/message';
import { TabPanel, TabView } from 'primereact/tabview';

import type { CursorBillingSnapshot, CursorTeamMemberSpend } from '@/lib/cursorAdminApi';
import type { CursorEnterpriseAgentEditDay, CursorEnterpriseFetchResult } from '@/lib/cursorAnalyticsEnterpriseApi';
import type { CursorAnalyticsSummary } from '@/types/cursorAnalytics';
import { formatUsdFromCents } from '@/utils/cursorBillingFormat';
import { teamCostUsdByDayFromSpendShape } from '@/utils/cursorAnalyticsTeamTrend';
import { downloadCsv, rowsToCsv } from '@/utils/csvDownload';

import { CursorSpendTrendChart } from './CursorSpendTrendChart';
import type { CursorSpendTrendDataSource } from './CursorSpendTrendChart';
import styles from './CursorAnalyticsDashboard.module.scss';

function rangeFileToken(r: { startDate: string; endDate: string }): string {
  return `${r.startDate.replace(/:/g, '-')}_${r.endDate.replace(/:/g, '-')}`;
}

function recordHasPositiveUsd(rec: Record<string, number>): boolean {
  return Object.values(rec).some((v) => Number.isFinite(v) && v > 0);
}

export interface CursorAnalyticsDataPanelsProps {
  summary: CursorAnalyticsSummary;
  enterprise: CursorEnterpriseFetchResult | undefined;
  billing: CursorBillingSnapshot | undefined;
  range: { startDate: string; endDate: string };
}

function spendCell(row: CursorTeamMemberSpend) {
  return formatUsdFromCents(row.spendCents);
}

function overallCell(row: CursorTeamMemberSpend) {
  return formatUsdFromCents(row.overallSpendCents);
}

function centsCell<T extends { chargedCents: number }>(row: T) {
  return formatUsdFromCents(row.chargedCents);
}

function pctRepoBody(row: { pctOfRepo: number | null }) {
  if (row.pctOfRepo == null) return '—';
  return `${row.pctOfRepo.toFixed(1)}%`;
}

export const CursorAnalyticsDataPanels = ({
  summary,
  enterprise,
  billing,
  range,
}: CursorAnalyticsDataPanelsProps) => {
  const spendMembersDtRef = useRef<DataTable<CursorTeamMemberSpend[]> | null>(null);
  const requestsByDevDtRef = useRef<
    DataTable<{ developer: string; usageReqs: number; includedReqs: number; chargedCents: number }[]> | null
  >(null);
  const chargedByDevDtRef = useRef<DataTable<{ developer: string; chargedCents: number }[]> | null>(null);
  const reposDtRef = useRef<DataTable<{ repo: string; chargedCents: number }[]> | null>(null);
  const repoDevDtRef = useRef<
    DataTable<{ repo: string; developer: string; chargedCents: number; pctOfRepo: number | null }[]> | null
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

  const billingChargedByDay =
    billing?.chargedByDay.ok === true ? billing.chargedByDay.data.byDay : {};
  const chargedTruncated =
    billing?.chargedByDay.ok === true ? billing.chargedByDay.data.truncated : false;

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
    return out;
  }, [billing]);

  const spendMembers = useMemo((): CursorTeamMemberSpend[] => {
    if (!billing?.spend.ok) return [];
    return [...billing.spend.data.members].sort((a, b) => b.overallSpendCents - a.overallSpendCents);
  }, [billing]);

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
    if (!billing?.chargedByDay.ok) return null;
    return Object.values(billing.chargedByDay.data.byDay).reduce((sum, value) => sum + value, 0);
  }, [billing]);

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

  const effectiveRepoRows = chargedByRepo.length > 0 ? chargedByRepo : allocatedRepoRows;
  const effectiveRepoDeveloperRows =
    chargedByRepoDeveloper.length > 0 ? chargedByRepoDeveloper : allocatedRepoDeveloperRows;

  const repoTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of effectiveRepoDeveloperRows) {
      totals[row.repo] = (totals[row.repo] ?? 0) + row.chargedCents;
    }
    return totals;
  }, [effectiveRepoDeveloperRows]);

  const repoDeveloperRowsWithPct = useMemo(() => {
    return effectiveRepoDeveloperRows.map((row) => {
      const total = repoTotals[row.repo] ?? 0;
      const pctOfRepo = total > 0 ? (row.chargedCents / total) * 100 : null;
      return { ...row, pctOfRepo };
    });
  }, [effectiveRepoDeveloperRows, repoTotals]);

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
    if (!billing?.chargedByDay.ok) return [];
    return Object.entries(billing.chargedByDay.data.byMonth)
      .map(([month, chargedCents]) => ({ month, chargedCents }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [billing]);

  const enterpriseRows = useMemo(() => {
    if (!enterprise?.ok) return [];
    return [...enterprise.agentEdits].sort((a, b) => b.event_date.localeCompare(a.event_date));
  }, [enterprise]);

  const spendShapedUsdByDay = useMemo(() => {
    if (!billing) return null;
    return teamCostUsdByDayFromSpendShape({
      range,
      spend: billing.spend,
      daily: billing.dailyByDay,
    });
  }, [billing, range]);

  const eventUsdByDay = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [d, cents] of Object.entries(billingChargedByDay)) {
      out[d] = cents / 100;
    }
    return out;
  }, [billingChargedByDay]);

  const trendUsdByDay = useMemo(() => {
    if (spendShapedUsdByDay && recordHasPositiveUsd(spendShapedUsdByDay)) return spendShapedUsdByDay;
    return eventUsdByDay;
  }, [spendShapedUsdByDay, eventUsdByDay]);

  const trendDataSource = useMemo((): CursorSpendTrendDataSource => {
    if (spendShapedUsdByDay && recordHasPositiveUsd(spendShapedUsdByDay)) return 'cycle_usage_share';
    return 'usage_events';
  }, [spendShapedUsdByDay]);

  const exportTrendDailyCsv = useCallback(() => {
    const keys = [...Object.keys(trendUsdByDay)].sort();
    const rows = keys.map((date) => [date, trendUsdByDay[date] ?? 0] as [string, number]);
    downloadCsv(
      `cursor-analytics-trend-daily_${rangeFileToken(range)}.csv`,
      rowsToCsv(['date', 'team_cost_usd'], rows),
    );
  }, [trendUsdByDay, range]);

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
      <TabView className={styles.tabView}>
        <TabPanel header="Trend (daily)">
          <p className={styles.hint}>
            Range: <strong>{range.startDate}</strong> → <strong>{range.endDate}</strong>. CSV baseline in summary covers{' '}
            <strong>{csvBaselinePeriod}</strong> (usage rows only — not the chart source).
          </p>
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
            chargedTruncated={trendDataSource === 'usage_events' ? chargedTruncated : false}
          />
        </TabPanel>
        <TabPanel header="Developers">
          {spendMembers.length > 0 ? (
            <>
              <p className={styles.hint}>
                Current subscription cycle from Cursor billing <code>/teams/spend</code> — official per-member USD
                (integer cents from billing events).
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
                value={spendMembers}
                paginator
                rows={20}
                sortMode="multiple"
                removableSort
                size="small"
              >
                <Column field="name" header="Name" sortable />
                <Column field="email" header="Email" sortable />
                <Column field="role" header="Role" sortable />
                <Column field="spendCents" header="Cycle spend" sortable body={spendCell} />
                <Column field="overallSpendCents" header="Overall" sortable body={overallCell} />
                <Column field="fastPremiumRequests" header="Fast premium reqs" sortable />
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
        </TabPanel>
        <TabPanel header="Repos">
          <p className={styles.hint}>
            Repo-level cost uses Admin usage-event payload when repo fields are present. If repo fields are absent,
            this falls back to allocation by AI-edits share from repo export CSV.
          </p>
          {effectiveRepoRows.length > 0 ? (
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
                value={effectiveRepoRows}
                paginator
                rows={25}
                sortMode="multiple"
                removableSort
                size="small"
              >
                <Column field="repo" header="Repo" sortable />
                <Column field="chargedCents" header="Charged" sortable body={centsCell} />
              </DataTable>
            </>
          ) : (
            <p className={styles.hint}>
              No repo metadata returned by usage events for this range, and no repo export CSV was found.
            </p>
          )}
        </TabPanel>
        <TabPanel header="Repo × developer">
          {effectiveRepoDeveloperRows.length > 0 ? (
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
                <Column field="pctOfRepo" header="% of repo" sortable body={pctRepoBody} />
              </DataTable>
            </>
          ) : (
            <p className={styles.hint}>
              No repo+developer pairs available in usage events for this range, and no repo×developer export CSV was
              found.
            </p>
          )}
        </TabPanel>
        <TabPanel header="Month × developer">
          {chargedByMonthDeveloper.length > 0 ? (
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
            Charged totals grouped by month for the selected range.
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
