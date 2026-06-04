---
name: cpt-jira-stale-ticket-warning
description: Finds NOVA board tickets in UAT with due date before today and posts a Jira warning-panel comment with stale UAT text plus assignee mention. Use when the user invokes /cpt-jira-stale-ticket-warning, asks for stale UAT warnings, overdue UAT due dates on board 516, or UAT tickets past due that need assignee ping.
---

# CPT Jira — Stale UAT Ticket Warning

Post a **warning panel** comment on NOVA tickets stuck in **UAT** whose **due date is before today** (Pacific `startOfDay()`). Due **today** is not stale; due **yesterday or earlier** is.

Board context: [NOVA board 516](https://cptgroup.atlassian.net/jira/software/c/projects/NOVA/boards/516). JQL is project-wide UAT (not limited to `openSprints()` — overdue UAT tickets often leave the active sprint while still in UAT).

## Stale rule

| Condition | Stale? |
|-----------|--------|
| Status = UAT, due date **before today** | Yes — post warning |
| Status = UAT, due date **today** | No (e.g. NOVA-2620 while due today) |
| Status = UAT, no due date | No (excluded by JQL) |
| Already has comment with `STALE TICKET WARNING` | Skip (no duplicate) |

## Warning comment (verbatim)

Must use Jira **warning panel** ADF (`panelType: warning`). Body text:

```
STALE TICKET WARNING: Assignee must complete final UAT and resolve this ticket or create a bug ticket. Failure to perform UAT constitutes acceptance of the work delivered. All undiscovered issues become the assignee's responsibility.
```

Append an **@assignee** mention (ADF `mention` node) when assignee is set.

## Workflow

1. Auth: repo-root `.env.local` (`KYLE_EMAIL` + `KYLE_JIRA_TOKEN`, or `JAMES_*`). Never print tokens.
2. **Dry-run first**:

```bash
node scripts/jira/stale-uat-ticket-warning.mjs
```

3. Review list: `KEY | due date | assignee`.
4. Apply:

```bash
node scripts/jira/stale-uat-ticket-warning.mjs --apply
```

5. Single ticket:

```bash
node scripts/jira/stale-uat-ticket-warning.mjs --keys=NOVA-123 --apply
```

## JQL

```jql
project = NOVA AND status = UAT AND duedate is not EMPTY AND duedate < startOfDay() ORDER BY duedate ASC
```

## Safety

- Never post twice on the same issue (marker scan on existing comments).
- ~300ms between comment writes in `--apply` mode.
- Public comment (visible to assignee / requesters on the ticket).

## Output to user

- Count: would post / posted / skipped / failed
- Table: `KEY | due | assignee | action`
- Note which tickets were skipped because due date is today or warning already exists

## Related

| File | Purpose |
|------|---------|
| `stale-uat-ticket-warning.mjs` | Discover + dry-run / apply |
| `staleUatWarningAdf.mjs` | Warning panel ADF builder |
| `/cpt-jira-add-tech-owner` | Separate hygiene skill |

See `scripts/jira/README.md` and `AGENTS.md` (NOVA UAT status).
