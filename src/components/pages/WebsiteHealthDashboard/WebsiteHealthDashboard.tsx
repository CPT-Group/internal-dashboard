'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Dropdown } from 'primereact/dropdown';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import type { ToastMessage } from 'primereact/toast';
import type {
  WebsiteHealthCreateJiraTicketResponse,
  WebsiteHealthDailyReportResponse,
  WebsiteHealthMissingItem,
  WebsiteHealthSiteDetailsResponse,
  WebsiteHealthSiteResult,
  WebsiteHealthSubmissionReportResponse,
  WebsiteHealthSummary,
  WebsiteHealthSummaryResponse,
  WebsiteHealthWebDbIssueItem,
} from '@/types';
import { CopyToClipboardButton } from '@/components/ui';
import { WebsiteHealthInfoHelp } from './WebsiteHealthInfoHelp';
import styles from './WebsiteHealthDashboard.module.scss';

interface SinceDaysOption {
  label: string;
  value: number | null;
}

type DetailsViewMode = 'missing' | 'info';
type DetailsActionMode = DetailsViewMode | 'jira';
interface CreatedTicketDetails {
  issueKey: string;
  issueUrl: string;
}

type WebsiteHealthDetailsSite = WebsiteHealthSiteResult & {
  missingItems: WebsiteHealthMissingItem[];
  webDbIssueItems: WebsiteHealthWebDbIssueItem[];
};

interface WebDbMetricItem {
  label: string;
  value: string;
  note?: string;
}

const SINCE_DAYS_OPTIONS: SinceDaysOption[] = [
  { label: 'Last 1 day', value: 1 },
  { label: 'Last 3 days', value: 3 },
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 14 days', value: 14 },
  { label: 'All submitted', value: null },
];

function formatDateTime(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.valueOf())) return value;
  return dt.toLocaleString();
}

function formatScopeLabel(sinceDays: number | null): string {
  return sinceDays === null ? 'All submitted records' : `Last ${sinceDays} day(s)`;
}

function statusSeverity(site: WebsiteHealthSiteResult): 'success' | 'warning' | 'danger' {
  if (site.status === 'error') return 'danger';
  if (site.status === 'warning') return 'warning';
  return 'success';
}

function webDbStatusSeverity(site: WebsiteHealthSiteResult): 'success' | 'danger' {
  return site.webDbStatus === 'error' ? 'danger' : 'success';
}

function toFetchSinceDaysValue(value: number | null): string {
  return value === null ? 'all' : String(value);
}

