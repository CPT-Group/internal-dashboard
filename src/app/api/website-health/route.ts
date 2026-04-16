import { NextRequest } from 'next/server';
import type { WebsiteHealthSummaryResponse } from '@/types';
import { runWebsiteHealthScan } from '@/services/websiteHealth/scan';
import { notifyWebsiteHealthTeams } from '@/services/websiteHealth/teams';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RunBodyShape {
  sinceDays?: number | null;
  notify?: boolean;
}

const TEAMS_MAX_TEXT_LENGTH = 3900;

function parseSinceDays(raw: string | null): number | null {
  if (!raw) return null;
  if (raw.toLowerCase() === 'all') return null;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) return null;
  return Math.min(parsed, 90);
}

function parseBodySinceDays(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null;
  const shape = body as RunBodyShape;
  if (shape.sinceDays === null) return null;
  if (typeof shape.sinceDays !== 'number' || !Number.isFinite(shape.sinceDays)) return null;
  if (shape.sinceDays < 1) return null;
  return Math.min(Math.floor(shape.sinceDays), 90);
}

function parseBodyNotify(body: unknown): boolean {
  if (!body || typeof body !== 'object') return true;
  const shape = body as RunBodyShape;
  if (typeof shape.notify === 'boolean') return shape.notify;
  return true;
}

function formatTeamsRunAt(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.valueOf())) return value;
  const time = dt
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Los_Angeles',
    })
    .replace(' AM', 'am')
    .replace(' PM', 'pm');
  const date = dt.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
  return `${time} ${date}`;
}

function buildAlertText(summary: WebsiteHealthSummaryResponse['summary']): string {
  const impactedCompareSites = summary.results.filter((r) => r.missingCount > 0).length;
  const impactedWebDbSites = summary.results.filter((r) => r.webDbStatus === 'error').length;
  const scope = summary.sinceDays === null ? 'All submitted records' : `Last ${summary.sinceDays} day(s)`;
  const topRows = summary.results
    .filter((r) => r.missingCount > 0 || r.status === 'error' || r.webDbStatus === 'error')
    .sort((a, b) => {
      if (a.webDbStatus === 'error' && b.webDbStatus !== 'error') return -1;
      if (b.webDbStatus === 'error' && a.webDbStatus !== 'error') return 1;
      return b.missingCount - a.missingCount;
    })
    .slice(0, 10);

  const detailLines = topRows.map((r) => {
    const compareStatus = r.status.toUpperCase();
    const webDbStatus = r.webDbStatus.toUpperCase();
    const site = r.siteKey.replace(/\|/g, '/');
    const error = r.errorMessage ? ` (${r.errorMessage.replace(/\|/g, '/')})` : '';
    return `| ${site} | ${webDbStatus} | ${r.webDbIssueCount} | ${compareStatus}${error} | ${r.submittedOnlineCount} | ${r.matchedInCleanClaimsCount} | ${r.missingCount} |`;
  });

  return [
    '## WEBSITE HEALTH ALERT',
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Scope | ${scope} |`,
    `| Active Sites Checked | ${summary.totalSitesChecked} |`,
    `| Compare Issues (sites) | ${summary.sitesWithIssues} |`,
    `| Web DB Issues (sites) | ${impactedWebDbSites} |`,
    `| Submitted | ${summary.totalSubmittedOnline} |`,
    `| Missing | ${summary.totalMissingInCleanClaims} [${impactedCompareSites}] |`,
    `| Last Run | ${formatTeamsRunAt(summary.runAt)} |`,
    '',
    '| Site | Web DB | Web DB Issues | Status | Submitted | Matched | Missing |',
    '|---|---|---:|---|---:|---:|---:|',
    ...detailLines,
  ].join('\n').slice(0, TEAMS_MAX_TEXT_LENGTH);
}

function buildAllClearText(summary: WebsiteHealthSummaryResponse['summary']): string {
  const scope = summary.sinceDays === null ? 'All submitted records' : `Last ${summary.sinceDays} day(s)`;
  const allSites = summary.results
    .slice()
    .sort((a, b) => a.siteKey.localeCompare(b.siteKey));

  const allSiteLines = allSites.map((site) => {
    const safeSite = site.siteKey.replace(/\|/g, '/');
    return `| ${safeSite} | ${site.submittedOnlineCount} | ${site.matchedInCleanClaimsCount} | ${site.missingCount} | ${site.webDbIssueCount} |`;
  });

  const introLines = [
    '## WEBSITE HEALTH - ALL SYSTEMS CLEAR',
    '',
    'No compare discrepancies or Web DB integrity issues were detected in this run.',
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Scope | ${scope} |`,
    `| Active Sites Checked | ${summary.totalSitesChecked} |`,
    `| Compare Issues (sites) | ${summary.sitesWithIssues} |`,
    `| Submitted | ${summary.totalSubmittedOnline} |`,
    `| Matched | ${summary.totalMatchedInCleanClaims} |`,
    `| Missing | ${summary.totalMissingInCleanClaims} |`,
    `| Last Run | ${formatTeamsRunAt(summary.runAt)} |`,
    '',
  ];

  const shownRows: string[] = [];
  for (const row of allSiteLines) {
    const candidateShownCount = shownRows.length + 1;
    const candidateLines = [
      ...introLines,
      `| Site (shown ${candidateShownCount}/${allSites.length}) | Submitted | Matched | Missing | Web DB Issues |`,
      '|---|---:|---:|---:|---:|',
      ...shownRows,
      row,
    ];
    if (candidateLines.join('\n').length > TEAMS_MAX_TEXT_LENGTH) {
      break;
    }
    shownRows.push(row);
  }

  const remaining = Math.max(allSites.length - shownRows.length, 0);
  const lines = [
    ...introLines,
    `| Site (shown ${shownRows.length}/${allSites.length}) | Submitted | Matched | Missing | Web DB Issues |`,
    '|---|---:|---:|---:|---:|',
    ...shownRows,
    ...(remaining > 0
      ? ['', `_${remaining} additional site(s) omitted due to Teams message length limit._`]
      : []),
  ];
  return lines.join('\n').slice(0, TEAMS_MAX_TEXT_LENGTH);
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const sinceDays = parseSinceDays(request.nextUrl.searchParams.get('sinceDays'));
    const summary = await runWebsiteHealthScan({ sinceDays, refreshActiveSites: false });
    const response: WebsiteHealthSummaryResponse = {
      ok: true,
      summary,
      alerted: false,
    };
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Optional JSON body; defaults are applied below.
  }

  try {
    const sinceDays = parseBodySinceDays(body);
    const notify = parseBodyNotify(body);

    const summary = await runWebsiteHealthScan({ sinceDays, refreshActiveSites: true });
    const shouldNotify = notify;

    let alerted = false;
    let alertMessage: string | undefined;
    if (shouldNotify) {
      const hasIssues = summary.totalMissingInCleanClaims > 0 || summary.sitesWithIssues > 0;
      const alertText = hasIssues ? buildAlertText(summary) : buildAllClearText(summary);
      alerted = await notifyWebsiteHealthTeams(alertText);
      if (!alerted) {
        alertMessage = 'Teams webhook not configured or notification failed.';
      }
    }

    const response: WebsiteHealthSummaryResponse = {
      ok: true,
      summary,
      alerted,
      alertMessage,
    };
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}

