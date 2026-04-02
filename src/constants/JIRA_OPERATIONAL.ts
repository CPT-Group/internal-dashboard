/**
 * Operational Jira dashboard: Dev team board spanning CM, OPRD, and NOVA.
 * JQL modeled after the "Case Management Data Team Board" filter (V.3).
 *
 * "Opened" / "Landed on team" = when tickets transition OUT of their staging
 * status: CM/OPRD transition FROM "New"; NOVA direct-to-sprint tickets use
 * created date, NOVA template-cloned tickets use transition FROM "Backlog".
 * This reflects when work actually becomes visible to the dev team.
 */

import { NOVA_TEAM_ACCOUNT_IDS_ARRAY } from './NOVA_TEAM';

export const JIRA_OPERATIONAL_PROJECTS = ['CM', 'OPRD', 'NOVA'] as const;

/** Components tracked on the dev board (shared by CM, OPRD, and NOVA). */
const CM_OPRD_COMPONENTS = [
  'NCOA/ACS',
  'Interactive Website',
  'Static Website',
  'Case Database',
  'Web Database',
  'Downloader',
  'Weekly Reports',
  'SCP',
  'Shut Down Service',
  'Data Analysis',
  'Database Migration',
  'Docket Update',
  'Website',
].map((c) => `"${c}"`).join(', ');

/** CM/OPRD base: dev components, no Epics. */
const CM_OPRD_BASE = `component IN (${CM_OPRD_COMPONENTS}) AND issuetype != Epic`;

/** NOVA team assignees for JQL IN clause. */
const NOVA_ASSIGNEES = NOVA_TEAM_ACCOUNT_IDS_ARRAY.map((id) => `"${id}"`).join(', ');

/**
 * NOVA base: team members in open sprints only (matches actual board filter).
 * The board uses: project = "Software Development" AND assignee IN (...) AND sprint in openSprints()
 */
const NOVA_BASE = `project = NOVA AND assignee IN (${NOVA_ASSIGNEES}) AND sprint in openSprints()`;

/**
 * Open/active items — mirrors the Case Management Data Team Board filter (V.3).
 *
 * CM:   not "New", not Done, dev components, no Epics
 * OPRD: (labels linked-to-CM, no Epics) OR (not New, not Done, dev components, no Epics)
 * NOVA: team assignees in open sprints
 */
const BOARD_FILTER = [
  `( project = CM AND status != New AND statusCategory != Done AND ${CM_OPRD_BASE} )`,
  `( project = OPRD AND labels IN ("linked-to-CM") AND issuetype != Epic )`,
  `( project = OPRD AND status != New AND statusCategory != Done AND ${CM_OPRD_BASE} )`,
  `( ${NOVA_BASE} AND statusCategory != Done )`,
].join(' OR ');

/**
 * "Landed on team" = when work becomes visible to devs.
 *
 * CM/OPRD: ticket transitioned FROM "New" (CMs create in New; devs see it once it moves).
 * NOVA — two paths:
 *   1. Direct-to-sprint (Bug, Case Update Request, dev-originated): created after the
 *      date and never in Backlog — these land immediately at creation.
 *   2. Template-cloned: sat in Backlog until submitted → transitioned OUT of Backlog.
 *      The transition date is when work landed, NOT the created date.
 */
const LANDED_CM_OPRD = (after: string) =>
  `project IN (CM, OPRD) AND status changed FROM "New" AFTER ${after} AND ${CM_OPRD_BASE}`;

const NOVA_LANDED = (after: string) =>
  `(project = NOVA AND created >= ${after} AND status != Backlog) OR ` +
  `(project = NOVA AND status changed FROM "Backlog" AFTER ${after})`;

const NOVA_LANDED_RANGE = (after: string, before: string) =>
  `(project = NOVA AND created >= ${after} AND created < ${before} AND status != Backlog) OR ` +
  `(project = NOVA AND status changed FROM "Backlog" AFTER ${after} BEFORE ${before})`;

const LANDED_COMBINED = (after: string) =>
  `(${LANDED_CM_OPRD(after)}) OR ${NOVA_LANDED(after)}`;

/**
 * Scoped filter for resolved queries (includes Done items since they're resolved).
 * Excludes "New" from CM/OPRD since those were never dev work.
 */
const SCOPED_FILTER = [
  `( project = CM AND status != New AND ${CM_OPRD_BASE} )`,
  `( project = OPRD AND status != New AND ${CM_OPRD_BASE} )`,
  `( project = NOVA )`,
].join(' OR ');

// ── Open issues ──

/** All open/active issues matching the dev board (KPIs, backlog, aging, oldest 10). */
export const JIRA_OPERATIONAL_JQL_OPEN =
  `${BOARD_FILTER} ORDER BY created DESC`;

/**
 * Limbo (Dev Corner One KPI): NOVA tickets currently in active sprint, still in To Do,
 * and unassigned. Backlog and assigned tickets are excluded by definition.
 */
export const JIRA_OPERATIONAL_JQL_LIMBO =
  `project = NOVA AND sprint in openSprints() AND status IN ("To Do", "TO DO") AND assignee IS EMPTY ORDER BY created DESC`;

// ── "Landed on team" (transition-based opened) ──

/** Landed on team today: CM/OPRD transitioned from New + NOVA created. */
export const JIRA_OPERATIONAL_JQL_LANDED_TODAY =
  `${LANDED_COMBINED('startOfDay()')} ORDER BY updated DESC`;

/** Landed on team in last 14 days (for flow chart opened side). */
export const JIRA_OPERATIONAL_JQL_LANDED_LAST_14 =
  `${LANDED_COMBINED('startOfDay(-14)')} ORDER BY updated DESC`;

/** Landed on team in previous 14-day window (days -28 to -14) for trend comparison. */
export const JIRA_OPERATIONAL_JQL_LANDED_PREV_14 =
  `(${LANDED_CM_OPRD('startOfDay(-28)')}) AND NOT (${LANDED_CM_OPRD('startOfDay(-14)')}) OR ${NOVA_LANDED_RANGE('startOfDay(-28)', 'startOfDay(-14)')} ORDER BY updated DESC`;

// ── Resolved ──

/**
 * Closed today = handed to requesters/UAT today (not final Jira resolution).
 * CM uses "Data Team Complete", OPRD/NOVA use "UAT".
 */
export const JIRA_OPERATIONAL_JQL_CLOSED_TODAY =
  `(` +
  `(project = CM AND status changed TO "Data Team Complete" AFTER startOfDay() AND status != New AND ${CM_OPRD_BASE}) OR ` +
  `(project = OPRD AND status changed TO UAT AFTER startOfDay() AND status != New AND ${CM_OPRD_BASE}) OR ` +
  `(project = NOVA AND status changed TO UAT AFTER startOfDay())` +
  `) ORDER BY updated DESC`;

/** Resolved in last 14 days (flow chart closed side). */
export const JIRA_OPERATIONAL_JQL_RESOLVED_LAST_14 =
  `(${SCOPED_FILTER}) AND resolutiondate >= startOfDay(-14) ORDER BY resolutiondate DESC`;

/** Resolved in previous 14-day window (days -28 to -14) for trend comparison. */
export const JIRA_OPERATIONAL_JQL_RESOLVED_PREV_14 =
  `(${SCOPED_FILTER}) AND resolutiondate >= startOfDay(-28) AND resolutiondate < startOfDay(-14) ORDER BY resolutiondate DESC`;