export const WebsiteHealthDashboard = () => {
  const toastRef = useRef<Toast | null>(null);
  const [summary, setSummary] = useState<WebsiteHealthSummary | null>(null);
  const [sinceDays, setSinceDays] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningScan, setRunningScan] = useState<boolean>(false);
  const [runningSubmissionReport, setRunningSubmissionReport] = useState<boolean>(false);
  const [runningDailyReport, setRunningDailyReport] = useState<boolean>(false);
  const [detailsVisible, setDetailsVisible] = useState<boolean>(false);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [detailsMode, setDetailsMode] = useState<DetailsViewMode>('missing');
  const [detailsSite, setDetailsSite] = useState<WebsiteHealthDetailsSite | null>(null);
  const [showWebDbIssueRows, setShowWebDbIssueRows] = useState<boolean>(false);
  const [showMissingRowsInInfo, setShowMissingRowsInInfo] = useState<boolean>(false);
  const [createdTicket, setCreatedTicket] = useState<CreatedTicketDetails | null>(null);
  const [detailsActionLoading, setDetailsActionLoading] = useState<{
    siteKey: string;
    mode: DetailsActionMode;
  } | null>(null);

  const showToast = useCallback((message: ToastMessage) => {
    toastRef.current?.show(message);
  }, []);
  const fetchSummary = useCallback(async (days: number | null) => {
    setLoading(true);

    try {
      const qs = new URLSearchParams({ sinceDays: toFetchSinceDaysValue(days) });
      const res = await fetch(`/api/website-health?${qs.toString()}`, { cache: 'no-store' });
      const body = (await res.json()) as WebsiteHealthSummaryResponse | { ok: false; message?: string };

      if (!res.ok || !body.ok) {
        const msg = 'message' in body && typeof body.message === 'string' ? body.message : 'Scan failed.';
        throw new Error(msg);
      }

      setSummary(body.summary);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      showToast({
        severity: 'error',
        summary: 'Unable to load Website Health',
        detail: `Sorry, we couldn't connect right now. Please refresh and try again. ${detail}`,
        life: 6000,
      });
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const runScan = useCallback(async () => {
    setRunningScan(true);
    try {
      const res = await fetch('/api/website-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sinceDays, notify: true }),
      });
      const body = (await res.json()) as WebsiteHealthSummaryResponse | { ok: false; message?: string };

      if (!res.ok || !body.ok) {
        const msg = 'message' in body && typeof body.message === 'string' ? body.message : 'Run failed.';
        throw new Error(msg);
      }

      setSummary(body.summary);
      const compareIssueSites = body.summary.results.filter((site) => site.missingCount > 0).length;
      const webDbIssueSites = body.summary.results.filter((site) => site.webDbStatus === 'error').length;
      const sitesWithAnyIssue = body.summary.sitesWithIssues;
      const hasIssues = body.summary.totalMissingInCleanClaims > 0 || body.summary.sitesWithIssues > 0;
      if (body.alerted && hasIssues) {
        showToast({
          severity: 'warn',
          summary: 'Scan complete',
          detail: `Issues found in ${sitesWithAnyIssue} site(s) (${compareIssueSites} compare, ${webDbIssueSites} Web DB). Teams alert sent.`,
          life: 5000,
        });
      } else if (body.alerted && !hasIssues) {
        showToast({
          severity: 'success',
          summary: 'Scan complete',
          detail: 'Great news — no discrepancies were found. Teams all-clear update sent.',
          life: 4000,
        });
      } else if (body.summary.sitesWithIssues > 0) {
        showToast({
          severity: 'warn',
          summary: 'Scan complete',
          detail:
            body.alertMessage ??
            `Issues found in ${sitesWithAnyIssue} site(s) (${compareIssueSites} compare, ${webDbIssueSites} Web DB). Please review the table for details.`,
          life: 5000,
        });
      } else {
        showToast({
          severity: 'success',
          summary: 'Scan complete',
          detail: 'Great news — no discrepancies were found.',
          life: 3500,
        });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      showToast({
        severity: 'error',
        summary: 'Scan failed',
        detail: `Sorry, the scan could not be completed. ${detail}`,
        life: 6000,
      });
    } finally {
      setRunningScan(false);
    }
  }, [showToast, sinceDays]);

  const runSubmissionReport = useCallback(async () => {
    setRunningSubmissionReport(true);
    try {
      const res = await fetch('/api/website-health/submission-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notify: true }),
      });
      const body = (await res.json()) as
        | WebsiteHealthSubmissionReportResponse
        | { ok: false; message?: string };

      if (!res.ok || !body.ok) {
        const msg = 'message' in body && typeof body.message === 'string' ? body.message : 'Submission report failed.';
        throw new Error(msg);
      }

      if (body.alerted) {
        showToast({
          severity: 'success',
          summary: 'Submission report sent',
          detail:
            `Posted ${body.report.totalSitesChecked} active site rows to Teams ` +
            `(Total ${body.report.totalSubmittedCount}, Today ${body.report.totalSubmittedTodayCount}, Yesterday ${body.report.totalSubmittedYesterdayCount}).`,
          life: 5000,
        });
      } else {
        showToast({
          severity: 'warn',
          summary: 'Submission report generated',
          detail:
            body.alertMessage ??
            'Report generated, but Teams webhook is not configured or notification failed.',
          life: 6000,
        });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      showToast({
        severity: 'error',
        summary: 'Submission report failed',
        detail: `Sorry, we could not send the submission report. ${detail}`,
        life: 6000,
      });
    } finally {
      setRunningSubmissionReport(false);
    }
  }, [showToast]);

  const runDailyReport = useCallback(async () => {
    setRunningDailyReport(true);
    try {
      const res = await fetch('/api/website-health/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notify: true }),
      });
      const body = (await res.json()) as
        | WebsiteHealthDailyReportResponse
        | { ok: false; message?: string };

      if (!res.ok || !body.ok) {
        const msg = 'message' in body && typeof body.message === 'string' ? body.message : 'Daily report failed.';
        throw new Error(msg);
      }

      if (body.alerted) {
        showToast({
          severity: 'success',
          summary: 'Daily report sent',
          detail:
            `Posted ${body.report.totalSitesChecked} active site rows to Teams ` +
            `(Deficient TRUE ${body.report.totalDeficientTrueCount}, Disputed TRUE ${body.report.totalDisputedTrueCount}).`,
          life: 5000,
        });
      } else {
        showToast({
          severity: 'warn',
          summary: 'Daily report generated',
          detail:
            body.alertMessage ??
            'Report generated, but Teams webhook is not configured or notification failed.',
          life: 6000,
        });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      showToast({
        severity: 'error',
        summary: 'Daily report failed',
        detail: `Sorry, we could not send the daily report. ${detail}`,
        life: 6000,
      });
    } finally {
      setRunningDailyReport(false);
    }
  }, [showToast]);

  const openMissingDetails = useCallback(
    async (site: WebsiteHealthSiteResult) => {
      setDetailsActionLoading({ siteKey: site.siteKey, mode: 'missing' });
      setDetailsMode('missing');
      setDetailsVisible(true);
      setDetailsLoading(true);
      setShowMissingRowsInInfo(false);
      setDetailsSite({
        ...site,
        missingItems: [],
        webDbIssueItems: [],
      });

      try {
        const qs = new URLSearchParams({
          siteKey: site.siteKey,
          sinceDays: toFetchSinceDaysValue(sinceDays),
        });
        const res = await fetch(`/api/website-health/site?${qs.toString()}`, {
          cache: 'no-store',
        });
        const body = (await res.json()) as WebsiteHealthSiteDetailsResponse | { ok: false; message?: string };
        if (!res.ok || !body.ok) {
          const msg = 'message' in body && typeof body.message === 'string' ? body.message : 'Unable to fetch details.';
          throw new Error(msg);
        }
        setDetailsSite(body.site);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        showToast({
          severity: 'error',
          summary: 'Could not load case details',
          detail: `Sorry, we couldn't load missing rows for ${site.siteKey}.`,
          life: 5000,
        });
        setDetailsSite({
          ...site,
          status: 'error',
          missingItems: [],
          webDbIssueItems: [],
          errorMessage: msg,
        });
      } finally {
        setDetailsLoading(false);
        setDetailsActionLoading(null);
      }
    },
    [showToast, sinceDays]
  );

  const openInfoDetails = useCallback(
    async (site: WebsiteHealthSiteResult) => {
      setDetailsActionLoading({ siteKey: site.siteKey, mode: 'info' });
      setDetailsMode('info');
      setDetailsVisible(true);
      setShowWebDbIssueRows(false);
      setShowMissingRowsInInfo(false);
      setDetailsLoading(true);
      setDetailsSite({
        ...site,
        missingItems: [],
        webDbIssueItems: [],
      });

      try {
        const qs = new URLSearchParams({
          siteKey: site.siteKey,
          sinceDays: toFetchSinceDaysValue(sinceDays),
        });
        const res = await fetch(`/api/website-health/site?${qs.toString()}`, { cache: 'no-store' });
        const body = (await res.json()) as WebsiteHealthSiteDetailsResponse | { ok: false; message?: string };
        if (!res.ok || !body.ok) {
          const msg = 'message' in body && typeof body.message === 'string' ? body.message : 'Unable to fetch details.';
          throw new Error(msg);
        }
        setDetailsSite(body.site);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        showToast({
          severity: 'error',
          summary: 'Could not load comparison info',
          detail: msg,
          life: 5000,
        });
        setDetailsSite({
          ...site,
          missingItems: [],
          webDbIssueItems: [],
          status: 'error',
          errorMessage: msg,
        });
      } finally {
        setDetailsLoading(false);
        setDetailsActionLoading(null);
      }
    },
    [showToast, sinceDays]
  );

  const createJiraTicket = useCallback(
    async (site: WebsiteHealthSiteResult) => {
      setDetailsActionLoading({ siteKey: site.siteKey, mode: 'jira' });
      try {
        const qs = new URLSearchParams({
          siteKey: site.siteKey,
          sinceDays: toFetchSinceDaysValue(sinceDays),
        });
        const detailsRes = await fetch(`/api/website-health/site?${qs.toString()}`, {
          cache: 'no-store',
        });
        const detailsBody = (await detailsRes.json()) as
          | WebsiteHealthSiteDetailsResponse
          | { ok: false; message?: string };
        if (!detailsRes.ok || !detailsBody.ok) {
          const msg =
            'message' in detailsBody && typeof detailsBody.message === 'string'
              ? detailsBody.message
              : 'Unable to load site details.';
          throw new Error(msg);
        }

        const createRes = await fetch('/api/jira/website-health-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            site: detailsBody.site,
            sinceDays,
            runAt: summary?.runAt ?? new Date().toISOString(),
            missingItems: detailsBody.site.missingItems,
            webDbIssueItems: detailsBody.site.webDbIssueItems,
          }),
        });
        const createBody = (await createRes.json()) as
          | WebsiteHealthCreateJiraTicketResponse
          | { ok: false; message?: string };
        if (!createRes.ok || !createBody.ok) {
          const msg =
            'message' in createBody && typeof createBody.message === 'string'
              ? createBody.message
              : 'Failed to create Jira ticket.';
          throw new Error(msg);
        }

        showToast({
          severity: 'success',
          summary: 'Jira ticket created',
          detail: `${createBody.issueKey} was created for ${site.siteKey}.`,
          life: 5000,
        });
        setCreatedTicket({
          issueKey: createBody.issueKey,
          issueUrl: createBody.issueUrl,
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        showToast({
          severity: 'error',
          summary: 'Ticket creation failed',
          detail,
          life: 6000,
        });
      } finally {
        setDetailsActionLoading(null);
      }
    },
    [showToast, sinceDays, summary?.runAt]
  );

  const requestCreateJiraTicket = useCallback(
    (site: WebsiteHealthSiteResult) => {
      confirmDialog({
        header: 'Create Jira ticket?',
        message: `Create a Jira ticket for ${site.siteKey} with Website Health details and sample rows?`,
        icon: 'pi pi-ticket',
        acceptLabel: 'Create',
        rejectLabel: 'Cancel',
        acceptClassName: 'p-button-warning',
        accept: () => {
          void createJiraTicket(site);
        },
      });
    },
    [createJiraTicket]
  );

  useEffect(() => {
    void fetchSummary(sinceDays);
  }, [fetchSummary, sinceDays]);

  const sortedResults = useMemo(
    () =>
      [...(summary?.results ?? [])].sort((a, b) => {
        if (a.status === 'error' && b.status !== 'error') return -1;
        if (b.status === 'error' && a.status !== 'error') return 1;
        return b.missingCount - a.missingCount;
      }),
    [summary]
  );
  const sitesWithMissing = useMemo(
    () => (summary?.results ?? []).filter((row) => row.missingCount > 0).length,
    [summary]
  );
  const webDbMetricItems = useMemo<WebDbMetricItem[]>(() => {
    if (!detailsSite) return [];
    return [
      {
        label: 'Web DB Issue Count',
        value: detailsSite.webDbIssueCount.toLocaleString(),
      },
      {
        label: 'Web DB Missing DateReceived',
        value: detailsSite.webDbMissingDateReceivedCount.toLocaleString(),
        note: '(breakdown; rows can count in more than one)',
      },
      {
        label: 'Web DB Missing Confirmation',
        value: detailsSite.webDbMissingConfirmationCount.toLocaleString(),
      },
      {
        label: 'Web DB IsSubmitted≠1',
        value: detailsSite.webDbNotSubmittedCount.toLocaleString(),
      },
    ];
  }, [detailsSite]);
  const renderMissingItemsTable = useCallback((items: WebsiteHealthMissingItem[]) => {
    if (items.length === 0) {
      return <div className={styles.expansionEmpty}>No missing items for this site.</div>;
    }
    return (
      <DataTable
        value={items}
        size="small"
        responsiveLayout="scroll"
        showGridlines
        stripedRows
        emptyMessage="No missing items."
      >
        <Column field="submissionId" header="Submission ID" style={{ width: '10rem' }} />
        <Column
          field="dateReceived"
          header="Date Received"
          body={(item: WebsiteHealthMissingItem) => formatDateTime(item.dateReceived)}
        />
        <Column field="email" header="Email" />
      </DataTable>
    );
  }, []);

  return (
    <main className={styles.page} aria-label="Website health dashboard">
      <Toast ref={toastRef} position="top-right" />
      <ConfirmDialog />
      <section className={styles.header}>
        <div>
          <h1>Website Health</h1>
          <p>Read-only downloader integrity checks: submissions on 10.0.0.5 vs CleanClaims on 2K16.</p>
        </div>
        <div className={styles.controls}>
          <Dropdown
            value={sinceDays}
            options={SINCE_DAYS_OPTIONS}
            optionLabel="label"
            optionValue="value"
            onChange={(e) => setSinceDays(e.value as number | null)}
            className={styles.scopeSelect}
            placeholder="Select scope"
            tooltip="Choose how far back to scan submission rows."
            tooltipOptions={{ position: 'top' }}
          />
          <Button
            label={runningScan ? 'Running…' : 'Run Scan'}
            icon="pi pi-play"
            onClick={() => void runScan()}
            loading={runningScan}
            disabled={runningScan || loading}
            tooltip="Run an on-demand Website Health scan for the selected scope."
            tooltipOptions={{ position: 'top' }}
          />
          <Button
            label={runningSubmissionReport ? 'Sending…' : 'Submission Report'}
            icon="pi pi-send"
            onClick={() => void runSubmissionReport()}
            loading={runningSubmissionReport}
            disabled={runningSubmissionReport || runningScan || loading}
            tooltip="Send all active-site submission totals (total/today/yesterday) to Teams."
            tooltipOptions={{ position: 'top' }}
          />
          <Button
            label={runningDailyReport ? 'Sending…' : 'Daily Report'}
            icon="pi pi-calendar"
            onClick={() => void runDailyReport()}
            loading={runningDailyReport}
            disabled={runningDailyReport || runningSubmissionReport || runningScan || loading}
            tooltip="Send active-site CleanClaims daily totals (Deficient=TRUE and Disputed=TRUE) to Teams."
            tooltipOptions={{ position: 'top' }}
          />
        </div>
      </section>

      {loading && !summary ? (
        <div className={styles.loadingState}>
          <ProgressSpinner />
        </div>
      ) : (
        <>
          <section className={styles.kpis}>
            <Card className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Scope</div>
              <div
                className={styles.kpiValue}
                title="Current source record window used by the scanner."
              >
                {formatScopeLabel(summary?.sinceDays ?? sinceDays)}
              </div>
            </Card>
            <Card className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Active Sites Checked</div>
              <div className={styles.kpiValue} title="Number of active sites scanned this run.">
                {summary?.totalSitesChecked ?? 0}
              </div>
            </Card>
            <Card className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Submitted Online</div>
              <div className={styles.kpiValue} title="Total in-scope source submissions considered.">
                {summary?.totalSubmittedOnline ?? 0}
              </div>
            </Card>
            <Card className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Missing in CleanClaims</div>
              <div className={styles.kpiValue} title="Total source submissions not matched in CleanClaims.">
                {(summary?.totalMissingInCleanClaims ?? 0).toLocaleString()} [{sitesWithMissing}]
              </div>
            </Card>
          </section>

          <Card className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <strong>Site Results</strong>
              <span>
                Last run: {summary ? formatDateTime(summary.runAt) : '-'} · Active list:{' '}
                {summary?.activeSitesSource ?? '-'}
              </span>
            </div>

            <DataTable
              value={sortedResults}
              size="small"
              responsiveLayout="scroll"
              showGridlines
              stripedRows
              emptyMessage="No results."
              tableStyle={{ width: '100%', tableLayout: 'fixed' }}
            >
              <Column field="siteKey" header="Site" style={{ width: '36%' }} />
              <Column
                header="Web DB"
                headerClassName={styles.webDbColumn}
                className={styles.webDbColumn}
                headerStyle={{ width: '5.5rem', minWidth: '5.5rem', maxWidth: '5.5rem' }}
                bodyStyle={{ width: '5.5rem', minWidth: '5.5rem', maxWidth: '5.5rem' }}
                body={(row: WebsiteHealthSiteResult) => (
                  <span
                    className={styles.statusTagWrap}
                    title={`Web DB: ${row.webDbStatus.toUpperCase()}. Distinct rows with any issue: ${row.webDbIssueCount}. Breakdown (can overlap): missing DateReceived ${row.webDbMissingDateReceivedCount}, missing confirmation ${row.webDbMissingConfirmationCount}, IsSubmitted≠1 ${row.webDbNotSubmittedCount}.`}
                  >
                    <Tag value={row.webDbStatus.toUpperCase()} severity={webDbStatusSeverity(row)} />
                  </span>
                )}
              />
              <Column
                header="Status"
                headerClassName={styles.statusColumn}
                className={styles.statusColumn}
                headerStyle={{ width: '5.5rem', minWidth: '5.5rem', maxWidth: '5.5rem' }}
                bodyStyle={{ width: '5.5rem', minWidth: '5.5rem', maxWidth: '5.5rem' }}
                body={(row: WebsiteHealthSiteResult) => (
                  <span
                    className={styles.statusTagWrap}
                    title={`Status: ${row.status.toUpperCase()}`}
                  >
                    <Tag value={row.status.toUpperCase()} severity={statusSeverity(row)} />
                  </span>
                )}
              />
              <Column field="submittedOnlineCount" header="Submitted" style={{ width: '12%' }} />
              <Column field="matchedInCleanClaimsCount" header="Matched" style={{ width: '12%' }} />
              <Column
                field="missingCount"
                header="Missing"
                style={{ width: '12%' }}
                body={(row: WebsiteHealthSiteResult) => (
                  <span className={row.missingCount > 1 ? styles.missingCountEmphasis : undefined}>
                    {row.missingCount}
                  </span>
                )}
              />
              <Column
                header="Actions"
                headerClassName={styles.actionsColumn}
                className={styles.actionsColumn}
                headerStyle={{ width: '7rem', minWidth: '7rem', maxWidth: '7rem' }}
                bodyStyle={{ width: '7rem', minWidth: '7rem', maxWidth: '7rem' }}
                body={(row: WebsiteHealthSiteResult) => (
                  <div className={styles.actionButtons}>
                    <Button
                      size="small"
                      text
                      icon="pi pi-info-circle"
                      className={styles.actionButton}
                      disabled={detailsActionLoading !== null}
                      loading={
                        detailsActionLoading?.siteKey === row.siteKey &&
                        detailsActionLoading.mode === 'info'
                      }
                      onClick={() => void openInfoDetails(row)}
                      aria-label={`View info for ${row.siteKey}`}
                      tooltip="View comparison info"
                      tooltipOptions={{ position: 'top' }}
                    />
                    <Button
                      size="small"
                      text
                      icon={row.status === 'error' ? 'pi pi-exclamation-triangle' : 'pi pi-search'}
                      className={styles.actionButton}
                      disabled={detailsActionLoading !== null}
                      loading={
                        detailsActionLoading?.siteKey === row.siteKey &&
                        detailsActionLoading.mode === 'missing'
                      }
                      onClick={() => void openMissingDetails(row)}
                      aria-label={`View missing rows for ${row.siteKey}`}
                      tooltip={row.status === 'error' ? 'View error details' : 'View missing rows'}
                      tooltipOptions={{ position: 'top' }}
                    />
                    {row.status !== 'ok' || row.webDbStatus === 'error' ? (
                      <Button
                        size="small"
                        text
                        icon="pi pi-plus-circle"
                        className={styles.actionButton}
                        disabled={detailsActionLoading !== null}
                        loading={
                          detailsActionLoading?.siteKey === row.siteKey &&
                          detailsActionLoading.mode === 'jira'
                        }
                        onClick={() => requestCreateJiraTicket(row)}
                        aria-label={`Create Jira ticket for ${row.siteKey}`}
                        tooltip="Create Jira ticket from this issue"
                        tooltipOptions={{ position: 'top' }}
                      />
                    ) : null}
                  </div>
                )}
              />
            </DataTable>
          </Card>
        </>
      )}

      <Dialog
        header={
          detailsSite
            ? `${detailsSite.siteKey} — ${detailsMode === 'info' ? 'Comparison Info' : 'Missing Rows'}`
            : detailsMode === 'info'
              ? 'Comparison Info'
              : 'Missing Rows'
        }
        visible={detailsVisible}
        onHide={() => {
          setDetailsVisible(false);
          setShowWebDbIssueRows(false);
          setShowMissingRowsInInfo(false);
        }}
        style={{ width: 'min(98vw, 1120px)' }}
        contentClassName={styles.dialogContentSingleScroll}
        draggable
        resizable
        maximizable
        blockScroll
        modal
      >
        {detailsLoading ? (
          <div className={styles.detailsLoading}>
            <ProgressSpinner className="progress-spinner-sm" />
            <span>
              {detailsMode === 'info'
                ? `Loading comparison details for ${detailsSite?.siteKey ?? 'selected case'}...`
                : `Please wait while we fetch rows for ${detailsSite?.siteKey ?? 'selected case'}...`}
            </span>
          </div>
        ) : !detailsSite ? (
          <div className={styles.expansionEmpty}>No site selected.</div>
        ) : detailsMode === 'info' ? (
          <div className={styles.infoPanel}>
            <div className={styles.infoRow}>
              <strong>Website DB:</strong> <span>{detailsSite.websiteDbName}</span>
              <CopyToClipboardButton
                value={detailsSite.websiteDbName}
                valueLabel="Website DB"
                onToast={showToast}
                className={styles.copyValueButton}
                tooltip="Copy Website DB value"
                tooltipPosition="left"
                aria-label="Copy Website DB"
              />
            </div>
            <div className={styles.infoRow}>
              <strong>2K16 CleanClaims DB:</strong> <span>{detailsSite.cleanClaimsDbName}</span>
              <CopyToClipboardButton
                value={detailsSite.cleanClaimsDbName}
                valueLabel="2K16 CleanClaims DB"
                onToast={showToast}
                className={styles.copyValueButton}
                tooltip="Copy 2K16 CleanClaims DB value"
                tooltipPosition="left"
                aria-label="Copy 2K16 CleanClaims DB"
              />
            </div>
            <div className={styles.infoRow}>
              <strong>Deadline Date:</strong> <span>{detailsSite.deadlineDate ?? '(none)'}</span>
            </div>
            <div className={styles.infoRow}>
              <strong>Status:</strong> <Tag value={detailsSite.status.toUpperCase()} severity={statusSeverity(detailsSite)} />
            </div>
            <div className={styles.infoRow}>
              <strong>Web DB Status:</strong>{' '}
              <Tag value={detailsSite.webDbStatus.toUpperCase()} severity={webDbStatusSeverity(detailsSite)} />
              {detailsSite.webDbStatus === 'error' && detailsSite.webDbIssueCount > 0 ? (
                <Button
                  type="button"
                  size="small"
                  text
                  rounded
                  icon={showWebDbIssueRows ? 'pi pi-eye-slash' : 'pi pi-eye'}
                  className={styles.infoRowAction}
                  onClick={() => setShowWebDbIssueRows((v) => !v)}
                  tooltip={
                    showWebDbIssueRows
                      ? 'Hide Web DB issue rows'
                      : 'Show rows with Web DB inconsistencies (submitted rows missing confirmation/IsSubmitted, or confirmation without DateReceived)'
                  }
                  tooltipOptions={{ position: 'left' }}
                  aria-expanded={showWebDbIssueRows}
                  aria-label="Toggle Web DB issue rows"
                />
              ) : null}
            </div>
            <div className={styles.infoRow}>
              <strong>Submitted:</strong>{' '}
              <Tag value={detailsSite.submittedOnlineCount.toLocaleString()} severity="info" />
            </div>
            <div className={styles.infoRow}>
              <strong>Matched:</strong>{' '}
              <Tag value={detailsSite.matchedInCleanClaimsCount.toLocaleString()} severity="success" />
            </div>
            <div className={styles.infoRow}>
              <strong>Missing:</strong>{' '}
              <Tag
                value={detailsSite.missingCount.toLocaleString()}
                severity={detailsSite.missingCount > 0 ? 'warning' : 'success'}
              />
              {detailsSite.missingCount > 0 ? (
                <Button
                  type="button"
                  size="small"
                  text
                  rounded
                  icon={showMissingRowsInInfo ? 'pi pi-eye-slash' : 'pi pi-eye'}
                  className={styles.infoRowAction}
                  onClick={() => setShowMissingRowsInInfo((v) => !v)}
                  tooltip={showMissingRowsInInfo ? 'Hide missing rows' : 'Show missing rows'}
                  tooltipOptions={{ position: 'left' }}
                  aria-expanded={showMissingRowsInInfo}
                  aria-label="Toggle missing rows"
                />
              ) : null}
            </div>
            <div className={styles.infoRow}>
              <strong>Method:</strong>{' '}
              <span>
                Confirmation number compare with source filters (date received, today only through 5:15 AM, no test IDs, no @cptgroup.com).
              </span>
            </div>
            {showMissingRowsInInfo ? (
              <div className={styles.webDbIssuesTable}>
                <div className={styles.webDbIssuesTableTitle}>Missing rows (same dataset as View Missing Rows)</div>
                {renderMissingItemsTable(detailsSite.missingItems)}
              </div>
            ) : null}
            <div className={styles.webDbMetricsBlock}>
              <DataTable
                value={webDbMetricItems}
                className={styles.webDbMetricsTable}
                size="small"
                responsiveLayout="scroll"
                tableStyle={{ width: '100%' }}
              >
                <Column
                  field="label"
                  header="Web DB Metric"
                  style={{ width: '45%' }}
                  body={(item: WebDbMetricItem) => <span className={styles.webDbMetricLabel}>{item.label}</span>}
                />
                <Column
                  field="value"
                  header="Value"
                  body={(item: WebDbMetricItem) => (
                    <span className={styles.webDbMetricValue}>
                      {item.value}
                      {item.note ? <span className={styles.webDbMetricNote}> {item.note}</span> : null}
                    </span>
                  )}
                />
              </DataTable>
            </div>
            {detailsSite.errorMessage ? (
              <div className={styles.expansionError}>{detailsSite.errorMessage}</div>
            ) : null}
            {showWebDbIssueRows && detailsSite.webDbIssueItems.length > 0 ? (
              <div className={styles.webDbIssuesTable}>
                <div className={styles.webDbIssuesTableTitle}>
                  Website rows with Web DB inconsistencies (submitted rows missing confirmation/IsSubmitted, or
                  confirmation present while DateReceived is missing) — issue column lists all that apply
                </div>
                <DataTable
                  value={detailsSite.webDbIssueItems}
                  size="small"
                  responsiveLayout="scroll"
                  showGridlines
                  stripedRows
                  emptyMessage="No rows."
                >
                  <Column field="submissionId" header="ID" style={{ width: '6rem' }} />
                  <Column
                    field="dateReceived"
                    header="Date received"
                    body={(item: WebsiteHealthWebDbIssueItem) =>
                      item.dateReceived ? formatDateTime(item.dateReceived) : '—'
                    }
                    style={{ width: '11rem' }}
                  />
                  <Column field="email" header="Email" />
                  <Column
                    field="confirmationNo"
                    header="Confirmation"
                    body={(item: WebsiteHealthWebDbIssueItem) => item.confirmationNo?.trim() || '—'}
                  />
                  <Column
                    field="reasons"
                    header="Issue"
                    body={(item: WebsiteHealthWebDbIssueItem) => item.reasons.join(' · ')}
                  />
                </DataTable>
              </div>
            ) : null}
            {showWebDbIssueRows && detailsSite.webDbStatus === 'error' && detailsSite.webDbIssueCount > 0 && detailsSite.webDbIssueItems.length === 0 ? (
              <div className={styles.expansionEmpty}>
                Issue rows could not be loaded. Refresh the page or open Info again after the scan finishes.
              </div>
            ) : null}
            <WebsiteHealthInfoHelp site={detailsSite} />
          </div>
        ) : detailsSite.errorMessage ? (
          <div className={styles.expansionError}>{detailsSite.errorMessage}</div>
        ) : (
          renderMissingItemsTable(detailsSite.missingItems)
        )}
      </Dialog>
      <Dialog
        header="Jira ticket created"
        visible={createdTicket !== null}
        onHide={() => setCreatedTicket(null)}
        style={{ width: 'min(96vw, 680px)' }}
        modal
      >
        {createdTicket ? (
          <div className={styles.createdTicketDialog}>
            <div className={styles.createdTicketRow}>
              <strong>Ticket ID:</strong>
              <span>{createdTicket.issueKey}</span>
              <CopyToClipboardButton
                value={createdTicket.issueKey}
                valueLabel="Jira ticket ID"
                onToast={showToast}
                className={styles.copyValueButton}
                tooltipPosition="left"
              />
            </div>
            <div className={styles.createdTicketRow}>
              <strong>Ticket URL:</strong>
              <a href={createdTicket.issueUrl} target="_blank" rel="noreferrer">
                {createdTicket.issueUrl}
              </a>
              <CopyToClipboardButton
                value={createdTicket.issueUrl}
                valueLabel="Jira ticket URL"
                onToast={showToast}
                className={styles.copyValueButton}
                tooltipPosition="left"
              />
            </div>
            <div className={styles.createdTicketActions}>
              <Button
                type="button"
                label="Open Ticket"
                icon="pi pi-external-link"
                onClick={() => window.open(createdTicket.issueUrl, '_blank', 'noopener,noreferrer')}
              />
            </div>
          </div>
        ) : null}
      </Dialog>
    </main>
  );
};

