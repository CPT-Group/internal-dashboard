import type { CursorAnalyticsSession } from '@/lib/cursorAnalyticsSession';

export type CursorAnalyticsAuditOutcome = 'allow' | 'deny' | 'misconfigured';

export interface CursorAnalyticsAuditEvent {
  event: 'cursor_analytics_access';
  outcome: CursorAnalyticsAuditOutcome;
  actorOid: string | null;
  actorEmail: string | null;
  actorName: string | null;
  path: string;
  method: string;
  reason: string;
  timestamp: string;
}

/** Structured audit log (stdout — captured by Netlify/host logs). No JWTs or secrets. */
export function auditCursorAnalyticsAccess(input: {
  outcome: CursorAnalyticsAuditOutcome;
  session: CursorAnalyticsSession | null;
  path: string;
  method: string;
  reason: string;
}): void {
  const event: CursorAnalyticsAuditEvent = {
    event: 'cursor_analytics_access',
    outcome: input.outcome,
    actorOid: input.session?.oid ?? null,
    actorEmail: input.session?.email ?? null,
    actorName: input.session?.name ?? null,
    path: input.path,
    method: input.method,
    reason: input.reason,
    timestamp: new Date().toISOString(),
  };
  console.info(JSON.stringify(event));
}
