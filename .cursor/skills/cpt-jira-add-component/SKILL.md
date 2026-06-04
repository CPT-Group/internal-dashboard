---
name: cpt-jira-add-component
description: Finds Jira tickets in NOVA, CM, and OPRD missing Components, suggests a component via fuzzy summary matching (ATLAS/ZION → ATLAS on NOVA; static/interactive website, downloader, etc.), asks the user when uncertain, and applies only to tickets with no existing components. Use when the user invokes /cpt-jira-add-component, asks to backfill missing components, or fix component-less tickets for the dev board.
---

# CPT Jira — Add Component

Backfill the Jira **Components** field on tickets that have **no component set**. **Do not edit tickets that already have one or more components.**

## Matching rules

1. **ZION / ATLAS / internal-tools work (NOVA)** → **`ATLAS`** component when summary/labels mention zion, atlas, data manager, duplicate check, enrichment, internal-tools, etc.
2. **All other tickets** → best **fuzzy match** against the project’s component catalog (e.g. “website update for static site” → **Static Website**; “downloader” → **Downloader**; “weekly report” → **Weekly Reports**).
3. **Unclear matches** → **ask the user** before applying (medium/low confidence). Do not guess on ambiguous tickets.

## When to ask the user

| Confidence | Agent action |
|------------|--------------|
| **high** | Safe to apply after dry-run review (or user says “apply high”) |
| **medium** | Present list; ask which component or confirm batch |
| **low** / **none** | Ask per ticket or skip |

Use `AskQuestion` or a short numbered list: `KEY — summary → suggested Component?`

## Workflow

1. Auth: repo-root `.env.local` (`KYLE_EMAIL` + `KYLE_JIRA_TOKEN`). Never print tokens.
2. **Discover** (always first):

```bash
node scripts/jira/discover-missing-components.mjs
node scripts/jira/discover-missing-components.mjs --project NOVA
```

3. Summarize buckets: high / medium / low / none counts.
4. **Dry-run** proposed writes:

```bash
node scripts/jira/backfill-missing-components.mjs --min-confidence high
```

5. After user confirms (or for explicit keys):

```bash
node scripts/jira/backfill-missing-components.mjs --apply --min-confidence high
node scripts/jira/backfill-missing-components.mjs --apply --keys NOVA-123,CM-456 --component "Static Website"
```

6. Re-run discover to confirm `component is EMPTY` count dropped.

## JQL scope (default)

```jql
project IN (NOVA, CM, OPRD) AND component is EMPTY AND statusCategory != Done ORDER BY updated DESC
```

Flags: `--project NOVA`, `--include-done`, `--keys`, `--component "Name"`, `--min-confidence high|medium|low`.

## Safety

- Skip any issue where `components[]` is already non-empty.
- Use project-specific component **IDs** from `scripts/jira/componentMatchRules.mjs` (`COMPONENT_IDS_BY_PROJECT`).
- Dry-run before `--apply` unless user approved the exact list in the same session.
- ~300ms between writes in apply mode.

## Keyword reference

Edit `scripts/jira/componentMatchRules.mjs` to tune fuzzy rules. NOVA dev-board components include **ATLAS**, Case Database, Static/Interactive Website, Downloader, Weekly Reports, NCOA/ACS, etc. CM/OPRD have additional names (Case Setup, Update Clean Claims, …).

## Output to user

- Counts per confidence bucket
- Sample rows: `KEY | project | status | → Component | summary`
- List of **needs review** tickets with no suggestion
- After apply: updated / failed / skipped

## Related

| Script | Purpose |
|--------|---------|
| `discover-missing-components.mjs` | Audit + fuzzy suggestions |
| `backfill-missing-components.mjs` | Dry-run / apply |
| `componentMatchRules.mjs` | Keywords + component IDs |
| `/cpt-jira-add-tech-owner` | Tech Owner backfill (separate field) |

See `AGENTS.md` (standard components vs NOVA Components field) and `scripts/jira/README.md`.
