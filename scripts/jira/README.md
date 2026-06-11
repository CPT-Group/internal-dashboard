# Jira Automation Toolkit

Scripts for managing Jira automation rules (NOVA / OPRD / CM) from the terminal
via the Atlassian Automation REST API. Use these instead of clicking through the
Jira UI when you want auditable, scriptable, reviewable changes.

Full API reference: https://developer.atlassian.com/cloud/automation/rest/api-group-rule-management/

> **Agents:** one-off migration/diagnostic scripts belong in **`kyleJira/`** (gitignored), not in tracked `scripts/jira/`. Snapshots and scan JSON go in **`kyleOutput/`**. Do not add new tracked files or README entries for local-only scripts unless promoting reusable tooling. See **AGENTS.md** → "Working tree hygiene (agents)".

---

## TL;DR

```bash
# List every rule (optionally filter by name regex or project ID)
node scripts/jira/list-rules.mjs
node scripts/jira/list-rules.mjs --filter "UAT"
node scripts/jira/list-rules.mjs --project 10183          # NOVA only

# Grab one rule for inspection / rollback snapshot
node scripts/jira/fetch-rule.mjs <ruleUuid> [label]

# Snapshot several rules at once before a bulk edit
node scripts/jira/backup-rules.mjs <uuid>:label <uuid>:label ...

# Re-audit the CPT-managed rules we care about
node scripts/jira/verify-workflow-statuses.mjs     # trigger status IDs vs. each project's workflow
node scripts/jira/verify-rule-scopes.mjs           # project ARI scoping + enabled/disabled
node scripts/jira/verify-rule-behavior.mjs         # one-line summary of each rule's components
node scripts/jira/verify-comment-bodies.mjs        # raw comment text for each rule

# Find a working if/else structure to copy from when writing a new edit script
node scripts/jira/find-ifelse-patterns.mjs

# Tech Owner hygiene (platform REST API — uses KYLE_* or JAMES_* from .env.local)
node scripts/jira/discover-missing-tech-owner.mjs
node scripts/jira/discover-dev-board-attribution.mjs Roy
node scripts/jira/backfill-missing-tech-owner.mjs          # dry-run
node scripts/jira/backfill-missing-tech-owner.mjs --apply  # write Tech Owner to Jira
node scripts/jira/backfill-tech-owner-by-assignee.mjs          # Kyle/Roy/James/Brandon assignee rules (dry-run)
node scripts/jira/backfill-tech-owner-by-assignee.mjs --apply  # same, write to Jira
node scripts/jira/create-tech-owner-on-assignee-rule.mjs --apply  # automation: assignee → Tech Owner (NOVA/OPRD/CM)
node scripts/jira/enable-case-update-bugs-rule.mjs --apply        # re-enable NOVA Case Update/Bug intake rule
node scripts/jira/discover-missing-components.mjs                # fuzzy component suggestions
node scripts/jira/backfill-missing-components.mjs --min-confidence high  # dry-run apply high-confidence
node scripts/jira/stale-uat-ticket-warning.mjs --apply   # post warning panel + @assignee
node scripts/jira/stale-uat-ticket-warning.mjs           # dry-run stale UAT warning comments
npm run test:operational-board-analytics                 # fixture tests (in progress, team activity, impediments)
npm run verify:operational-board                         # live Jira reconcile vs dashboard analytics
```

All backups / snapshots / scan output land under `kyleOutput/` which is gitignored.

---

## Authentication

Two environment variables from `.env.local`, read by `_jiraAuto.mjs`:

- `JAMES_EMAIL`
- `JAMES_JIRA_TOKEN`

**Why James's token and not Kyle's:** the Automation REST API requires the caller
to have the global **"Administer Jira"** permission. Kyle's token does not have
it and returns `403 Forbidden` on `/rest/v1/rule/*`. James's token does. This is
documented in the Atlassian docs under "Authentication and authorization".

All calls use HTTP Basic auth with the base64 of `<email>:<token>`.

---

## Endpoint cheat sheet

The Automation API base URL is derived from the tenant's cloudId:

```
https://api.atlassian.com/automation/public/jira/<cloudId>/rest/v1
```

