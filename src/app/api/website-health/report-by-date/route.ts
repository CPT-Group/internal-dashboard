import { NextRequest } from 'next/server';
import type {
  WebsiteHealthDailyByDateReport,
  WebsiteHealthReportByDateKind,
  WebsiteHealthReportByDateResponse,
  WebsiteHealthReportByDateWindow,
  WebsiteHealthSubmissionByDateReport,
} from '@/types';
import {
  buildWebsiteHealthReportByDateWindow,
  runWebsiteHealthDailyReportByDate,
  runWebsiteHealthSubmissionReportByDate,
} from '@/services/websiteHealth/scan';
import { notifyWebsiteHealthTeams } from '@/services/websiteHealth/teams';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReportByDateBodyShape {
  notify?: boolean;
  startDate?: string;
  endDate?: string | null;
  reportTypes?: string[];
}

function parseBodyNotify(body: unknown): boolean {
  if (!body || typeof body !== 'object') return true;
  const shape = body as ReportByDateBodyShape;
  if (typeof shape.notify === 'boolean') return shape.notify;
  return true;
}

function parseReportTypes(body: unknown): WebsiteHealthReportByDateKind[] {
  if (!body || typeof body !== 'object') return ['submission', 'daily'];
  const shape = body as ReportByDateBodyShape;
  const raw = Array.isArray(shape.reportTypes) ? shape.reportTypes : null;
  if (!raw || raw.length === 0) return ['submission', 'daily'];
  const out: WebsiteHealthReportByDateKind[] = [];
  for (const v of raw) {
    if (v === 'submission' || v === 'daily') {
      if (!out.includes(v)) out.push(v);
    }
  }
  if (out.length === 0) {
    throw new Error(
      `reportTypes must be a non-empty subset of ['submission','daily'] (got ${JSON.stringify(raw)}).`
    );
  }
  return out;
}

function parseWindow(body: unknown): WebsiteHealthReportByDateWindow {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must include `startDate` (YYYY-MM-DD).');
  }
  const shape = body as ReportByDateBodyShape;
  if (typeof shape.startDate !== 'string' || shape.startDate.length === 0) {
    throw new Error('`startDate` is required (format YYYY-MM-DD).');
  }
  const endDate =
    typeof shape.endDate === 'string' && shape.endDate.length > 0 ? shape.endDate : null;
  return buildWebsiteHealthReportByDateWindow(shape.startDate, endDate);
}

function formatDateRange(window: WebsiteHealthReportByDateWindow): string {
  return window.startDate === window.endDate
    ? toDisplayDate(window.startDate)
    : `${toDisplayDate(window.startDate)} → ${toDisplayDate(window.endDate)}`;
}

/** Format a `YYYY-MM-DD` as `M/D/YYYY` (no leading zeros). */
function toDisplayDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((v) => Number.parseInt(v, 10));
  if (!y || !m || !d) return ymd;
  return `${m}/${d}/${y}`;
}

/** Format a Date as `M/D/YYYY at h:mmam/pm` (lowercase am/pm, no space). */
function formatRunTimestamp(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours24 >= 12 ? 'pm' : 'am';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const mm = String(minutes).padStart(2, '0');
  return `${m}/${d}/${y} at ${hours12}:${mm}${suffix}`;
}

