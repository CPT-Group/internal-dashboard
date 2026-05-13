import { NextRequest } from 'next/server';
import type {
  WebsiteHealthSubmissionReport,
  WebsiteHealthSubmissionReportResponse,
} from '@/types';
import { runWebsiteHealthSubmissionReport } from '@/services/websiteHealth/scan';
import { notifyWebsiteHealthTeams } from '@/services/websiteHealth/teams';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubmissionReportBodyShape {
  notify?: boolean;
}

function parseBodyNotify(body: unknown): boolean {
  if (!body || typeof body !== 'object') return true;
  const shape = body as SubmissionReportBodyShape;
  if (typeof shape.notify === 'boolean') return shape.notify;
  return true;
}

function buildSubmissionReportAlertText(report: WebsiteHealthSubmissionReport): string {
  const sorted = [...report.results].sort((a, b) => a.siteKey.localeCompare(b.siteKey));
  const lines: string[] = [
    '## WEBSITE HEALTH SUBMISSION REPORT',
    '',
    '_**Submitted** (today/yesterday)_ = in-scope rows in the website `Submissions` table for that calendar window (5:15 same-day rule for “today”).',
    '_**Downloaded** (today/yesterday)_ = those rows also found in 2K16 `CleanClaims` with the same online filter as the main Website Health scan.',
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Active Sites Checked | ${report.totalSitesChecked} |`,
    `| Total Submitted | ${report.totalSubmittedCount} |`,
    `| Submitted Today (web) | ${report.totalSubmittedTodayCount} |`,
    `| Downloaded Today | ${report.totalDownloadedTodayCount} |`,
    `| Submitted Yesterday (web) | ${report.totalSubmittedYesterdayCount} |`,
    `| Downloaded Yesterday | ${report.totalDownloadedYesterdayCount} |`,
    `| Last Run | ${report.runAt} |`,
    '',
    '| Site | Status | Total | Sub today | DL today | Sub yest | DL yest |',
    '|---|---|---:|---:|---:|---:|---:|',
  ];

  let includedCount = 0;
  for (const site of sorted) {
    const status = site.status.toUpperCase();
    const safeSite = site.siteKey.replace(/\|/g, '/');
    const row =
      `| ${safeSite} | ${status} | ${site.totalSubmittedCount} | ${site.submittedTodayCount} | ` +
      `${site.downloadedTodayCount} | ${site.submittedYesterdayCount} | ${site.downloadedYesterdayCount} |`;
    const candidate = [...lines, row].join('\n');
    if (candidate.length > 3900) break;
    lines.push(row);
    includedCount += 1;
  }

  const remaining = sorted.length - includedCount;
  if (remaining > 0) {
    lines.push('', `_${remaining} additional site row(s) omitted due to Teams message length limit._`);
  }

  return lines.join('\n');
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Optional body; defaults applied below.
  }

  try {
    const notify = parseBodyNotify(body);
    const report = await runWebsiteHealthSubmissionReport({ refreshActiveSites: true });

    const alertText = buildSubmissionReportAlertText(report);
    const alerted = notify ? await notifyWebsiteHealthTeams(alertText) : false;
    const alertMessage = notify && !alerted ? 'Teams webhook not configured or notification failed.' : undefined;

    const response: WebsiteHealthSubmissionReportResponse = {
      ok: true,
      report,
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

