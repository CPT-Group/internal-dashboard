import { NextRequest } from 'next/server';
import type {
  WebsiteHealthCreateJiraTicketRequest,
  WebsiteHealthCreateJiraTicketResponse,
  WebsiteHealthMissingItem,
  WebsiteHealthSiteResult,
  WebsiteHealthWebDbIssueItem,
} from '@/types';
import { formatWebsiteHealthPacificDateTime } from '@/lib/formatWebsiteHealthPacificDateTime';
import type { JiraAdfDoc } from '@/services/api/jiraService';
import { createIssue } from '@/services/api/jiraService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clampSummary(summary: string): string {
  return summary.length <= 255 ? summary : `${summary.slice(0, 252)}...`;
}

function formatScopeLabel(sinceDays: number | null): string {
  return sinceDays === null ? 'All submitted records' : `Last ${sinceDays} day(s)`;
}

function formatErrorLine(site: WebsiteHealthSiteResult): string {
  if (!site.errorMessage?.trim()) return 'None provided by scanner';
  return site.errorMessage.trim();
}

function formatMissingSampleRows(items: WebsiteHealthMissingItem[]): string[] {
  if (items.length === 0) return ['No missing sample rows in details payload'];
  return items.slice(0, 10).map((item) => {
    const email = item.email?.trim() || '(no email)';
    return `Submission ${item.submissionId} | DateReceived ${formatWebsiteHealthPacificDateTime(item.dateReceived)} | ${email}`;
  });
}

function formatWebDbSampleRows(items: WebsiteHealthWebDbIssueItem[]): string[] {
  if (items.length === 0) return ['No Web DB issue sample rows in details payload'];
  return items.slice(0, 10).map((item) => {
    const dateReceived =
      item.dateReceived === null
        ? '(null DateReceived)'
        : formatWebsiteHealthPacificDateTime(item.dateReceived);
    const reasons = item.reasons.length > 0 ? item.reasons.join(', ') : '(no reasons)';
    return `Submission ${item.submissionId} | DateReceived ${dateReceived} | Reasons: ${reasons}`;
  });
}

function adfTextParagraph(text: string): { type: 'paragraph'; content: Array<{ type: 'text'; text: string }> } {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text }],
  };
}

function adfBulletList(items: string[]): {
  type: 'bulletList';
  content: Array<{
    type: 'listItem';
    content: Array<{ type: 'paragraph'; content: Array<{ type: 'text'; text: string }> }>;
  }>;
} {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [adfTextParagraph(item)],
    })),
  };
}

function buildDescription(body: WebsiteHealthCreateJiraTicketRequest): JiraAdfDoc {
  const site = body.site;
  const issueHighlights: string[] = [
    `Site: ${site.siteKey}`,
    `Web DB status: ${site.webDbStatus.toUpperCase()} (issue rows: ${site.webDbIssueCount})`,
    `Comparison status: ${site.status.toUpperCase()} (missing in CleanClaims: ${site.missingCount})`,
    `Submitted: ${site.submittedOnlineCount} | Matched: ${site.matchedInCleanClaimsCount}`,
    `Website DB: ${site.websiteDbName}`,
    `2K16 CleanClaims DB: ${site.cleanClaimsDbName}`,
    `Deadline: ${site.deadlineDate ?? '(none)'}`,
    `Scan scope: ${formatScopeLabel(body.sinceDays)}`,
    `Scan run timestamp: ${formatWebsiteHealthPacificDateTime(body.runAt)}`,
    `Scanner error detail: ${formatErrorLine(site)}`,
  ];

  return {
    type: 'doc',
    version: 1,
    content: [
      adfTextParagraph('Automated ticket created from Website Health dashboard action.'),
      adfTextParagraph('Observed issue context:'),
      adfBulletList(issueHighlights),
      adfTextParagraph('Sample missing rows (up to 10):'),
      adfBulletList(formatMissingSampleRows(body.missingItems)),
      adfTextParagraph('Sample Web DB integrity rows (up to 10):'),
      adfBulletList(formatWebDbSampleRows(body.webDbIssueItems)),
    ],
  };
}

function isBodyShape(value: unknown): value is WebsiteHealthCreateJiraTicketRequest {
  if (!value || typeof value !== 'object') return false;
  const shape = value as Partial<WebsiteHealthCreateJiraTicketRequest>;
  if (!shape.site || typeof shape.site !== 'object') return false;
  if (!Array.isArray(shape.missingItems)) return false;
  if (!Array.isArray(shape.webDbIssueItems)) return false;
  if (!(shape.sinceDays === null || typeof shape.sinceDays === 'number')) return false;
  return typeof shape.runAt === 'string';
}

export async function POST(request: NextRequest): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isBodyShape(payload)) {
    return Response.json(
      { ok: false, message: 'Invalid Website Health ticket payload.' },
      { status: 400 }
    );
  }

  try {
    const projectKey = process.env.WEBSITE_HEALTH_JIRA_PROJECT_KEY?.trim() || 'NOVA';
    // Default to Task because NOVA Bug currently enforces additional required
    // custom fields that are not available from Website Health payload alone.
    const issueTypeName = process.env.WEBSITE_HEALTH_JIRA_ISSUE_TYPE?.trim() || 'Task';
    const summary = clampSummary(
      `[Website Health] ${payload.site.siteKey} ${payload.site.status.toUpperCase()} / Web DB ${payload.site.webDbStatus.toUpperCase()}`
    );

    const created = await createIssue({
      projectKey,
      issueTypeName,
      summary,
      description: buildDescription(payload),
      labels: ['website-health', 'auto-created'],
    });

    const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, '') ?? 'https://cptgroup.atlassian.net';
    const response: WebsiteHealthCreateJiraTicketResponse = {
      ok: true,
      issueKey: created.key,
      issueUrl: `${baseUrl}/browse/${created.key}`,
    };

    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create Jira ticket.';
    return Response.json({ ok: false, message }, { status: 500 });
  }
}

