---
name: cpt-jira-add-tech-owner
description: Finds Jira tickets assigned to Kyle, Roy, James, or Brandon with empty Tech Owner and sets customfield_10193 using assignee-based rules. Never overwrites an existing Tech Owner. Use when the user invokes /cpt-jira-add-tech-owner, asks to backfill Tech Owner, or fix missing tech owner on NOVA/CM/OPRD tickets for the core team.
---

# CPT Jira — Add Tech Owner

Backfill **Tech Owner** (`customfield_10193`) for tickets assigned to Kyle, Roy, James, or Brandon when Tech Owner is **empty or unassigned**. **Do not edit tickets that already have a Tech Owner.**

## Assignee → Tech Owner rules

1. if roy or brandon are assignee add roy as tech owner
2. if i am assignee add me as tech owner
3. if james is assignee add roy as tech owner

## Account IDs (CPT NOVA team)

| Person  | Jira accountId |
|---------|----------------|
| Roy     | `712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f` |
| Kyle    | `712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837` |
| James   | `712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef` |
| Brandon | `712020:384111d1-8f9d-4155-8420-37ff1888d6c3` |

## Workflow

1. Load auth from repo-root `.env.local` (`KYLE_EMAIL` + `KYLE_JIRA_TOKEN`, or `JAMES_*` fallback). Never print tokens.
2. **Dry-run first** — always show the candidate list before writing:

```bash
node scripts/jira/backfill-tech-owner-by-assignee.mjs
```

3. If the list looks correct, apply:

```bash
node scripts/jira/backfill-tech-owner-by-assignee.mjs --apply
```

4. Optional verification (NOVA sprint scope):

```bash
node scripts/jira/discover-missing-tech-owner.mjs
```

## Automation (prevents re-accumulation)

Going forward, Jira Automation sets Tech Owner on intake and assignee change (empty only):

| Rule | Scope | Behavior |
|------|-------|----------|
| Move Issues to Active Sprint on Transition | NOVA | Backlog→To Do: Roy + Tech Owner (Jeremy for NCOA/ACS) |
| Case Update Requests & Bugs Auto Add to Sprint | NOVA | Create: Roy + Tech Owner |
| OPRD Auto Assigns to Roy | OPRD | Create: Roy + Tech Owner |
| **[Data team] Assignee changed → set Tech Owner** | NOVA/OPRD/CM | Assignee change + empty TO: Kyle→Kyle; Roy/James/Brandon→Roy |

Create/update via `scripts/jira/create-tech-owner-on-assignee-rule.mjs --apply` and `enable-case-update-bugs-rule.mjs --apply` (James token).

## JQL scope

The script searches:

```jql
assignee IN (Roy, Kyle, James, Brandon account IDs) AND cf[10193] is EMPTY ORDER BY updated DESC
```

All projects; no status filter. Rows with **any** Tech Owner set are skipped (never updated).

## Safety

- **Never** PUT `customfield_10193` when the issue already has a value.
- Dry-run before `--apply` unless the user explicitly says to apply immediately after reviewing a dry-run in the same session.
- Rate-limit: ~300ms between writes in `--apply` mode.
- On PUT failure, report the key and continue; exit non-zero if any failed.

## Output to user

Summarize:

- Count dry-run / updated / skipped (already had Tech Owner) / failed
- Table or list: `KEY | project | assignee → Tech Owner`
- Reminder that Dev Corner dashboards use Tech Owner + assignee together; unassigned tickets still need an assignee to appear in some TV filters

## Related scripts

| Script | Purpose |
|--------|---------|
| `scripts/jira/backfill-tech-owner-by-assignee.mjs` | **This skill** — assignee rules above |
| `scripts/jira/backfill-missing-tech-owner.mjs` | NOVA sprint open: copy NOVA assignee, else Roy |
| `scripts/jira/discover-missing-tech-owner.mjs` | Audit empty Tech Owner on NOVA sprint |
| `scripts/jira/discover-dev-board-attribution.mjs` | Compare assignee vs Tech Owner counts per dev |

See also `scripts/jira/README.md` and `AGENTS.md` (Tech Owner vs Assignee).
