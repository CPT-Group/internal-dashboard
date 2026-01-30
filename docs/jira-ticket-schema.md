# Jira Ticket Schema (NOVA Analytics)

Schema for Jira issues used in dashboard analytics. We focus on **project NOVA** ([cptgroup.atlassian.net/jira/software/c/projects/NOVA](https://cptgroup.atlassian.net/jira/software/c/projects/NOVA)).

**Source:** Jira Cloud REST API v3 — [Issue Search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/) (POST `/rest/api/3/search/jql`).

**Types in code:** `src/types/jira/` — `JiraIssue`, `JiraIssueFields`, `JiraSearchResponse`, etc.

---

## Issue (Ticket)

| Field   | Type   | Description                |
|---------|--------|----------------------------|
| `id`    | string | Jira issue ID (numeric string) |
| `key`   | string | Issue key (e.g. `NOVA-123`)    |
| `self`  | string | API URL for this issue         |
| `fields`| object | See [Fields](#fields) below    |

---

## Fields

Fields we use for analytics (aligned with `JiraIssueFields` in code).

| Field       | Type   | Description |
|-------------|--------|-------------|
| `summary`   | string | Ticket title |
| `status`    | object | Current status — see [Status](#status) |
| `project`   | object | Project (e.g. NOVA) — see [Project](#project) |
| `assignee`  | object \| null | Assignee user — see [User](#user) |
| `created`   | string | ISO 8601 created date |
| `updated`   | string | ISO 8601 last updated date |
| `issuetype` | object | Issue type (Bug, Story, Task, etc.) — see [Issue Type](#issue-type) |
| `priority`  | object \| optional | Priority — see [Priority](#priority) |

---

## Status

| Field            | Type   | Description |
|------------------|--------|-------------|
| `id`             | string | Status ID   |
| `name`           | string | Status name (e.g. To Do, In Progress, Done) |
| `statusCategory`| object \| optional | `key`, `name` (e.g. "done", "indeterminate") |

---

## Project

| Field  | Type   | Description    |
|--------|--------|----------------|
| `key`  | string | Project key (e.g. `NOVA`) |
| `id`   | string | Project ID     |
| `name` | string | Project name   |

---

## User (assignee, reporter, etc.)

| Field         | Type   | Description      |
|---------------|--------|------------------|
| `accountId`   | string | Atlassian account ID |
| `displayName` | string \| optional | Display name |
| `emailAddress`| string \| optional | Email          |

---

## Issue Type

| Field  | Type   | Description     |
|--------|--------|-----------------|
| `id`   | string | Issue type ID   |
| `name` | string | e.g. Bug, Story, Task, Sub-task |

---

## Priority

| Field  | Type   | Description   |
|--------|--------|----------------|
| `id`   | string | Priority ID   |
| `name` | string | e.g. Highest, High, Medium, Low |

---

## Search Request (JQL)

**Endpoint:** `GET /api/jira/search` (our proxy) or POST Jira `/rest/api/3/search/jql`.

| Query / Body | Type   | Description |
|--------------|--------|-------------|
| `jql`        | string | JQL query (e.g. `project = NOVA order by created DESC`) |
| `maxResults` | number | Page size (default 50, max 100 per request in our API) |
| `startAt`    | number | Offset (legacy; new API uses `nextPageToken`) |
| `fields`     | string[] | Optional list of field IDs to return |

**Example JQL for NOVA:**
- All NOVA: `project = NOVA`
- Recent: `project = NOVA order by created DESC`
- Open: `project = NOVA AND status != Done`
- This sprint: `project = NOVA AND sprint in openSprints()`

---

## Search Response

| Field        | Type   | Description        |
|--------------|--------|--------------------|
| `success`   | boolean | From our API wrapper |
| `startAt`   | number | Offset for this page   |
| `maxResults`| number | Page size              |
| `total`     | number | Count returned (page)  |
| `issues`    | array  | List of [Issue](#issue-ticket) objects |

---

## Analytics Use

For NOVA dashboards we typically use:

- **Counts:** total tickets, by status, by type, by assignee, by priority
- **Trends:** created/updated over time, resolution rate
- **Lists:** recent tickets, by status, unassigned
- **Charts:** status distribution, type distribution, priority, assignee workload

Request `fields` when calling search so Jira returns full issue objects (e.g. `summary`, `status`, `assignee`, `created`, `updated`, `issuetype`, `priority`, `project`). Our service and types support these fields.
