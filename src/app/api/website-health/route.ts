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

function buildAlertText(summary: WebsiteHealthSummaryResponse['summary']): string {
  const top = summary.results
    .filter((r) => r.missingCount > 0 || r.status === 'error')
    .sort((a, b) => b.missingCount - a.missingCount)
    .slice(0, 8)
    .map((r) => {
      const issuePart =
        r.status === 'error'
          ? `error: ${r.errorMessage ?? 'unknown'}`
          : `missing: ${r.missingCount} / submitted: ${r.submittedOnlineCount}`;
      return `- ${r.siteKey} (${r.websiteDbName} -> ${r.cleanClaimsDbName}) ${issuePart}`;
    });

  return [
    '[Website Health] Discrepancies detected',
    `Run: ${summary.runAt}`,
    `Scope: ${summary.sinceDays === null ? 'all submitted records' : `last ${summary.sinceDays} day(s)`}`,
    `Sites checked: ${summary.totalSitesChecked}`,
    `Sites with issues: ${summary.sitesWithIssues}`,
    `Total missing: ${summary.totalMissingInCleanClaims}`,
    '',
    ...top,
  ].join('\n');
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
    const shouldNotify = notify && (summary.totalMissingInCleanClaims > 0 || summary.sitesWithIssues > 0);

    let alerted = false;
    let alertMessage: string | undefined;
    if (shouldNotify) {
      const alertText = buildAlertText(summary);
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

