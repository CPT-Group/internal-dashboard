---
name: cpt-sr-dev-time-sync
description: Syncs today’s Pacific Jira worklogs for Kyle and James across their NOVA In Dev assignee tickets (even split). Supports absolute hours, k/j shorthand, and relative +/− deltas from current today totals. Hard cap 21h per person per day. Use when the user invokes /cpt-sr-dev-time-sync, asks to sync SR dev time, or gives hour values like 4, k:6 j:7.2, or k:+1 j:-0.5.
---

# CPT SR Dev Time Sync

Set **today’s worklogs (Pacific)** for **Kyle Dilbeck** and/or **James Cassidy** on their **NOVA `In Dev`** assignee tickets only. Time is split **evenly** across those tickets (one worklog per ticket).

## Parse user input → script flags

| User says | Meaning | Script args |
|-----------|---------|-------------|
| `4` or `5` ( lone number ) | Both Kyle **and** James get that many hours | `--hours=4` or `4` |
| `kyle:4 james:2` | Per-dev absolute totals | `--kyle-hours=4 --james-hours=2` |
| `k:6 j:7.2` | Shorthand absolute (k = Kyle, j = James) | `k:6 j:7.2` |
| `k:+1 j:+2` | Add hours to **current today total** per dev | `k:+1 j:+2` |
| `k:-0.5 j:-1` | Subtract from current today total | `k:-0.5 j:-1` |
| `james:3` only | **Only** James — leave Kyle unchanged | `--james-hours=3` |
| `k:2` only | **Only** Kyle | `--kyle-hours=2` |

**Rule:** If a dev is not mentioned (and no shared `--hours`), **do not sync that dev**.

**Relative (+/−):** Delta is applied to that dev’s **total hours logged today** (any ticket), then result is re-split across In Dev tickets. Example: Kyle at 6h today + `k:+1` → 7h on In Dev tickets.

**Hard cap:** **21 hours max per person per day** (Pacific). Values above 21 are clamped; report the clamp in output. Floor is **0h**.

Aliases: `k` / `kyle` / `me` → Kyle · `j` / `james` → James

## Workflow

1. Parse hours from the user message (table above).
2. **Apply immediately** with `--apply` — **do not dry-run**, do not ask for confirmation:

```bash
node scripts/jira/set-in-progress-worklogs-today.mjs k:6 j:7.2 --apply
node scripts/jira/set-in-progress-worklogs-today.mjs k:+1 j:+2 --apply
node scripts/jira/set-in-progress-worklogs-today.mjs --hours=4 --apply
```

3. Summarize the apply output: Pacific date, each dev’s In Dev tickets, per-ticket minutes, current → target, deletions/creates, cap notice if any.
4. **Verify** totals (use each dev’s resolved target):

```bash
node scripts/jira/adjust-worklogs-today.mjs --target-hours=6
node scripts/jira/adjust-worklogs-today.mjs --target-hours=7.2
```

## What the script does

1. Finds `project = NOVA AND assignee = <dev> AND status = "In Dev"`.
2. Resolves target hours (absolute, or current today + delta; clamp 0–21).
3. **Deletes all of that dev’s worklogs logged today** (any ticket).
4. Creates one new worklog per In Dev ticket (even split of target hours).
5. Uses **each dev’s own Jira token** for creates (`KYLE_*` / `JAMES_*` in `.env.local`).

## Auth

- **Read/search/delete:** `KYLE_EMAIL` + `KYLE_JIRA_TOKEN` (or James fallback).
- **Create worklogs:** Kyle’s token for Kyle; James’s token for James.
- Never print tokens.

## Safety

- **Always `--apply` on invoke** — never dry-run first; never wait for user confirmation.
- **Never exceed 21h per person** — script clamps and logs when capped.
- If a dev has **zero** In Dev tickets, report and skip writes for that dev.
- On delete/create failure, log the key and continue; report failures in the summary.

## Output to user

Summarize:

- Pacific date
- Per dev: current → target (note `+/-` delta and 21h cap if applied)
- Ticket count, minutes per ticket, entries deleted/created
- Final totals (verify via `adjust-worklogs-today.mjs`)
- Link pattern: `https://cptgroup.atlassian.net/browse/NOVA-XXXX`

## Related

| Script | Purpose |
|--------|---------|
| `scripts/jira/set-in-progress-worklogs-today.mjs` | **This skill** — In Dev even split (add **`--include-dev-review`** for Dev Review too) |
| `scripts/jira/adjust-worklogs-today.mjs` | Scale existing today entries proportionally (different use case) |

See `AGENTS.md` (Work Hours Today panel, NOVA `In Dev` status).
