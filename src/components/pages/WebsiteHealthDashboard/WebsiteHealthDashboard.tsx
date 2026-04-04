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
import type { ToastMessage } from 'primereact/toast';
import type {
  WebsiteHealthSiteDetailsResponse,
  WebsiteHealthSiteResult,
  WebsiteHealthSummary,
  WebsiteHealthSummaryResponse,
} from '@/types';
import styles from './WebsiteHealthDashboard.module.scss';

interface SinceDaysOption {
  label: string;
  value: number | null;
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

function toFetchSinceDaysValue(value: number | null): string {
  return value === null ? 'all' : String(value);
}

export const WebsiteHealthDashboard = () => {
  const toastRef = useRef<Toast | null>(null);
  const [summary, setSummary] = useState<WebsiteHealthSummary | null>(null);
  const [sinceDays, setSinceDays] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningScan, setRunningScan] = useState<boolean>(false);
  const [detailsVisible, setDetailsVisible] = useState<boolean>(false);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [detailsSite, setDetailsSite] = useState<(WebsiteHealthSiteResult & { missingItems: Array<{ submissionId: number; dateReceived: string; email: string | null }> }) | null>(null);

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
      const missingSites = body.summary.results.filter((site) => site.missingCount > 0).length;
      if (body.alerted) {
        showToast({
          severity: 'warn',
          summary: 'Scan complete',
          detail: `Issues found in ${missingSites} site(s). Teams alert sent.`,
          life: 5000,
        });
      } else if (body.summary.sitesWithIssues > 0) {
        showToast({
          severity: 'warn',
          summary: 'Scan complete',
          detail:
            body.alertMessage ??
            `Issues found in ${missingSites} site(s). Please review the table for details.`,
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

  const openDetails = useCallback(
    async (site: WebsiteHealthSiteResult) => {
      setDetailsVisible(true);
      setDetailsLoading(true);
      setDetailsSite({
        ...site,
        missingItems: [],
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
          errorMessage: msg,
        });
      } finally {
        setDetailsLoading(false);
      }
    },
    [showToast, sinceDays]
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

  return (
    <main className={styles.page} aria-label="Website health dashboard">
      <Toast ref={toastRef} position="top-right" />
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
          />
          <Button
            label={runningScan ? 'Running…' : 'Run Scan'}
            icon="pi pi-play"
            onClick={() => void runScan()}
            loading={runningScan}
            disabled={runningScan || loading}
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
              <div className={styles.kpiValue}>{formatScopeLabel(summary?.sinceDays ?? sinceDays)}</div>
            </Card>
            <Card className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Active Sites Checked</div>
              <div className={styles.kpiValue}>{summary?.totalSitesChecked ?? 0}</div>
            </Card>
            <Card className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Submitted Online</div>
              <div className={styles.kpiValue}>{summary?.totalSubmittedOnline ?? 0}</div>
            </Card>
            <Card className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Missing in CleanClaims</div>
              <div className={styles.kpiValue}>
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
            >
              <Column field="siteKey" header="Site" style={{ width: '8rem' }} />
              <Column
                header="Status"
                body={(row: WebsiteHealthSiteResult) => (
                  <Tag value={row.status.toUpperCase()} severity={statusSeverity(row)} />
                )}
                style={{ width: '7rem' }}
              />
              <Column field="websiteDbName" header="Website DB" />
              <Column field="cleanClaimsDbName" header="2K16 CleanClaims DB" />
              <Column field="submittedOnlineCount" header="Submitted" style={{ width: '7rem' }} />
              <Column field="matchedInCleanClaimsCount" header="Matched" style={{ width: '7rem' }} />
              <Column field="missingCount" header="Missing" style={{ width: '7rem' }} />
              <Column
                header="Details"
                body={(row: WebsiteHealthSiteResult) => (
                  <Button
                    size="small"
                    text
                    onClick={() => void openDetails(row)}
                    label={row.status === 'error' ? 'View Error' : 'View Missing'}
                  />
                )}
                style={{ width: '8rem' }}
              />
            </DataTable>
          </Card>
        </>
      )}

      <Dialog
        header={detailsSite ? `${detailsSite.siteKey} — Missing Rows` : 'Missing Rows'}
        visible={detailsVisible}
        onHide={() => setDetailsVisible(false)}
        style={{ width: 'min(95vw, 900px)' }}
        modal
      >
        {detailsLoading ? (
          <div className={styles.detailsLoading}>
            <ProgressSpinner className="progress-spinner-sm" />
            <span>
              Please wait while we fetch rows for {detailsSite?.siteKey ?? 'selected case'}...
            </span>
          </div>
        ) : !detailsSite ? (
          <div className={styles.expansionEmpty}>No site selected.</div>
        ) : detailsSite.errorMessage ? (
          <div className={styles.expansionError}>{detailsSite.errorMessage}</div>
        ) : detailsSite.missingItems.length === 0 ? (
          <div className={styles.expansionEmpty}>No missing items for this site.</div>
        ) : (
          <DataTable
            value={detailsSite.missingItems}
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
              body={(item: { dateReceived: string }) => formatDateTime(item.dateReceived)}
            />
            <Column field="email" header="Email" />
          </DataTable>
        )}
      </Dialog>
    </main>
  );
};

