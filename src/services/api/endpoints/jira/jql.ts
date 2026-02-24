/**
 * JQL for fine-tuned widget / data API calls.
 * Use these with the generic Jira search so we have one place for query semantics.
 */

const NOVA = 'NOVA';

/** Base for NOVA-only queries (exclude Epics/Sub-tasks like operational). */
const NOVA_BASE = `project = ${NOVA} AND issuetype NOT IN ("Epic", "Sub-task")`;

/**
 * Tickets that were transitioned (resolved) today – i.e. moved to Done today.
 * Uses resolutiondate, not created.
 */
export function jqlTicketsTransitionedToday(): string {
  return `${NOVA_BASE} AND resolutiondate >= startOfDay() ORDER BY resolutiondate DESC`;
}

/** Tickets created today (for "opened today" style widgets). */
export function jqlTicketsCreatedToday(): string {
  return `${NOVA_BASE} AND created >= startOfDay() ORDER BY created DESC`;
}

/**
 * Tickets updated since a given time (for polling "what changed").
 * since: ISO date string or Date; will be formatted for JQL (yyyy-MM-dd HH:mm).
 */
export function jqlTicketsUpdatedSince(since: Date | string): string {
  const d = typeof since === 'string' ? new Date(since) : since;
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const jqlDate = `${y}-${M}-${day} ${h}:${m}`;
  return `${NOVA_BASE} AND updated >= "${jqlDate}" ORDER BY updated DESC`;
}