`_jiraAuto.mjs` fetches the cloudId automatically from
`https://cptgroup.atlassian.net/_edge/tenant_info` and exposes it as `API`.

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/rule/summary?limit=100&cursor=...` | Paginated list of every rule (name, uuid, state, scope). |
| `GET`  | `/rule/{uuid}` | Full rule config (trigger, components, conditions, comment bodies). |
| `POST` | `/rule` | Create a new rule. Body is a `RulePayload`. |
| `PUT`  | `/rule/{uuid}` | Replace an existing rule's payload. **This is how you edit.** |
| `PUT`  | `/rule/{uuid}/state` | Enable/disable without editing the payload. |
| `PUT`  | `/rule/{uuid}/rule-scope` | Change which projects the rule applies to. |
| `DEL`  | `/rule/{uuid}` | Delete a **disabled** rule (enabled rules can't be deleted). |

---

## Editing a rule — safe workflow

1. **Find the UUID.** `list-rules.mjs --filter "some-name"`.
2. **Backup.** `backup-rules.mjs <uuid>:short-label` writes a timestamped JSON snapshot under `kyleOutput/jira-rule-backups/`.
3. **Inspect the component shapes.** Open the backup JSON. Jira Automation is shape-sensitive — fields like `assignType`, `assignee.type`, and `operations[].fieldType` must match what the UI would have produced.
4. **Write a small `.mjs` patch** (keep these in `kyleJira/one-off-migrations/`, gitignored): `getRule(uuid)` → mutate `rule.components` → `putRule(uuid, { rule })`.
5. **Re-fetch and verify.** Either run `fetch-rule.mjs` again or one of the `verify-*.mjs` audits.
6. **Document** the change in `CHANGELOG.md` under `[Unreleased]`.

---

## The shape gotchas we hit (save future-you the debugging)

### 1. `jira.issue.assign` with `SPECIFY_USER`

Works:
```json
{ "assignType": "SPECIFY_USER", "assignee": { "type": "ID", "value": "712020:..." } }
```

Silently **does nothing** (don't do this):
```json
{ "assignType": "SPECIFY_USER", "assignee": { "type": "COPY", "value": "customfield_10194" } }
```

`SPECIFY_USER` only accepts a literal accountId. To copy a user from a field, use
`assignType: "SMART_VALUE"` with a smart value that resolves to an accountId
(see below).

### 2. Copy a user from a custom field

Use a smart value:
```json
{
  "assignType": "SMART_VALUE",
  "smartValue": "{{issue.customfield_10194.accountId}}",
  "assignee": null
}
```

### 3. Inline `conditions[]` on an ACTION component are **not** reliable

The old UAT rules had two `jira.issue.assign` actions, each with an inline
`conditions: [{ type: "jira.jql.condition", value: "cf[10194] is not EMPTY" }]`
gate. Jira ignored those conditions — both actions ran, and the last one won.

Use an explicit IF/ELSE block instead (see next section).

### 4. `jira.issue.edit` uses `operations[]`, not `fields{}`

For a custom-field SET you need the `operations` shape (note `schemaVersion: 12`):

```json
{
  "component": "ACTION",
  "schemaVersion": 12,
  "type": "jira.issue.edit",
  "value": {
    "operations": [
      {
        "field": { "type": "ID", "value": "customfield_10193" },
        "fieldType": "com.atlassian.jira.plugin.system.customfieldtypes:userpicker",
        "type": "SET",
        "value": { "type": "ID", "value": "712020:..." }
      }
    ],
    "advancedFields": null,
    "sendNotifications": true
  }
}
```

A `{ "fields": { "customfield_xxxxx": {...} } }` shape posts fine (200 OK) but is
**silently stripped** server-side on the next GET.

### 5. New `jira.condition.container.block` branches — omit nested `id` fields

PUTting a rule whose **new** IF/ELSE tree includes freshly generated UUIDs on every
nested `CONDITION`, `CONDITION_BLOCK`, and `ACTION` often returns **400** *"Component ids do not match the existing rule or there are duplicate ids"*.
Copy the **minimal** shape from `refactor-uat-ifelse.mjs` (no `id` / `connectionId` /
`parentId` on nested nodes); Jira assigns stable ids on save. Keep only components
that already existed (e.g. `jira.board.issue.move`) exactly as returned from `GET /rule/{uuid}`.

### 6. `jira.worklog.add` component shape

Captured from the UAT rule (`019d556a-689f-72b8-9ebb-c1ccc83deea2`) and re-used by the Auto-log-on-Create rules:

```json
{
  "component": "ACTION",
  "schemaVersion": 4,
  "type": "jira.worklog.add",
  "value": {
    "timeSpent": "5m",
    "dateStarted": { "type": "SMART", "value": "{{now}}" },
    "description": "Auto-logged on create",
    "adjustEstimate": "ADJUST_AUTOMATICALLY",
    "remainingEstimateValue": null,
    "visibility": null
  }
}
```

- `timeSpent` is a **string** using Jira duration format (`5m`, `10m`, `15m`, `1h`, `2h 30m`, etc.) — **not** a number-of-seconds field.
- `adjustEstimate: "ADJUST_AUTOMATICALLY"` decrements the remaining estimate by the worklog amount. Use `"LEAVE"` to leave the remaining estimate untouched (useful for auto-logs where the estimate shouldn't be eaten).
- When the rule's `actor.type` is `EVENT_INITIATOR`, the worklog lands on **the user who triggered the event** (ticket creator for `issue.created`, transitioner for `issue.transitioned`). If that user lacks "Work On Issues" permission, the action silently fails; no other actions on the same rule are affected.

### 7. CM "UAT" is not a thing

CM workflow has no UAT status. Anything triggered on `toStatus = 10012` (UAT)
will never fire for CM tickets. We left the CM UAT rule `DISABLED` rather than
deleted, as an audit breadcrumb.

---

## IF/ELSE block — the pattern that actually works

When you need "if field X is set, do A; else do B", use a real Jira Automation
conditional container. All existing working examples in this instance use this
same shape (see `find-ifelse-patterns.mjs` to list them).

```json
{
  "component": "CONDITION",
  "schemaVersion": 1,
  "type": "jira.condition.container.block",
  "value": {},
  "conditions": [],
  "children": [
    {
      "component": "CONDITION_BLOCK",
      "schemaVersion": 1,
      "type": "jira.condition.if.block",
      "value": { "conditionMatchType": "ALL" },
      "conditions": [
        {
          "component": "CONDITION",
          "schemaVersion": 1,
          "type": "jira.jql.condition",
          "value": "cf[10194] is not EMPTY"
        }
      ],
      "children": [
        /* ACTIONS to run on TRUE go here */
      ]
    },
    {
      "component": "CONDITION_BLOCK",
      "schemaVersion": 1,
      "type": "jira.condition.if.block",
      "value": { "conditionMatchType": "ALL" },
      "conditions": [
        {
          "component": "CONDITION",
          "schemaVersion": 1,
          "type": "jira.jql.condition",
          "value": "cf[10194] is EMPTY"
        }
      ],
      "children": [
        /* ACTIONS to run on FALSE go here */
      ]
    }
  ]
}
```

Notes:
- Each `CONDITION_BLOCK` is its own IF branch; Jira evaluates them independently.
  Use **mutually exclusive** JQL conditions so only one branch runs.
- Conditions can also be `jira.comparator.condition` (smart-value comparison)
  rather than `jira.jql.condition` — see "Ensure Due Date is at Least 24 Hours
  After Creation" for a working example.

---

## The rules we manage

Snapshot of what's in scope as of this doc (see `CHANGELOG.md` for history):

| UUID | Scope | State | Purpose |
|---|---|---|---|
| `019d3183-076e-7e15-9fc7-d8bae4831e18` | NOVA | ENABLED | Move template-cloned tickets to the sprint on Backlog → To Do; **IF** `component in ("NCOA/ACS")` **THEN** assign Jeremy Romero + Tech Owner + internal comment; **ELSE** assign Roy + Tech Owner=Roy. |
| `019d356a-ebd3-7b6e-b1f6-6a76d4449a53` | NOVA | ENABLED | Case Update Requests & Bugs auto-add to sprint, assign Roy + Tech Owner=Roy. |
| `019bb332-09dc-7358-a710-4fedff499888` | OPRD | ENABLED | OPRD intake auto-assign Roy + Tech Owner=Roy on issue created. |
| `019e94b3-c149-779e-a2c0-455e1ebed316` | NOVA | ENABLED | **Assignee changed → Tech Owner** (empty only): Kyle→Kyle; Roy/James/Brandon→Roy. |
| `019e94b3-c56d-77c6-937d-0736806c1dd8` | OPRD | ENABLED | Same assignee→Tech Owner rule as NOVA. |
| `019e94b3-c923-7b33-a57f-4b6495918586` | CM | ENABLED | Same assignee→Tech Owner rule as NOVA. |
| `019d98b7-e981-7c94-8a29-d161d13e0a37` | NOVA | ENABLED | Transition → QA (10003): assign **Kyle**, post QA handoff comment with `[~accountid:…]` mention. |
| `019d556a-689f-72b8-9ebb-c1ccc83deea2` | NOVA | ENABLED | Transition → UAT (10012): **Actor = user who triggered**; IF/ELSE assign — Case Manager (`cf[10194]`) or Brandon fallback; then IF initiator is **Kyle** → handoff comment begins with **L3 PASSED** (full prefix in Jira is `L3 PASSED | `) plus **5m** `jira.worklog.add`, ELSE handoff comment only (unchanged wording). |
| `019d556a-72df-7233-b88e-f2be5d296e5e` | OPRD | ENABLED | Transition → UAT (10012): same IF/ELSE as NOVA, OPRD comment text preserved. |
| `019d556a-6dae-7e90-be20-d0982cc3d50b` | CM | **DISABLED** | Dead code — CM workflow has no UAT status. Kept disabled instead of deleted. |
| `0193d5ab-6e19-75d2-90d8-55fca6824592` | CM | ENABLED | Data Team Testing → Data Team Complete: auto-transition to Request Complete + IF/ELSE assign. NCOA-only watcher + comment retained. |
| `019daca7-a0c6-7e42-979c-385b551d8261` | NOVA | ENABLED | **Auto-log on Create** — on `jira.issue.event.trigger:created`, **Actor = EVENT_INITIATOR**, three mutually-exclusive JQL branches: `type = Epic` → `jira.worklog.add 15m`, `type IN (Bug, "Bug Sub-Task")` → `10m`, `type NOT IN (Epic, Bug, "Bug Sub-Task")` → `5m`. Worklog description: `"Auto-logged on create"`. No whitelist guard — if creator lacks Work-Log permission (service account) the action silently fails. |
| `019daca8-3dca-7bc2-b89e-abad27ed6c6c` | OPRD | ENABLED | **Auto-log on Create** — same structure as NOVA rule, scoped to OPRD (projectId 10002). |
| `019daca8-43ff-7710-8c32-70b7788e3fc7` | CM   | ENABLED | **Auto-log on Create** — same structure as NOVA rule, scoped to CM (projectId 10017). Legacy project; rule mostly benign since CM issue types rarely match the Epic/Bug branches and fall through to the 5m catchall. |

---

## Custom fields and team account IDs

Documented centrally in `_jiraAuto.mjs`:

| Constant | Value | Notes |
|---|---|---|
| `ROY_ID` | `712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f` | `royr`, NOVA team. |
| `KYLE_ID` | `712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837` | Kyle Dilbeck, NOVA QA intake + UAT initiator branch. |
| `BRANDON_ID` | `712020:384111d1-8f9d-4155-8420-37ff1888d6c3` | Brandon Fay, UAT assignee fallback. |
| `CF_TECH_OWNER` | `customfield_10193` | Tech Owner (userpicker). |
| `CF_CASE_MANAGER` | `customfield_10194` | Case Manager (userpicker, required on most NOVA issue types). |

Use the full field-discovery query at `GET /rest/api/3/field` if you need to
verify a field ID — see `kyleJira/diagnostics/find-case-manager-field.mjs` for a
worked example.

---

## Project IDs / status IDs

Global (cross-project) in Jira Cloud. Snapshot as of 2026-04-16:

| Project | projectId | Workflow statuses we care about |
|---|---|---|
| NOVA | 10183 | To Do, In Dev, Dev Review, **QA (10003)**, **UAT (10012)**, Done, Backlog |
| OPRD | 10002 | To Do, Requirement Review, Development, Peer Testing, QA/QC (10011), **UAT (10012)**, Resolved |
| CM   | 10017 | New, Requested, Data Team New, Data Team In Progress, Data Team Testing, Data Team Complete, Request Complete, Completed (no UAT) |

Re-verify any time with `verify-workflow-statuses.mjs`.

---

## Curl quickstart (no scripts)

If you just want to poke the API from a terminal:

```bash
# List rules
curl -s -u "$JAMES_EMAIL:$JAMES_JIRA_TOKEN" \
  "https://api.atlassian.com/automation/public/jira/$CLOUD_ID/rest/v1/rule/summary?limit=100"

