import { NextRequest } from 'next/server';
import type {
  WebsiteHealthDailyReport,
  WebsiteHealthDailyReportResponse,
} from '@/types';
import { runWebsiteHealthDailyReport } from '@/services/websiteHealth/scan';
import { notifyWebsiteHealthTeams } from '@/services/websiteHealth/teams';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DailyReportBodyShape {
  notify?: boolean;
}

function parseBodyNotify(body: unknown): boolean {
  if (!body || typeof body !== 'object') return true;
  const shape = body as DailyReportBodyShape;
  if (typeof shape.notify === 'boolean') return shape.notify;
  return true;
}

function buildDailyReportAlertText(report: WebsiteHealthDailyReport): string {
  const sorted = [...report.results].sort((a, b) => a.siteKey.localeCompare(b.siteKey));
  const lines: string[] = [
    '## WEBSITE HEALTH DAILY REPORT',
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Active Sites Checked | ${report.totalSitesChecked} |`,
    `| Deficient (TRUE) Total | ${report.totalDeficientTrueCount} |`,
    `| Disputed (TRUE) Total | ${report.totalDisputedTrueCount} |`,
    `| Last Run | ${report.runAt} |`,
    '',
    '| Site | Status | Deficient = TRUE | Disputed = TRUE |',
    '|---|---|---:|---:|',
  ];

  let includedCount = 0;
  for (const site of sorted) {
    const status = site.status.toUpperCase();
    const safeSite = site.siteKey.replace(/\|/g, '/');
    const row = `| ${safeSite} | ${status} | ${site.deficientTrueCount} | ${site.disputedTrueCount} |`;
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
    const report = await runWebsiteHealthDailyReport({ refreshActiveSites: true });

    const alertText = buildDailyReportAlertText(report);
    const alerted = notify ? await notifyWebsiteHealthTeams(alertText) : false;
    const alertMessage = notify && !alerted ? 'Teams webhook not configured or notification failed.' : undefined;

    const response: WebsiteHealthDailyReportResponse = {
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