function buildReportByDateAlertText(
  window: WebsiteHealthReportByDateWindow,
  submission: WebsiteHealthSubmissionByDateReport | null,
  daily: WebsiteHealthDailyByDateReport | null
): string {
  const runAt = new Date();
  const runAtLabel = formatRunTimestamp(runAt);
  const scopeLabel = formatDateRange(window);
  const typesLabel =
    [submission ? 'Submission' : null, daily ? 'Deficiency' : null].filter(Boolean).join(' + ') ||
    '(none)';

  const lines: string[] = [
    `## WEBSITE HEALTH SCAN BY DATE — ${scopeLabel} — ${typesLabel} — ran ${runAtLabel}`,
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Date scope | ${scopeLabel} |`,
    `| Window (5:15 anchor) | ${window.startDateTime} → ${window.endDateTimeExclusive} (exclusive) |`,
    `| Scan types | ${typesLabel} |`,
    `| Run at | ${runAtLabel} |`,
    '',
  ];

  if (submission) {
    lines.push(
      `### Submission Scan · ${scopeLabel}`,
      '',
      '| Metric | Value |',
      '|---|---|',
      `| Active Sites Checked | ${submission.totalSitesChecked} |`,
      `| Total Submitted in Window | ${submission.totalWindowSubmittedCount} |`,
      ''
    );
    const sorted = [...submission.results].sort((a, b) => a.siteKey.localeCompare(b.siteKey));
    lines.push(
      '| Site | Status | Submitted in Window |',
      '|---|---|---:|'
    );
    let included = 0;
    for (const site of sorted) {
      const row = `| ${site.siteKey.replace(/\|/g, '/')} | ${site.status.toUpperCase()} | ${site.windowSubmittedCount} |`;
      const candidate = [...lines, row].join('\n');
      if (candidate.length > 3700) break;
      lines.push(row);
      included += 1;
    }
    const remaining = sorted.length - included;
    if (remaining > 0) {
      lines.push('', `_${remaining} additional submission site row(s) omitted due to Teams message length limit._`);
    }
    lines.push('');
  }

  if (daily) {
    const dateColumns = Array.from(
      new Set(
        daily.results
          .map((r) => r.dateColumnUsed)
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
      )
    );
    const dateColLabel =
      dateColumns.length === 0
        ? '—'
        : dateColumns.length === 1
          ? dateColumns[0]
          : `${dateColumns.length} columns (${dateColumns.join(', ')})`;

    lines.push(
      `### Deficiency Scan · ${scopeLabel}`,
      '',
      '| Metric | Value |',
      '|---|---|',
      `| Active Sites Checked | ${daily.totalSitesChecked} |`,
      `| Deficient (TRUE) in Window | ${daily.totalWindowDeficientTrueCount} |`,
      `| Disputed (TRUE) in Window | ${daily.totalWindowDisputedTrueCount} |`,
      `| Date column used | ${dateColLabel} |`,
      ''
    );
    const sorted = [...daily.results].sort((a, b) => a.siteKey.localeCompare(b.siteKey));
    lines.push(
      '| Site | Status | Deficient | Disputed |',
      '|---|---|---:|---:|'
    );
    let included = 0;
    for (const site of sorted) {
      const row = `| ${site.siteKey.replace(/\|/g, '/')} | ${site.status.toUpperCase()} | ${site.windowDeficientTrueCount} | ${site.windowDisputedTrueCount} |`;
      const candidate = [...lines, row].join('\n');
      if (candidate.length > 3700) break;
      lines.push(row);
      included += 1;
    }
    const remaining = sorted.length - included;
    if (remaining > 0) {
      lines.push('', `_${remaining} additional deficiency site row(s) omitted due to Teams message length limit._`);
    }
    lines.push('');
  }

  lines.push(
    '_Note: a "day" is the downloader window, starting 05:15 AM and ending 05:14:59 AM the next day._'
  );
  return lines.join('\n');
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Optional body; validation below will error on missing required fields.
  }

  try {
    const window = parseWindow(body);
    const reportTypes = parseReportTypes(body);
    const notify = parseBodyNotify(body);

    const runSubmission = reportTypes.includes('submission');
    const runDaily = reportTypes.includes('daily');

    const [submission, daily] = await Promise.all([
      runSubmission
        ? runWebsiteHealthSubmissionReportByDate({ window, refreshActiveSites: true })
        : Promise.resolve(null as WebsiteHealthSubmissionByDateReport | null),
      runDaily
        ? runWebsiteHealthDailyReportByDate({ window, refreshActiveSites: true })
        : Promise.resolve(null as WebsiteHealthDailyByDateReport | null),
    ]);

    const alertText = buildReportByDateAlertText(window, submission, daily);
    const alerted = notify ? await notifyWebsiteHealthTeams(alertText) : false;
    const alertMessage =
      notify && !alerted ? 'Teams webhook not configured or notification failed.' : undefined;

    const response: WebsiteHealthReportByDateResponse = {
      ok: true,
      window,
      submission,
      daily,
      alerted,
      alertMessage,
    };
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, message }, { status: 400 });
  }
}
