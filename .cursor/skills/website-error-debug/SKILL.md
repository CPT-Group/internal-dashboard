---
name: website-error-debug
description: Runs a one-site Website Health error rundown and remediation triage from a site key/case/database input. Use when the user asks for /website-error-debug, requests a per-site issue breakdown, or wants guided fix steps for missing confirmations, IsSubmitted mismatches, or compare missing rows.
---

# Website Error Debug

Use this skill for per-site Website Health investigations and controlled remediation guidance.

Primary trigger example:

- `/website-error-debug CompassionHealthCare_Allin_C`

## Scope and default behavior

- Default output is **chat only** (no Teams webhook posting).
- If the user includes a Jira ticket (key or URL), also post a concise ticket update with findings (and attachments when useful).

## Inputs

Accept any one of:

- Website DB name (for example `CompassionHealthCare_Allin_C`)
- Site/case name (`OCPAutomation.CaseName`)
- CleanClaims DB name

If the input is ambiguous, resolve via active-site mapping and ask a quick confirm question.

## Investigation workflow

1. Resolve mapping from active sites:
   - case name
   - website DB
   - clean-claims DB
   - deadline date
2. Pull site details from:
   - `GET /api/website-health/site?siteKey=<...>&sinceDays=all`
3. Build issue rundown with:
   - compare metrics (`submitted`, `matched`, `missing`)
   - Web DB metrics (`webDbIssueCount`, `webDbMissingConfirmationCount`, `webDbNotSubmittedCount`)
   - grouped issue tables by reason:
     - `Missing confirmation number`
     - `IsSubmitted not 1`
     - any other reasons present
4. Identify pattern shape:
   - clustered historical window vs random spread
   - contiguous ID block vs scattered IDs
5. Recommend next action (inspection-only or controlled fix) with explicit risk notes.

## Jira update behavior (when ticket is provided)

Post concise formatted updates:

- Pre-check metrics and issue counts
- Root-cause pattern summary
- Exact action taken (or explicitly "inspection only")
- Post-check metrics if a fix was applied
- Attachment references (CSV/MD) when generated

## Controlled remediation rules

Never perform broad/manual data edits without classification. Use this order:

1. **Pre-check snapshot**
   - save before metrics and affected IDs
2. **Identity validation**
   - for each affected ID, compare source/target identity fields when available:
     - email, first/last name, city, state, zip
   - classify rows before any write
3. **Approval gate**
   - get explicit user approval for write operations
4. **Minimal write policy**
   - confirmation backfill/sync:
     - if source missing and user approves generation, generate template-consistent GUID confirmation
     - update `Submissions.ConfirmationNo`
     - update `CleanClaims.ConfirmationNo` for `MailingListID = SubmissionID`
     - document duplicate-row policy (for duplicate MailingListID rows) before applying
   - submitted-flag correction:
     - update `Submissions.IsSubmitted = 1` only for approved IDs
5. **Post-check validation**
   - rerun site details and compare before/after
6. **Audit artifacts**
   - create CSV/MD output in `kyleOutput/` with ID-level mapping, old/new values, and row counts
   - include references in Jira comment

## Safety constraints

- No blind inserts into `CleanClaims`.
- No destructive deletes.
- No bulk updates outside explicit approved ID list.
- If identity checks fail, skip and report those rows separately.

## Output format (chat)

Use a concise structure:

1. Mapping and current metrics
2. Issue tables by reason
3. Pattern analysis (historical vs random)
4. Proposed next step
5. If writes happened: exact per-ID update summary + post-check result
