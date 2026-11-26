/**
 * Tests for API route hardening: named Jira queries, Salesforce debug-route gate, and the
 * Website Health ticket shared secret. No network: global fetch is stubbed and refuses any
 * host other than the dummy Jira host below. No real credentials are used.
 *
 * Run: npm run test:api-route-hardening
 */

import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

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
  JIRA_OFFICE_JACKIE_ACCOUNT_ID,
  JIRA_OFFICE_JULIE_ACCOUNT_ID,
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
} from '../src/constants';
import type { JiraNamedQueryName, JiraNamedQueryParams } from '../src/constants';
import {
  formatJqlDateTime,
  jqlTicketsCreatedToday,
  jqlTicketsTransitionedToday,
  jqlTicketsUpdatedSince,
} from '../src/services/api/endpoints/jira/jql';
import { resolveJiraNamedSearch } from '../src/services/jira/namedQueries';
import { sharedSecretMatches } from '../src/lib/sharedSecret';
import {
  WEBSITE_HEALTH_TICKET_SECRET_ENV,
  WEBSITE_HEALTH_TICKET_SECRET_HEADER,
} from '../src/lib/websiteHealthTicketAuth';
import { GET as jiraSearchGET } from '../src/app/api/jira/search/route';
import { GET as salesforceQueryGET } from '../src/app/api/salesforce/query/route';
import { GET as salesforceDiscoverGET } from '../src/app/api/salesforce/discover/route';
import { POST as websiteHealthTicketPOST } from '../src/app/api/jira/website-health-ticket/route';

// ── Environment + network isolation ─────────────────────────────────────────

const DUMMY_JIRA_HOST = 'jira.route-test.invalid';
const ENV_TO_CLEAR = [
  'JIRA_IMPEDIMENTS_TEAMS_WEBHOOK_URL',
  'SALESFORCE_DEBUG_ROUTES_ENABLED',
  'SF_CLIENT_ID',
  'SF_CLIENT_SECRET',
  'SALESFORCE_CONSUMER_KEY',
  'SALESFORCE_CONSUMER_SECRET',
  'SALESFORCE_EMAIL_KYLE',
  'SALESFORCE_PASSWORD_KYLE',
  'SALESFORCE_SECURITY_TOKEN_KYLE',
  WEBSITE_HEALTH_TICKET_SECRET_ENV,
  'WEBSITE_HEALTH_JIRA_PROJECT_KEY',
  'WEBSITE_HEALTH_JIRA_ISSUE_TYPE',
];
for (const key of ENV_TO_CLEAR) delete process.env[key];
process.env.JIRA_BASE_URL = `https://${DUMMY_JIRA_HOST}`;
process.env.KYLE_EMAIL = 'route-test@example.invalid';
process.env.KYLE_JIRA_TOKEN = 'route-test-dummy-token';

interface RecordedCall {
  url: string;
  method: string;
  body: string | null;
}

const recordedCalls: RecordedCall[] = [];
let nextJiraResponse: () => Response = () => Response.json({ issues: [], isLast: true });

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const body = typeof init?.body === 'string' ? init.body : null;
  recordedCalls.push({ url, method: init?.method ?? 'GET', body });
  if (new URL(url).host !== DUMMY_JIRA_HOST) {
    throw new Error(`Unexpected network call in test: ${new URL(url).host}`);
  }
  return nextJiraResponse();
}) as typeof fetch;

function resetCalls(): void {
  recordedCalls.length = 0;
  nextJiraResponse = () => Response.json({ issues: [], isLast: true });
}

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  resetCalls();
  await fn();
  passed += 1;
  console.log(`ok ${name}`);
}

function qs(entries: Record<string, string>): URLSearchParams {
  return new URLSearchParams(entries);
}

function searchRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/jira/search?${query}`);
}

// ── Expected JQL per named query (the constants/builders the widgets used before) ──

const STATIC_EXPECTED: ReadonlyArray<readonly [JiraNamedQueryName, string]> = [
  ['dev1-list', JIRA_DEV1_JQL],
  ['dev1-open', JIRA_DEV1_JQL_OPEN],
  ['nova-today', JIRA_NOVA_JQL_TODAY],
  ['nova-open', JIRA_NOVA_JQL_OPEN],
  ['nova-overdue', JIRA_NOVA_JQL_OVERDUE],
  ['nova-done', JIRA_NOVA_JQL_DONE],
  ['trevor-list', JIRA_TREVOR_JQL],
  ['trevor-open', JIRA_TREVOR_JQL_OPEN],
  ['operational-open', JIRA_OPERATIONAL_JQL_OPEN],
  ['operational-limbo', JIRA_OPERATIONAL_JQL_LIMBO],
  ['operational-landed-today', JIRA_OPERATIONAL_JQL_LANDED_TODAY],
  ['operational-closed-today', JIRA_OPERATIONAL_JQL_CLOSED_TODAY],
  ['operational-landed-last-14', JIRA_OPERATIONAL_JQL_LANDED_LAST_14],
  ['operational-resolved-last-14', JIRA_OPERATIONAL_JQL_RESOLVED_LAST_14],
  ['operational-landed-prev-14', JIRA_OPERATIONAL_JQL_LANDED_PREV_14],
  ['operational-resolved-prev-14', JIRA_OPERATIONAL_JQL_RESOLVED_PREV_14],
  ['impediment-link-carriers', JIRA_IMPEDIMENT_LINK_CARRIERS_JQL],
  ['nova-transitioned-today', jqlTicketsTransitionedToday()],
  ['nova-created-today', jqlTicketsCreatedToday()],
];

/** The template that lived inline in useAssignedJiraTickets before named queries. */
function originalOfficeAssignedJql(accountId: string): string {
  return `assignee = "${accountId}" AND statusCategory != Done AND status != Backlog ORDER BY updated DESC`;
}

const SAMPLE_SINCE = new Date(2026, 10, 26, 14, 5);

const PARAMETERISED_VALID: ReadonlyArray<readonly [JiraNamedQueryName, JiraNamedQueryParams]> = [
  ['office-assigned-active', { accountId: JIRA_OFFICE_JACKIE_ACCOUNT_ID }],
  ['nova-updated-since', { since: formatJqlDateTime(SAMPLE_SINCE) }],
];

async function main(): Promise<void> {
  // ── Resolver: refusals ──

  await test('raw jql is refused (alone) with an explicit jql message', () => {
    const r = resolveJiraNamedSearch(qs({ jql: 'key = NOVA-1' }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /raw jql/i);
  });

  await test('raw jql is refused even alongside a known name', () => {
    const r = resolveJiraNamedSearch(qs({ query: 'dev1-list', jql: 'project = HR' }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /raw jql/i);
  });

  await test('missing query name is refused', () => {
    assert.equal(resolveJiraNamedSearch(qs({})).ok, false);
    assert.equal(resolveJiraNamedSearch(qs({ query: '   ' })).ok, false);
  });

  await test('unknown and prototype-shaped names are refused', () => {
    for (const name of ['not-a-query', 'DEV1-LIST', '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      assert.equal(resolveJiraNamedSearch(qs({ query: name })).ok, false, name);
    }
  });

  await test('undeclared parameters are refused', () => {
    assert.equal(resolveJiraNamedSearch(qs({ query: 'dev1-list', foo: '1' })).ok, false);
    assert.equal(
      resolveJiraNamedSearch(qs({ query: 'dev1-list', accountId: JIRA_OFFICE_JACKIE_ACCOUNT_ID })).ok,
      false
    );
  });

  await test('duplicate parameters are refused', () => {
    const params = new URLSearchParams('query=dev1-list&query=nova-open');
    assert.equal(resolveJiraNamedSearch(params).ok, false);
  });

  await test('maxResults must be a positive integer', () => {
    for (const bad of ['abc', '0', '-1', '1e3', '1.5', '', '9999999']) {
      assert.equal(resolveJiraNamedSearch(qs({ query: 'dev1-list', maxResults: bad })).ok, false, bad);
    }
  });

  await test('fields outside the allowlist are refused', () => {
    for (const bad of ['description', '*all', 'summary,comment', 'attachment']) {
      assert.equal(resolveJiraNamedSearch(qs({ query: 'dev1-list', fields: bad })).ok, false, bad);
    }
  });

  await test('office-assigned-active refuses non-allowlisted or injected accountId', () => {
    const bad = [
      '712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f',
      `${JIRA_OFFICE_JACKIE_ACCOUNT_ID}" OR project = HR OR assignee = "x`,
      '',
    ];
    for (const accountId of bad) {
      assert.equal(
        resolveJiraNamedSearch(qs({ query: 'office-assigned-active', accountId })).ok,
        false,
        accountId
      );
    }
    assert.equal(resolveJiraNamedSearch(qs({ query: 'office-assigned-active' })).ok, false);
  });

  await test('nova-updated-since refuses anything but yyyy-MM-dd HH:mm', () => {
    const bad = [
      '2026-11-26 14:05" OR project = HR OR updated >= "2020-01-01 00:00',
      '2026-11-26',
      '2026-13-01 00:00',
      '2026-11-26 24:00',
      '2026-11-26T14:05',
      ' 2026-11-26 14:05',
    ];
    for (const since of bad) {
      assert.equal(resolveJiraNamedSearch(qs({ query: 'nova-updated-since', since })).ok, false, since);
    }
    assert.equal(resolveJiraNamedSearch(qs({ query: 'nova-updated-since' })).ok, false);
  });

  // ── Resolver: acceptance + byte-identical JQL ──

  await test('every static named query resolves to its original JQL, byte for byte', () => {
    for (const [name, expected] of STATIC_EXPECTED) {
      const r = resolveJiraNamedSearch(qs({ query: name }));
      assert.ok(r.ok, name);
      if (r.ok) assert.equal(r.jql, expected, name);
    }
  });

  await test('office-assigned-active matches the original inline template for both screens', () => {
    for (const accountId of [JIRA_OFFICE_JACKIE_ACCOUNT_ID, JIRA_OFFICE_JULIE_ACCOUNT_ID]) {
      const r = resolveJiraNamedSearch(qs({ query: 'office-assigned-active', accountId, maxResults: '100' }));
      assert.ok(r.ok, accountId);
      if (r.ok) {
        assert.equal(r.jql, originalOfficeAssignedJql(accountId));
        assert.equal(r.maxResults, 100);
      }
    }
  });

  await test('nova-updated-since matches the original jqlTicketsUpdatedSince builder', () => {
    const since = formatJqlDateTime(SAMPLE_SINCE);
    assert.equal(since, '2026-11-26 14:05');
    const r = resolveJiraNamedSearch(qs({ query: 'nova-updated-since', since }));
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.jql, jqlTicketsUpdatedSince(SAMPLE_SINCE));
  });

  await test('every declared name is covered by this suite', () => {
    const covered = new Set<string>([
      ...STATIC_EXPECTED.map(([name]) => name),
      ...PARAMETERISED_VALID.map(([name]) => name),
    ]);
    for (const name of JIRA_NAMED_QUERY_NAMES) assert.ok(covered.has(name), `untested name: ${name}`);
    assert.equal(covered.size, JIRA_NAMED_QUERY_NAMES.length);
  });

  await test('maxResults: default 100, clamped to 500, small values kept', () => {
    const cases: ReadonlyArray<readonly [string | null, number]> = [
      [null, 100],
      ['1', 1],
      ['100', 100],
      ['1000', 500],
    ];
    for (const [raw, expected] of cases) {
      const params = qs({ query: 'dev1-open' });
      if (raw !== null) params.set('maxResults', raw);
      const r = resolveJiraNamedSearch(params);
      assert.ok(r.ok, String(raw));
      if (r.ok) assert.equal(r.maxResults, expected, String(raw));
    }
  });

  await test('impediment field list is accepted unchanged; omitted fields stay default', () => {
    const fields = [...JIRA_IMPEDIMENT_SEARCH_FIELDS];
    const r = resolveJiraNamedSearch(qs({ query: 'operational-open', fields: fields.join(',') }));
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.fields, fields);
    const omitted = resolveJiraNamedSearch(qs({ query: 'operational-open' }));
    assert.ok(omitted.ok);
    if (omitted.ok) assert.equal(omitted.fields, undefined);
  });

  // ── Route: GET /api/jira/search ──

  await test('route: raw jql returns 400 and never calls Jira', async () => {
    const res = await jiraSearchGET(searchRequest('jql=key%3DNOVA-1'));
    assert.equal(res.status, 400);
    assert.equal(recordedCalls.length, 0);
  });

  await test('route: known name + raw jql returns 400 and never calls Jira', async () => {
    const res = await jiraSearchGET(searchRequest('query=dev1-list&jql=project%3DHR'));
    assert.equal(res.status, 400);
    assert.equal(recordedCalls.length, 0);
  });

  await test('route: unknown name returns 400 and never calls Jira', async () => {
    const res = await jiraSearchGET(searchRequest('query=does-not-exist'));
    assert.equal(res.status, 400);
    assert.equal(recordedCalls.length, 0);
  });

  await test('route: known name runs exactly the server-defined JQL', async () => {
    const res = await jiraSearchGET(searchRequest('query=nova-open&maxResults=1000'));
    assert.equal(res.status, 200);
    const json = (await res.json()) as { success: boolean };
    assert.equal(json.success, true);
    assert.equal(recordedCalls.length, 1);
    const call = recordedCalls[0];
    assert.equal(new URL(call.url).pathname, '/rest/api/3/search/jql');
    assert.equal(call.method, 'POST');
    const sent = JSON.parse(call.body ?? '{}') as { jql?: string };
    assert.equal(sent.jql, JIRA_NOVA_JQL_OPEN);
  });

  // ── Salesforce debug routes ──

  const sfQuery = (): NextRequest =>
    new NextRequest('http://localhost/api/salesforce/query?q=SELECT%20Id%20FROM%20Account%20LIMIT%201');
  const sfDiscover = (): NextRequest => new NextRequest('http://localhost/api/salesforce/discover');

  await test('salesforce: query + discover are 404 by default', async () => {
    assert.equal((await salesforceQueryGET(sfQuery())).status, 404);
    assert.equal((await salesforceDiscoverGET(sfDiscover())).status, 404);
    assert.equal(recordedCalls.length, 0);
  });

  await test('salesforce: anything other than exactly "true" stays 404', async () => {
    for (const value of ['TRUE', '1', 'yes', 'on', 'false', '']) {
      process.env.SALESFORCE_DEBUG_ROUTES_ENABLED = value;
      assert.equal((await salesforceQueryGET(sfQuery())).status, 404, value);
      assert.equal((await salesforceDiscoverGET(sfDiscover())).status, 404, value);
    }
    delete process.env.SALESFORCE_DEBUG_ROUTES_ENABLED;
    assert.equal(recordedCalls.length, 0);
  });

  await test('salesforce: "true" opens the gate (control - reaches the service, not the 404)', async () => {
    process.env.SALESFORCE_DEBUG_ROUTES_ENABLED = 'true';
    const res = await salesforceQueryGET(sfQuery());
    delete process.env.SALESFORCE_DEBUG_ROUTES_ENABLED;
    // No SF credentials in this process, so the service itself fails - but past the gate.
    assert.notEqual(res.status, 404);
    assert.equal(recordedCalls.length, 0);
  });

  // ── Website Health ticket POST ──

  const ticketBody = JSON.stringify({
    site: {
      siteKey: 'route-test-site',
      status: 'ok',
      webDbStatus: 'ok',
      webDbIssueCount: 0,
      missingCount: 0,
      submittedOnlineCount: 0,
      matchedInCleanClaimsCount: 0,
      websiteDbName: 'route_test_web',
      cleanClaimsDbName: 'route_test_claims',
      deadlineDate: null,
      errorMessage: null,
    },
    sinceDays: 1,
    runAt: '2026-11-26T22:00:00.000Z',
    missingItems: [],
    webDbIssueItems: [],
  });
  const TEST_SECRET = 'route-test-shared-secret-not-real';
  const ticketRequest = (secret?: string): NextRequest =>
    new NextRequest('http://localhost/api/jira/website-health-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret === undefined ? {} : { [WEBSITE_HEALTH_TICKET_SECRET_HEADER]: secret }),
      },
      body: ticketBody,
    });

  await test('sharedSecretMatches: equal only', () => {
    assert.equal(sharedSecretMatches('abc', 'abc'), true);
    assert.equal(sharedSecretMatches('abd', 'abc'), false);
    assert.equal(sharedSecretMatches('abcd', 'abc'), false);
    assert.equal(sharedSecretMatches(null, 'abc'), false);
    assert.equal(sharedSecretMatches('', ''), false);
  });

  await test('ticket POST: secret env unset -> refused, Jira never called', async () => {
    const res = await websiteHealthTicketPOST(ticketRequest(TEST_SECRET));
    assert.equal(res.status, 404);
    assert.equal(recordedCalls.length, 0);
  });

  await test('ticket POST: secret env blank -> refused (fail closed)', async () => {
    process.env[WEBSITE_HEALTH_TICKET_SECRET_ENV] = '   ';
    const res = await websiteHealthTicketPOST(ticketRequest('   '));
    delete process.env[WEBSITE_HEALTH_TICKET_SECRET_ENV];
    assert.equal(res.status, 404);
    assert.equal(recordedCalls.length, 0);
  });

  await test('ticket POST: missing or wrong secret header -> 401, Jira never called', async () => {
    process.env[WEBSITE_HEALTH_TICKET_SECRET_ENV] = TEST_SECRET;
    for (const header of [undefined, '', 'wrong', `${TEST_SECRET}x`, TEST_SECRET.slice(1)]) {
      const res = await websiteHealthTicketPOST(ticketRequest(header));
      assert.equal(res.status, 401, String(header));
    }
    delete process.env[WEBSITE_HEALTH_TICKET_SECRET_ENV];
    assert.equal(recordedCalls.length, 0);
  });

  await test('ticket POST: correct secret passes the gate (control - creates via stub)', async () => {
    process.env[WEBSITE_HEALTH_TICKET_SECRET_ENV] = TEST_SECRET;
    nextJiraResponse = () => Response.json({ id: '1', key: 'TEST-1', self: 'https://example.invalid' });
    const res = await websiteHealthTicketPOST(ticketRequest(TEST_SECRET));
    delete process.env[WEBSITE_HEALTH_TICKET_SECRET_ENV];
    assert.equal(res.status, 200);
    assert.equal(recordedCalls.length, 1);
    assert.equal(new URL(recordedCalls[0].url).pathname, '/rest/api/3/issue');
  });

  console.log(`All ${passed} API route hardening tests passed.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