# Get one rule's full payload
curl -s -u "$JAMES_EMAIL:$JAMES_JIRA_TOKEN" \
  "https://api.atlassian.com/automation/public/jira/$CLOUD_ID/rest/v1/rule/<uuid>"

# Disable a rule
curl -s -u "$JAMES_EMAIL:$JAMES_JIRA_TOKEN" \
  -X PUT -H "Content-Type: application/json" \
  -d '{"value":"DISABLED"}' \
  "https://api.atlassian.com/automation/public/jira/$CLOUD_ID/rest/v1/rule/<uuid>/state"
```

`CLOUD_ID` for CPT = `aa81968a-8fe6-4aeb-8986-3992717fdee3`.

---

## Where the one-off scripts went

Historical migration / diagnostic scripts live in `kyleJira/` (gitignored) so
they don't clutter the repo but remain available locally for reference or rerun:

- `kyleJira/one-off-migrations/` — every `update-*.mjs` / `create-*.mjs` /
  `refactor-*.mjs` / `fix-*.mjs` we applied this session. Kept as recipe
  examples of how to touch each rule type.
- `kyleJira/diagnostics/` — `diagnose-*.mjs`, `inspect-*.mjs`, ticket-specific
  fixers (e.g. `fix-nova-1612-assignee.mjs`), and the field/rule shape probes.

When writing a new one-off, drop it in `kyleJira/` and only promote to
`scripts/jira/` if it becomes reusable.
