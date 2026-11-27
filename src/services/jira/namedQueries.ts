/**
 * Server-side allowlist for `GET /api/jira/search`.
 *
 * Every Jira search the dashboard runs is one of these named queries. The route resolves the
 * name to JQL HERE, on the server; it never accepts JQL from the caller. Parameterised queries
 * declare their parameters, and each parameter has a strict validator, so no caller-supplied
 * text reaches JQL unless it matched an allowlist or a fixed pattern.
 *
 * The JQL strings are the same constants/builders the widgets used before this registry existed,
 * so each widget's query is byte-identical (asserted in scripts/test-api-route-hardening.ts).
 */

import {
  JIRA_DEV1_JQL,
  JIRA_DEV1_JQL_OPEN,
  JIRA_IMPEDIMENT_LINK_CARRIERS_JQL,
  JIRA_IMPEDIMENT_SEARCH_FIELDS,
  JIRA_NAMED_QUERY_NAMES,
  JIRA_NOVA_JQL_DONE,
  JIRA_NOVA_JQL_OPEN,
  JIRA_NOVA_JQL_OVERDUE,
  JIRA_NOVA_JQL_TODAY,
  JIRA_OFFICE_ASSIGNEE_ACCOUNT_IDS,
  JIRA_OPERATIONAL_JQL_CLOSED_TODAY,
  JIRA_OPERATIONAL_JQL_LANDED_LAST_14,
  JIRA_OPERATIONAL_JQL_LANDED_PREV_14,
  JIRA_OPERATIONAL_JQL_LANDED_TODAY,
  JIRA_OPERATIONAL_JQL_LIMBO,
  JIRA_OPERATIONAL_JQL_OPEN,
  JIRA_OPERATIONAL_JQL_RESOLVED_LAST_14,
  JIRA_OPERATIONAL_JQL_RESOLVED_PREV_14,
  JIRA_TREVOR_JQL,
  JIRA_TREVOR_JQL_OPEN,
} from '@/constants';
import type { JiraNamedQueryName, JiraNamedQueryParamName } from '@/constants';
import {
  jqlTicketsCreatedToday,
  jqlTicketsTransitionedToday,
  jqlTicketsUpdatedAfter,
} from '@/services/api/endpoints/jira/jql';
import { DEFAULT_JIRA_FIELDS } from '@/services/api/jiraService';

type NamedQueryParamValues = ReadonlyMap<JiraNamedQueryParamName, string>;

interface JiraNamedQueryDefinition {
  /** Parameters this query requires. Anything else on the request is refused. */
  readonly params: readonly JiraNamedQueryParamName[];
  readonly buildJql: (params: NamedQueryParamValues) => string;
}

function staticQuery(jql: string): JiraNamedQueryDefinition {
  return { params: [], buildJql: () => jql };
}

function paramValue(params: NamedQueryParamValues, name: JiraNamedQueryParamName): string {
  const value = params.get(name);
  if (value === undefined) {
    throw new Error(`Named query parameter was not validated: ${name}`);
  }
  return value;
}

/** Assignee-scoped active tickets for the office corner screens (was inline in useAssignedJiraTickets). */
function jqlOfficeAssignedActive(accountId: string): string {
  return `assignee = "${accountId}" AND statusCategory != Done AND status != Backlog ORDER BY updated DESC`;
}

const JIRA_NAMED_QUERIES: Readonly<Record<JiraNamedQueryName, JiraNamedQueryDefinition>> = {
  'dev1-list': staticQuery(JIRA_DEV1_JQL),
  'dev1-open': staticQuery(JIRA_DEV1_JQL_OPEN),
  'nova-today': staticQuery(JIRA_NOVA_JQL_TODAY),
  'nova-open': staticQuery(JIRA_NOVA_JQL_OPEN),
  'nova-overdue': staticQuery(JIRA_NOVA_JQL_OVERDUE),
  'nova-done': staticQuery(JIRA_NOVA_JQL_DONE),
  'trevor-list': staticQuery(JIRA_TREVOR_JQL),
  'trevor-open': staticQuery(JIRA_TREVOR_JQL_OPEN),
  'operational-open': staticQuery(JIRA_OPERATIONAL_JQL_OPEN),
  'operational-limbo': staticQuery(JIRA_OPERATIONAL_JQL_LIMBO),
  'operational-landed-today': staticQuery(JIRA_OPERATIONAL_JQL_LANDED_TODAY),
  'operational-closed-today': staticQuery(JIRA_OPERATIONAL_JQL_CLOSED_TODAY),
  'operational-landed-last-14': staticQuery(JIRA_OPERATIONAL_JQL_LANDED_LAST_14),
  'operational-resolved-last-14': staticQuery(JIRA_OPERATIONAL_JQL_RESOLVED_LAST_14),
  'operational-landed-prev-14': staticQuery(JIRA_OPERATIONAL_JQL_LANDED_PREV_14),
  'operational-resolved-prev-14': staticQuery(JIRA_OPERATIONAL_JQL_RESOLVED_PREV_14),
  'impediment-link-carriers': staticQuery(JIRA_IMPEDIMENT_LINK_CARRIERS_JQL),
  'office-assigned-active': {
    params: ['accountId'],
    buildJql: (params) => jqlOfficeAssignedActive(paramValue(params, 'accountId')),
  },
  'nova-transitioned-today': staticQuery(jqlTicketsTransitionedToday()),
  'nova-created-today': staticQuery(jqlTicketsCreatedToday()),
  'nova-updated-since': {
    params: ['since'],
    buildJql: (params) => jqlTicketsUpdatedAfter(paramValue(params, 'since')),
  },
};

/** yyyy-MM-dd HH:mm with in-range month/day/hour/minute - the only shape `since` may take. */
const JQL_DATE_TIME_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):[0-5]\d$/;

const PARAM_VALIDATORS: Readonly<Record<JiraNamedQueryParamName, (value: string) => boolean>> = {
  accountId: (value) => JIRA_OFFICE_ASSIGNEE_ACCOUNT_IDS.has(value),
  since: (value) => JQL_DATE_TIME_PATTERN.test(value),
};

/** Fields a caller may request. Anything outside this set is refused. */
export const JIRA_SEARCH_ALLOWED_FIELDS: ReadonlySet<string> = new Set<string>([
  ...DEFAULT_JIRA_FIELDS,
  ...JIRA_IMPEDIMENT_SEARCH_FIELDS,
]);

/** Ceiling on maxResults (the route clamped to the same value before named queries). */
export const JIRA_NAMED_SEARCH_MAX_RESULTS_CAP = 500;

/** maxResults when the caller omits it (unchanged). */
export const JIRA_NAMED_SEARCH_DEFAULT_MAX_RESULTS = 100;

const NAMED_QUERY_NAME_SET: ReadonlySet<string> = new Set<string>(JIRA_NAMED_QUERY_NAMES);

const BASE_ALLOWED_KEYS = ['query', 'maxResults', 'fields'] as const;

export function isJiraNamedQueryName(value: string): value is JiraNamedQueryName {
  return NAMED_QUERY_NAME_SET.has(value);
}

export type JiraNamedSearchResolution =
  | {
      readonly ok: true;
      readonly name: JiraNamedQueryName;
      readonly jql: string;
      readonly maxResults: number;
      readonly fields: string[] | undefined;
    }
  | { readonly ok: false; readonly message: string };

function refuse(message: string): JiraNamedSearchResolution {
  return { ok: false, message };
}

function parseMaxResults(raw: string | null): number | null {
  if (raw === null) return JIRA_NAMED_SEARCH_DEFAULT_MAX_RESULTS;
  const trimmed = raw.trim();
  if (!/^\d{1,6}$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (parsed < 1) return null;
  return Math.min(parsed, JIRA_NAMED_SEARCH_MAX_RESULTS_CAP);
}

function parseFields(raw: string | null): string[] | undefined | null {
  if (raw === null) return undefined;
  const requested = raw
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);
  if (requested.length === 0) return undefined;
  if (requested.some((field) => !JIRA_SEARCH_ALLOWED_FIELDS.has(field))) return null;
  return Array.from(new Set(requested));
}

/**
 * Validate a `/api/jira/search` query string and resolve it to server-defined JQL.
 * Pure: no I/O, so it is unit-testable and runs before any Jira call.
 */
export function resolveJiraNamedSearch(searchParams: URLSearchParams): JiraNamedSearchResolution {
  if (searchParams.has('jql')) {
    return refuse('Raw jql is not accepted. Use a named query (query=<name>).');
  }

  const name = searchParams.get('query')?.trim();
  if (!name) return refuse('Missing required query: query');
  if (!isJiraNamedQueryName(name)) return refuse('Unknown query name.');

  const definition = JIRA_NAMED_QUERIES[name];
  const allowedKeys = new Set<string>([...BASE_ALLOWED_KEYS, ...definition.params]);
  for (const key of new Set(searchParams.keys())) {
    if (!allowedKeys.has(key)) return refuse('Unsupported query parameter.');
    if (searchParams.getAll(key).length > 1) return refuse('Duplicate query parameter.');
  }

  const maxResults = parseMaxResults(searchParams.get('maxResults'));
  if (maxResults === null) return refuse('maxResults must be a positive integer.');

  const fields = parseFields(searchParams.get('fields'));
  if (fields === null) return refuse('Unsupported field requested.');

  const params = new Map<JiraNamedQueryParamName, string>();
  for (const paramName of definition.params) {
    const value = searchParams.get(paramName);
    if (value === null || !PARAM_VALIDATORS[paramName](value)) {
      return refuse(`Missing or invalid parameter: ${paramName}`);
    }
    params.set(paramName, value);
  }

  return { ok: true, name, jql: definition.buildJql(params), maxResults, fields };
}
