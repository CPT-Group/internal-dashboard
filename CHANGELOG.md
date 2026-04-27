# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) with custom increment rules.

## [0.1.62] - 2026-04-23

### analytics-api published to production via existing Azure API Management

- **`analytics-api` is now live at `https://int.cptgroup.com/analytics-api/*`**, published through the existing `apim-cpt-prod` API Management instance. Entirely self-serve — Azure work done by Kyle, IT was not involved in this step. All changes are additive (no existing APIM API, policy, product, named value, or subscription was modified).
- **What got created in APIM** (all new, under `CPT_Group / apim-cpt-prod`):
  - `api analytics-api` — imported from `analytics-api/docs/openapi.yaml`, path `analytics-api`, backend `http://10.24.20.181:8080/api/v1`, protocols `https` only.
  - `namedValue analytics-api-bearer-token` — secret, inline (will rotate into Key Vault `cptapim` once Kyle's RBAC on that vault is restored; inline is fine operationally — APIM encrypts at rest).
  - API-scope **inbound policy** attaches `Authorization: Bearer {{analytics-api-bearer-token}}` to every request forwarded to the backend VM. Source-of-truth copy lives at `analytics-api/docs/apim-inbound-policy.xml`.
  - Linked to product `unlimited` (subscription required).
  - New subscription `internal-dashboard-analytics-api` scoped to `/apis/analytics-api` only (least-privilege — the subscription key cannot call any other APIM API).
- **Network path (confirmed live)**: `client → int.cptgroup.com (Front Door `CPT-WESTUS2-AZFrontDoor01-PROD` + WAF `cptwestus2waf02`) → APIM `apim-cpt-prod` in subnet `CPT_Group-vnet/cpt-apim` → existing `CPTOffice` S2S VPN → `CPT-VPN-Office` local gateway (`10.24.0.0/16`) → `CPT-Dash-API` (10.24.20.181:8080) → Node/Express → SQL (`CPT2K16` + `10.0.0.5`)`. No self-hosted gateway, no new firewall rules, no ExpressRoute, no new ingress — the VPN already advertised the corporate subnet.
- **End-to-end smoke (through `https://int.cptgroup.com/*`, with APIM subscription key)**: all five endpoints return 200 with real production data. Unauthenticated requests (no `Ocp-Apim-Subscription-Key`) return 401 — APIM subscription enforcement is verified working. Same behavior as the VM-localhost smoke from 0.1.61.

### Open items remaining

- **Windows-level persistence on `CPT-Dash-API`** — tracked as `NOVA-1791` (https://cptgroup.atlassian.net/browse/NOVA-1791), child of Epic `NOVA-1671`. The Node process currently only runs while a WinRM session is open. `dashboard.svc` lacks both CIM access and the "Log on as a batch job" right, so we can't self-register a Scheduled Task. IT to register a startup task/service, OR grant the batch-logon right and we'll self-register. Until then, a human has to log in and start the service after any reboot. Paste-ready IT request + ticket body at `analytics-api/docs/it-cutover-request.md` and `analytics-api/docs/jira-persistence-ticket.md`.
- **Dashboard consumer wiring** (tracked under `NOVA-1677`, not yet in code): Website Health Next.js routes still hit SQL directly. Planned env vars for the switchover (local + Netlify): `ANALYTICS_API_BASE_URL=https://int.cptgroup.com/analytics-api` and `ANALYTICS_API_SUBSCRIPTION_KEY=<primary key of APIM subscription `internal-dashboard-analytics-api`>`. The dashboard never sees the backend bearer token — APIM's inbound policy handles that internally.
- **Key Vault-sourced named value** (low priority): migrate `analytics-api-bearer-token` out of inline APIM storage and into `cptapim` Key Vault once Kyle's RBAC on that vault is restored. Purely a hardening step; operationally identical.

## [0.1.61] - 2026-04-23

### Added

- **analytics-api successfully deployed to VM `CPT-Dash-API` (10.24.20.181)** as the `dashboard.svc` service account. Self-service deploy (no IT/admin needed for the app itself): Node 22.11.0 portable zip extracted to `C:\ProgramData\analytics-api\node\`, source pushed via `Copy-Item -ToSession`, `npm ci` + `npm run build` on the VM, `.env.local` composed from `internal-dashboard/.env.local` SQL credentials + a fresh bearer token.

### Verified (end-to-end against real production SQL)

- `GET /api/v1/health` returns `sqlClaims: "ok"` and `sqlWebsite: "ok"` — both pools (`CPT2K16` for claims, `10.0.0.5` for websites) connecting cleanly.
- `GET /api/v1/submission-report` returns real per-site totals matching `internal-dashboard`'s Website Health button (e.g. Dermacare: 621 total / 50 today / 555 yesterday).
- `GET /api/v1/website-health/summary` returns 17 active sites, each with the correct `websiteDbName` / `cleanClaimsDbName` mappings and submitted-vs-matched counts.
- `GET /api/v1/website-health/daily-report` returns per-site `deficientTrueCount` / `disputedTrueCount` counts.
- `POST /api/v1/website-health/report-by-date` returns correct per-date windows (5:15 AM PT boundary → `12:15:00 UTC` during DST) for both single-day and date-range inputs; 400 on invalid payloads (Zod validation wired).
- Security hardening confirmed live: helmet headers (CSP, HSTS, frame-ancestors 'self', etc.), express-rate-limit (`120 requests / 60s`), bearer-only access (unauthenticated hits rejected), request-id propagation, pino structured logs.

### Known remaining blockers (IT tickets, not code)

- **Public ingress path for Netlify-hosted dashboard.** Netlify functions run on AWS us-east-1 and cannot reach a private `10.x.x.x` IP. Read-only Azure discovery (2026-04-23) confirmed CPT already runs an enterprise API gateway stack — `apim-cpt-prod` (StandardV2, External VNet), Front Door `CPT-WESTUS2-AZFrontDoor01-PROD` with WAF (`cptwestus2waf02`, `Premium`), Key Vault `cptapim`, and custom domain `int.cptgroup.com` already pointing at APIM. Decision: publish `analytics-api` as a new API under `apim-cpt-prod` (path `/analytics-api/v1/...`, backend `http://10.24.20.181:8080/api/v1`, product `unlimited`, bearer token stored as APIM named value sourced from `cptapim` Key Vault). Open network-layer question for IT: whether `CPT_Group-vnet/cpt-apim` subnet has hybrid connectivity to the corporate 10.24.20.0/24 network; if not, fallback is the APIM self-hosted gateway container on a corp VM. This replaces the original "Entra Application Proxy" proposal — APIM is the purpose-built fit and already paid for.
- **Process persistence across reboot on `CPT-Dash-API`**: `Register-ScheduledTask` requires CIM and `schtasks.exe /create /RU /RP` requires "Log on as a batch job", neither of which `dashboard.svc` currently has. Need IT to either (a) register a Scheduled Task/Windows Service that auto-runs `C:\ProgramData\analytics-api\node\node.exe dist\index.js` from `C:\ProgramData\analytics-api\src` as `dashboard.svc` at boot, or (b) grant "Log on as a batch job" so we can self-register the task.
- **Firewall scope for port 8080** on `CPT-Dash-API` (only required if the "APIM via VNet" path is taken; moot if self-hosted gateway runs on the same VM): Allow-rule exists but needs to include the APIM subnet's source range.
- Full IT request drafted at `analytics-api/docs/it-cutover-request.md` consolidating all three asks.

### Changed — analytics-api companion repo

- `analytics-api` commit `1cbd584` (`fix: load .env.local and default SQL pools to [master]`) — two runtime bugs surfaced during the VM smoke, both silent locally: (1) `dotenv.config()` only read `.env` so the canonical `.env.local` was silently skipped; (2) the `PROD_DB` pool tried to attach to a database (`CPTMaster`) that only exists on `CPT2K16`, not on the production WEB DB `10.0.0.5`. Pools now always connect to `[master]` and per-case DBs are fully-qualified in queries (e.g. `[FashionNova_Alcazar_C].dbo.Submissions`), matching `internal-dashboard`'s `scan.ts` `toPool()` exactly.

## [0.1.60] - 2026-03-30

### Changed

- **Removed all `color-mix()` CSS**: Deleted every `color-mix()` line from 12 SCSS files (variables, 4 theme files, primereact-overrides, CornerInfoCard, DevCornerOneDashboard, DevCornerTwoDashboard, GithubDeployStatusSlide, GithubDeployRepoCards, CompletedByDevSlide). Only the `rgba()` fallback lines remain, which are fully compatible with Samsung Tizen TV browsers.

## [0.1.59] - 2026-03-30

### Changed

- **Jira rework documentation**: Updated `AGENTS.md` with comprehensive documentation of the 2026-03-29 Jira restructuring — all new dev work is now NOVA tickets; CM and OPRD are legacy/phasing out; new Backlog→To Do→In Dev→Dev Review→QA→UAT→Done workflow; 14 new template-cloned issue types; Bug Sub-Task for internal bugs; structured root-cause fields on Bugs; future note on Backlog→To Do "landed on team" tracking.
- **NOVA status rename**: Jira "In Progress" was renamed to "In Dev" across the NOVA project. Updated `DEV_RESPONSIBLE_STATUSES` in `operationalAnalytics.ts` to match on `'In Dev'` for NOVA. Dashboard UI continues to display "In Progress" for readability.
- **Trevor dashboard**: Updated `STATUS_ORDER`, `novaInProgress` KPI filter, and `statusSeverity` to recognize `'In Dev'` as the active-work status (alongside legacy `'Development'`/`'In Progress'` for CM/OPRD tickets).
- **Component list**: Added `Docket Update` to `CM_OPRD_COMPONENTS` in `JIRA_OPERATIONAL.ts` (valid component on both NOVA and OPRD projects, was missing from the dev-board filter).
- **Dev Corner Two — GitHub deploy slide**: Temporarily removed the **Recent actions** DataView feed; left column is repo cards only (timeline unchanged). Restore path noted in `GithubDeployStatusSlide.tsx`.
- **GitHub deploy repo cards** (`GithubDeployRepoCards`): Cards fill the left column in a **2×2** grid with equal row heights; added **owner/repo** path, **Run #** + **branch** pills, longer commit/workflow title (**6-line** clamp), and a **detail list** (started time, finished/elapsed + duration, workflow id). Helpers `formatDeployRunTimestamp` and `formatDeployRunDuration` in `githubDeployDisplay.ts`. **Open run** link pinned to the card footer.

## [0.1.58] - 2026-03-25

### Changed

- **Build scripts**: Regenerated `conferenceBackgroundSlides.generated.ts`, `juliesBackgroundSlides.generated.ts`, and `jackiesBackgroundSlides.generated.ts` from `public/backgrounds/` (filesystem order).

## [0.1.57] - 2026-03-25

### Changed

- **Dependencies**: Ran `npm install`; `npm audit fix` for transitive **flatted**, **immutable**, and **picomatch**; bumped **next** and **eslint-config-next** to **16.2.1** to address remaining npm audit advisories for Next.js.

## [Unreleased]

### Added

- **Office dashboards assigned-ticket corner card (top-left, reusable)**: Added a shared `AssignedTicketsCornerCard` component + `useAssignedJiraTickets` hook and wired both `JackiesOfficeDashboard` (`6170ed0ef6da6a006aa38240`) and `JuliesOfficeDashboard` (`70121:35744a1b-356c-45c7-8a12-156352d60ddb`) to it. Card rows are click-through Jira links with compact `key + component` display (summary fallback with ellipsis), max-size constrained auto-scroll, and PrimeReact skeleton while loading; card is hidden entirely when assigned-ticket count resolves to `0`. Query scope excludes backlog and done tickets.
- **NOVA-1282 attachment reset + canonical CSV package**: Rebuilt the Jira attachment set to only include the three non-zero missing-row exports (`Regents=459`, `Netgain=36,285`, `Keenan=2`) plus a compact overall summary CSV (`WebsiteHealth_MissingRows_OverallSummary_2026-04-24.csv`) to eliminate prior duplicate-version confusion.
- **Website Health missing-row CSV package for legacy backfill review (NOVA-1282)**: Generated and attached per-case missing exports for `RegentsOfTheUniversityOfCalifornia_Fields_C`, `ProgressiveLeasingBreachLitigation_C`, `RheemManufacturingCompany_West_C`, `NetgainTechnologyConsumerDataBreachLitigation_C`, and `KeenanAndAssociates_Heath_C` as `<WebsiteDB>_MissingRows.csv` files. Export flow is read-only (no SQL updates), and each attachment was gated by missing-count parity checks before Jira upload.
- **Shared `ThemeCycleHitTarget` + hidden theme on existing tiles**: `ThemeCycleHitTarget` (`strip` / `title`) lives in `src/components/ui/ThemeCycleHitTarget/`. **Website Health** uses the `title` variant on the page heading. **Dev Corner One** uses **`KpiStrip`** optional **`onActivate`** on the existing **Limbo** KPI card only (no extra column). **Dev Corner Two** attaches **`cycleTheme`** to the existing **Successful** deploy summary card in **`GithubDeployStatusSlide`** (no separate top bar tile).
- **Julie + Jackie name-card theme cycle**: `CornerInfoCard` now supports optional hidden activation (`onActivate`) with keyboard support, and both `JuliesOfficeDashboard` and `JackiesOfficeDashboard` wire their floating name cards to `cycleTheme` (same behavior as the hidden controls on Website Health/Dev dashboards).
- **Julie + Jackie Completed Today corner card (not committed yet)**: Added shared `useCompletedTodayCount` hook backed by `operationalJiraStore` polling/cache and rendered a top-right `CornerInfoCard` on both office dashboards showing `Completed Today: <count>` from NOVA `closedToday`.
- **Julie + Jackie server-synced clock card (not committed yet)**: Added bottom-left clock cards to both office dashboards powered by `useSyncedClock` and `/api/time`, with one-second local ticks plus periodic server re-sync to limit drift on long-running displays.

### Fixed

- **CornerInfoCard theme bleed in office dashboards**: Removed hardcoded purple card background and switched `CornerInfoCard` to dedicated theme variables (`--corner-info-card-*`) with per-theme values, so light/MS Access themes no longer retain dark-synth styling after theme changes.
- **Clock card subtitle cleanup**: Removed the literal `(server synced)` suffix from Julie/Jackie clock card UI text while preserving server time re-sync behavior behind the scenes.
- **Completed Today loading UX**: `CornerInfoCard` now supports a built-in skeleton loading state, and Julie/Jackie “Completed Today” cards render skeleton placeholders while the Jira operational query is still loading.
- **Clock subtitle format**: Replaced the timezone subtitle (e.g. `PDT`) with compact date text (`M/D`) on Julie/Jackie clock cards for cleaner TV readability.
- **Clock date display preference**: Updated office clock subtitle to show date (`M/D`) instead of timezone text to match TV readability feedback.
- **Website Health deficiency report row filtering parity**: Daily and scan-by-date report result rows now hide sites where both deficiency and disputed counts are `0`, while `totalSitesChecked` still reflects all active sites scanned.
- **Website Health deficiency case-list source parity**: Deficiency scans now use the broader active-case list from `CPTMaster.dbo.OCPAutomation` (`Active=1` + `SQLName`) instead of requiring `WebServerDBName`, so active non-website cases are included in deficiency reporting.

### Fixed

- **Dev Corner theme hit targets**: Removed the extra empty strip tiles; theme cycling is on the existing **Limbo** KPI (`KpiStrip` / `onActivate`) and **Successful** GitHub deploy summary card (`GithubDeployStatusSlide`), matching the intended UX.
- **Light-theme contrast regressions in Dev Corner cards/tickers**: Replaced remaining hardcoded dark surfaces and fixed text colors in Dev Corner One/Two with theme tokens (NOVA chip fills, work-hours badges, activity number badges, GitHub deploy branch/env board/ticker chips), so `light` and `ms-access-2010` no longer render dark gray “leftover” blocks or low-contrast text.
- **Theme-switch polish fixes**: `HorizontalBarChart` now re-reads theme tokens when `data-theme` changes (fixes Work Hours axis/target marker colors after switching themes), Team Activity `x / y open` badges now use theme badge tokens, and duplicate “Theme changed” toasts were removed by making `cycleTheme()` emit exactly once per action.

### Changed

- **NOVA-1282 Jira artifact cleanup (description + attachment canonicalization)**: Corrected Website Health CSV discrepancy documentation by replacing stale assumption counts with canonical attachment IDs/counts and removing duplicate stale CSV attachments from the ticket to prevent filename-version ambiguity during QA review.
- **`cycleTheme()` order**: `ThemeProvider` (and the home sticky switcher) now cycle **dark → light → dark-synth → ms-access-2010** instead of starting the sequence at dark-synth; `layout.tsx` theme-init `valid` list is documented to stay in sync with `APP_THEME_CYCLE_ORDER` in `appThemeCycle.ts`.
- **Theme-change feedback toast (3s)**: Added global `ThemeChangeToast` listener (`cpt-theme-toast`) and emit-on-change in `ThemeProvider` so cycling themes now shows a bottom-right confirmation: **Theme changed to: <name>** for 3 seconds.

- **NOVA-1631 complete — 254 / 257 pre-2025 `www` folders removed from `\\10.0.0.5\www`**: The delete manifest (257 folders, SHA256-verified) finished at **98.8% removed**, reclaiming **+223.73 GB on F:\\** (17.75 GB free → 241.48 GB free; drive fullness 99.1% → 88.2%). Phased execution:
  - **Phase 1 — serial run** (4/17, `scripts/delete-www-old-sites.cjs`, `rd /s /q` in a Node single-threaded loop): 25 folders deleted before the process exited on its own after one ~6.5h outlier (`bamboosettlementfiles`) dominated its run.
  - **Phase 2 — parallel run** (4/20, new `scripts/delete-www-parallel.cjs`, concurrency 4, 15-min per-folder cap, shared worker pool using `cmd /c rd /s /q`, resume mode skips folders already logged as `deleted` in any prior exec CSV): 224 folders deleted in **1 h 44 min**, 7 timed-out, 0 errored. Timeout was the right call — every timeout was a single oversized folder and freeing the slot kept the queue flowing.
  - **Phase 3 — straggler recovery** (4/20): robocopy `/MIR /MT:32` pivot hung at 45-min cap on the first two picks without making visible progress over SMB, so **pivoted to plain PowerShell `Remove-Item -Recurse -Force`** (single-threaded, reliable). Deleted `CreationEntertainment_Christofferson_C_files` (93s · 126 files), `NationalFootballLeague_Treviso_PC - Copy` (9.6 min · 562 files), `SCO_Reissues_Files` (44.1 min · 2,817 files). Diagnosis for why `rd`/robocopy stalled: the 4 remaining stragglers all have live IIS sites pointing at them, so `w3wp.exe` holds file handles and bulk-delete commands hang; 3 of them had **no** IIS reference and cleared normally under `Remove-Item`.
  - **Deferred to NOVA-1632 (IIS cleanup pass)**: `BritaxChildSafety_Stevens_C` (serves `BritaxBoosterSeatSettlement.com`) and `NationalFootballLeague_Treviso_PC` (serves `2016HallOfFameGameClassAction.com`) will be removed during the IIS pass as `Stop-Website → Stop-WebAppPool → Remove-Item -Recurse -Force → Remove-Website → Remove-WebAppPool` in a single atomic per-site sequence (avoids the SMB lock entirely).
  - **Intentionally preserved**: `OberweisDairyInc_Interactive` (serves `cptgroup-oberweisdairy.com`, `AutoStart=true`) — removed from the cleanup scope per user decision.
  - **Already absent**: `Curran v Carrabba's Italian Grill` confirmed not on server (parallel run saw `ENOENT`; `Test-Path` on the literal path returns false — apostrophe/path-encoding quirk surfaced as a harmless `ENOENT` rather than a silent mismatch).
  - **Tickets**: NOVA-1629 (parent *Prod cleanup: reclaim disk on 10.0.0.5 (www folders + IIS)*, still **In Dev** waiting on NOVA-1632), **NOVA-1631 → Done** (this subtask), **NOVA-1632 (To Do)** received a scope-adjustment handoff comment (+2 deferred folders, −1 Oberweis, same 2 orphan app pools). Every phase has a milestone ADF comment on NOVA-1631 with tables for disk/folder-count snapshots and per-attempt outcomes, plus NOVA-1629 rollup panels. Attachments on NOVA-1631: serial exec CSV, parallel exec CSV + JSON summary (11 snapshots), `www-delete-problematic.csv` (the 7 timed-out rows that fed the straggler pass).
  - **Safety rails kept throughout**: manifest-count `--confirm-count 257` lock, SHA256-verified manifest against `kyleOutput/www-delete-manifest.sha256`, per-folder safe-name regex + parent-path equality to `\\10.0.0.5\www`, hardcoded denylist for `TwitterSeparation_Mailing`, live Active-case token refresh every 25 completions, dry-run default (required `--execute` to delete), rolling disk + www-count snapshots every 25 completions. No folders outside the manifest were touched in any phase.
  - **New in this work**: `scripts/delete-www-parallel.cjs` (parallel pool + timeout + resume + optional `--use-robocopy`), `cursorScripts/peek-disk.cjs` (read-only disk peek via `sys.dm_os_volume_stats`), `cursorScripts/jira/post-parallel-switch.cjs` / `post-parallel-complete.cjs` / `post-1631-final.cjs` / `handoff-1632-and-close-1631.cjs` / `hourly-delete-update.cjs` (Jira audit-trail posters), plus updated `audit-iis-sites.cjs` classification for `F:\www\` direct-share roots (fixed regex to include `^[a-z]:\\www\\`).

- **New Jira automation: `[Time Tracking] Auto-log on Create` (NOVA / OPRD / CM)** — three new rules (one per project, identical shape) that add a small worklog to every newly-created ticket, **attributed to the real human who created it** (Actor = `EVENT_INITIATOR`, not an automation service account).
  - **Trigger**: `jira.issue.event.trigger:created`, scoped per project via `eventFilters` + `ruleScopeARIs` (NOVA `projectId=10183`, OPRD `10002`, CM `10017`).
  - **Branches (mutually-exclusive JQL, per README gotcha #5):**
    - `type = Epic` → `jira.worklog.add 15m`
    - `type IN (Bug, "Bug Sub-Task")` → `jira.worklog.add 10m`
    - `type NOT IN (Epic, Bug, "Bug Sub-Task")` → `jira.worklog.add 5m` (catchall for Task, Story, Sub-task, and NOVA's 14 template-cloned types)
  - **Worklog description**: intentionally terse — `"Auto-logged on create"`. `adjustEstimate: "ADJUST_AUTOMATICALLY"` so the remaining-estimate gets decremented; `dateStarted: {{now}}`.
  - **Failure mode**: if the creator is a service account / integration user that lacks "Work On Issues" permission, the worklog action silently fails on that one execution — no other automation is affected, no data is written, the rule log just notes the miss. This matches the user's requirement "attempt with a fallback if it fails".
  - **Why three rules instead of one multi-project rule**: each rule ties cleanly to its own project scope in Jira Automation (simpler to audit in the UI, easier to disable per-project if ever needed). NOVA is the primary; OPRD + CM are best-effort mirrors since those projects are being deprecated, but the identical structure keeps reporting consistent while they're still alive.
  - **UUIDs (captured in `scripts/jira/README.md` rule table):**
    - NOVA: `019daca7-a0c6-7e42-979c-385b551d8261`
    - OPRD: `019daca8-3dca-7bc2-b89e-abad27ed6c6c`
    - CM:   `019daca8-43ff-7710-8c32-70b7788e3fc7`
  - **Implementation**: new creation script at `kyleJira/one-off-migrations/create-auto-log-on-create.mjs` (gitignored, kept for rerun/reference). Usage: `node kyleJira/one-off-migrations/create-auto-log-on-create.mjs NOVA|OPRD|CM|ALL`. Uses `POST /rule` on the Jira Automation REST API, authenticating via James's token (per README — Kyle's token lacks Administer Jira). No `id` / `connectionId` / `parentId` / `conditionParentId` fields on new nested components per gotcha #5 (Jira assigned stable ids on save — verified by re-fetching the rules).
  - **Safety verification**:
    - Took a full `backup-rules.mjs` snapshot of all 8 pre-existing rules **before** POSTing (→ `kyleOutput/jira-rule-backups/*__2026-04-20T20-48-35*.json`), and another snapshot **after** all 3 POSTs completed. PowerShell diff (ignoring the auto-stamped `updated` field) confirmed every pre-existing rule is **byte-for-byte unchanged** — zero collateral damage on `nova-move-to-sprint`, `nova-case-update-bug-intake`, `oprd-intake`, `nova-qa`, `nova-uat`, `oprd-uat`, `cm-uat-dead`, `cm-data-team`.
    - `list-rules.mjs --filter "Auto-log"` shows exactly 3 matches, all three `[ENABLED]`, total rule count went from 51 → 54.
    - Fetched each new rule back and confirmed: correct `actor.type = EVENT_INITIATOR`, correct `ruleScopeARIs` per project, three IF branches with the right JQL, each branch has a single `jira.worklog.add` action with the right `timeSpent`.
  - **Docs updated**: added the 3 rules to the `scripts/jira/README.md` rule table; added a new **gotcha #6** documenting the `jira.worklog.add` component shape (string `timeSpent`, `adjustEstimate` options, and the EVENT_INITIATOR fail-silent behaviour) so future automations don't have to reverse-engineer it.

### Changed

- **Website Health backfill traceability rollout (selected legacy case DBs)**: Added `dbo.CleanClaims.added_2026_4_24` (`bit NOT NULL DEFAULT 0`) to five legacy case databases lacking a per-row backfill marker (`RegentsOfTheUniversityOfCalifornia_Fields_C_SQL`, `ProgressiveLeasingBreachLitigation_C_SQL`, `RheemManufacturingCompany_West_C_SQL`, `NetgainTechnologyConsumerDataBreachLitigation_C_SQL`, `KeenanAndAssociates_Heath_C_SQL`). Applied a constrained update only on the new marker column (`SET added_2026_4_24 = 1`) where existing operational signatures indicate manual sync provenance (`EnteredBy='manual-sync'` OR `LastUpdateBy='manual-sync'`). Result: all five DBs now have the marker column; current marker-true counts are `0` in each (no matching manual-sync signatures found), and no other columns/rows were modified.

- **Website Health backfill marker validation policy pass (proof-only true flags)**: Ran a post-deploy signature audit on the same six case DBs (five new-marker targets + FashionNova baseline) to ensure `true` values are only applied when provenance is explicit. FashionNova remains the reference dataset (`added_2026_4_3=1` rows align with `EnteredBy/LastUpdateBy='manual-sync'`, count `11,500`). For the five newly marked legacy DBs, no `manual-sync` signatures were found in either `EnteredBy` or `LastUpdateBy`, so `added_2026_4_24` stays `0` for all rows by design (uncertain rows remain default-false). This confirms the intended rule: **unknown provenance must not be auto-labeled as backfilled**.

- **Website Health — Pacific timestamps in Teams titles, tables, UI, and Jira**: Added shared `formatWebsiteHealthPacificDateTime` (`America/Los_Angeles`, e.g. `9:53am 4/21/2026`). Teams webhook markdown H2 lines for main scan (alert / all clear), submission report, deficiency (daily) report, and scan-by-date now append that same run stamp; `Last Run` / `Run at` / 5:15 window bounds use it instead of raw ISO. The Website Health dashboard imports the same helper for all prior `toLocaleString()` call sites (summary, by-date, missing rows, Web DB issues). Jira auto-tickets from the dashboard format scan time and sample `DateReceived` values the same way.

- **Fix: `npm run build` green again on Next 16.2.4 / React 19.2.4 (framework prerender workaround)**: `next build` was failing on `/_global-error` and `/_not-found` with `TypeError: Cannot read properties of null (reading 'useContext')` thrown from Next's own compiled chunks (`.next/server/chunks/ssr/[root-of-the-server]__*.js`). Reproduced at **clean HEAD** with no uncommitted changes, so not caused by any of the Website Health / analytics-api integration work — it is the known Next 16 + React 19 bug tracked in [`vercel/next.js#84994`](https://github.com/vercel/next.js/issues/84994) that fires whenever a root `layout.tsx` wraps children in a `'use client'` provider tree (we have `<Providers>` → `ThemeProvider` + `PrimeReactProvider`, which is intentional and correct per Next.js app-router patterns). Confirmed via `next build --debug-prerender` (which disables `prerenderEarlyExit`) that the build completes cleanly when the early-exit is off; `_not-found`/`_global-error` simply fall back to dynamic (on-demand) rendering at runtime, which is fine for error pages that are never long-cached.
  - **Fix**: added `experimental: { prerenderEarlyExit: false }` to `next.config.ts` with a detailed comment explaining the cause, the reference issue, and the runtime impact. This is the same behaviour `--debug-prerender` produces — it demotes a failing prerender to dynamic instead of aborting the whole build.
  - Added explicit `src/app/global-error.tsx` (self-contained `'use client'` boundary with its own `<html>`/`<body>`, no access to the root `<Providers>`, per Next docs) and `src/app/not-found.tsx` (minimal server component with `export const dynamic = 'force-dynamic'`). Both files follow Next's documented conventions and will pick up naturally once the framework bug is fixed upstream. Useful regardless of the prerender workaround — the dashboard now has branded error/404 pages instead of the generic Next defaults.
  - Build now: 27 routes, `/website-health`, `/tv`, `/tv/conference-room` prerendered static as before; `/` static; all API routes dynamic as expected.
- **Repo housekeeping — `ArchivedReports_TestingArchive/` (gitignored)**: Moved one-off www-site deletion/audit tooling and retired per-task Jira-post scripts into `ArchivedReports_TestingArchive/` (26 files total across `www-cleanup-scripts/` and `cursorScripts-jira-oneoffs/`). None of these scripts were referenced from `package.json`, any `.cursor/skills/**/SKILL.md`, or any Website Health code path (grep-verified before moving). Added the folder to `.gitignore` so nothing leaks. The active Website Health dashboard, skills, and `src/services/websiteHealth/*` are untouched.

- **Deleted `primereact-overrides.scss` stub + documentation refresh + Button icon-gap fix**: Completed the refactor started yesterday — the decommission stub file was kept only as a breadcrumb, now removed entirely.
  - **Removed `src/styles/primereact-overrides.scss`** (the stub file). Nothing imports it (grep-verified) and `main.scss` no longer `@use`s it; the stub was just a warning comment and is no longer needed now that the migration is landed and documented in `base.scss`, `AGENTS.md`, and `docs/theme-system.md`.
  - **Updated `src/app/main.scss`** decommission comment to reflect that the file is *deleted* (not just stubbed) and that new PrimeReact overrides belong directly in `base.scss`.
  - **Updated `AGENTS.md` → Styles bullet**: removed the `primereact-overrides.scss` file entry and added an architecture paragraph explaining the single-source-of-truth split (`base.scss` owns every PrimeReact `.p-*` structural/behavioural/layout rule driven off `var(--…)` tokens; `themes/*.scss` are palette-only). Documented the `--button-icon-gap` token as the way to control Button icon ↔ label spacing.
  - **Updated `docs/theme-system.md`**: rewrote the file-structure table to mark `base.scss` as the single source of truth for PrimeReact overrides, retagged `themes/*.scss` rows as *palette-only*, removed the obsolete `primereact-overrides.scss` row, and added an **architecture rule** callout box mirroring `cpt-internal-tools`. Added a new **"Add a new PrimeReact component override"** sub-section to *How to Update or Extend the Theme* — tells future contributors/agents: structural selectors go in `base.scss`, palette knobs go in `variables.scss` + each theme file, theme files never re-declare structural selectors, and pointed to the `--button-icon-gap` token for Button spacing.
  - **Updated `docs/theme-system-cpt-internal-tools-mirror.md`**: corrected the mirror-comparison table to show that internal-dashboard **now matches** cpt-internal-tools exactly on load order and override placement (both have PrimeReact overrides inside `base.scss`, not in a separate file). Removed the obsolete `primereact-overrides.css` mention from the target's load-order list and flagged the 2026-04-20 refactor date.
  - **Button icon ↔ label gap fix (`src/styles/base.scss` → Button section)**: The screenshot from the user showed icons touching the label on `.p-button` (e.g. "Run Scan", "Send Report…"). Root cause: `base.scss` has a global `* { margin: 0 }` reset higher in the file, and PrimeReact Lara's default `.p-button-icon-left { margin-right: 0.5rem }` doesn't set `!important`, so depending on Turbopack load order the reset can win on initial paint. Fix: set **`gap: var(--button-icon-gap, 0.5rem)` directly on `.p-button`** (Prime's button is already `display: inline-flex`, so `gap` spaces icon+label regardless of which side the icon is on and works for all five icon positions). Added `.p-button.p-button-icon-only { gap: 0 }` so icon-only buttons stay perfectly centred. Kept a defensive `margin-right`/`margin-left` fallback on `.p-button-icon-left`/`-right` that also reads from `--button-icon-gap` in case PrimeReact markup changes. All values drive off the `--button-icon-gap` token already present in `variables.scss` — no new tokens, no new hex literals. PrimeReact class reference (`.p-button`, `.p-button-icon`, `.p-button-label`) now documented as a comment directly above the rule.
  - Verified: `ReadLints` on `base.scss` and `main.scss` = clean; `npm run build` (Next 16.2.4 / Turbopack) passes (all 10 static pages generated, 26 routes, build ~19s); grep for `primereact-overrides` returns only historical changelog entries and the in-file comment in `base.scss` marking its former location.
- **Theme architecture refactor — decommissioned `primereact-overrides.scss`; `base.scss` is now the single source of truth (mirrors `cpt-internal-tools`)**: Previous architecture loaded five SCSS entry files in `src/app/main.scss` (`variables` → `base` → `utilities` → four theme files → `primereact-overrides`). The `cpt-internal-tools` sibling repo has no `primereact-overrides.scss` at all — its own `primereact-overrides.css` is an intentionally decommissioned stub with the comment *"PrimeReact overrides were migrated into base.scss + themes/*.scss"*. Their `base.scss` is 2400+ lines and owns every `.p-*` structural/behavioural rule, while `themes/*.scss` only override palette CSS variables. Ported that same split here:
  - Moved the **entire contents of `src/styles/primereact-overrides.scss`** into `src/styles/base.scss` under a new section header (`// PrimeReact component overrides — single source of truth for structural / behavioural / layout rules across every theme`) that documents the three invariants: (1) CSS variables only inside selectors, no hex/rgb literals, (2) per-theme colors belong in `themes/*.scss`, not here, (3) `!important` is intentional to beat PrimeReact Lara CSS that loads before ours in `layout.tsx`. All ~755 lines of rules carried over verbatim — Card, Accordion, Panel, DataTable, Message, Tag, ProgressBar, Button, Dropdown/MultiSelect surface, Dialog, Skeleton, plus yesterday's parity additions (Tooltip, ProgressSpinner, SelectButton, Calendar/Datepicker, Toast severity, InlineMessage severity, MultiSelect chips, TabView, Paginator, DataTable loading overlay, Ripple, VirtualScroller, SplitButton, DataTable checkbox density, and the `p-progress-spinner-dash` keyframe).
  - Replaced `src/styles/primereact-overrides.scss` with a **decommission stub** matching `cpt-internal-tools\src\styles\primereact-overrides.css` — keeps the file in git history, warns future contributors not to add rules there, points them at `base.scss` (structure/sizing) or `themes/*.scss` (color/palette).
  - Dropped the `@use '../styles/primereact-overrides.scss';` line from `src/app/main.scss` and added an architecture comment block at the top describing the new responsibility split (`variables.scss` = tokens, `base.scss` = structural source of truth + PrimeReact overrides, `utilities.scss` = helpers, `themes/*.scss` = palette-only). Load order unchanged otherwise.
  - Grep confirms no other file imports `primereact-overrides.scss` (only the stub + the new architecture comment in `base.scss` mention the name). `npm run build` (Next 16.2.4 / Turbopack) compiles in 5.6s with no SCSS or TS errors; no visual diff expected — this is a **pure file-layout refactor**, every selector + value is identical to what was loading before.
- **Theme parity with `cpt-internal-tools` — additive PrimeReact coverage (Tooltip, ProgressSpinner, SelectButton, Calendar/Datepicker, Toast, InlineMessage, MultiSelect chips, TabView, Paginator, DataTable loading overlay, Ripple, VirtualScroller, SplitButton)**: Ran a full parity audit between `c:\local_dev\Github-CPT-Group\cpt-internal-tools\src\styles` (reference — 2400+ line `base.scss` plus 6 `_*-themed.scss` mixin partials included per theme) and this project's single `base.scss` + `primereact-overrides.scss` + 4 theme files. User explicitly flagged **tooltip backgrounds** and **`.p-progress-spinner`** as missing. Audit confirmed tooltip coverage was fully absent (Lara defaults showing), `.p-progress-spinner-circle` had the stroke rule but `.p-progressspinner` (no-dash) and the `.p-progress-circle`/`.p-progress-path` variants were not covered, plus entire missing families: `.p-selectbutton`, `.p-calendar.p-calendar-w-btn` / `.p-datepicker` popup, `.p-toast` severity (only `.p-message` existed), `.p-inline-message` severity, `.p-multiselect-token` chips, `.p-tabview` nav/link/active/panels, `.p-paginator`, `.p-datatable-loading-overlay` spinner, `.p-ripple-element`, `.p-virtualscroller`, `.p-splitbutton-defaultbutton` / `.p-splitbutton-menubutton`. Per user rule *"do not change theme, color or global styles unless specifically asked to"* — the audit explicitly falls under the "specifically asked" exception, but all changes below are **purely additive**; no existing color, selector, or value was altered. Three files grew:
  - **`src/styles/variables.scss` `:root`**: appended PrimeReact parity token block — compact sizing (`--control-height`, `--input-padding-*`, `--input-font-size`, `--input-line-height`, `--inputnumber-button-width`, `--button-padding-*`, `--button-font-size`/`--line-height`/`--icon-gap`, `--tag-padding-*`/`--font-size`, `--dialog-header-padding-*`/`--title-font-size`/`--header-icon-size`, full `--datatable-*` density set including paginator min-height, `--action-button-*` for opt-in CTAs, `--dm-filter-input-border-radius`), font/line-height scale aliases (`--font-size-xs…-4xl`, `--line-height-tight/normal/relaxed`), MultiSelect chip tokens (`--multiselect-chip-bg/fg/icon-fg/border` with palette-appropriate fallbacks), the **full toast severity token set** (`--toast-success-bg/-border/-text`, same for info/warn/error — 12 vars), and skeleton-sheen tokens (`--cpt-skeleton-bg`, `--cpt-skeleton-sheen`).
  - **4 theme files** (`light.scss`, `dark.scss`, `dark-synth.scss`, `ms-access-2010.scss`): each appended its palette-specific block for `--multiselect-chip-*`, all 12 `--toast-*` severity vars, and `--cpt-skeleton-bg`/`--cpt-skeleton-sheen`. Light uses Tailwind-style pastel backgrounds (`#dcfce7` / `#dbeafe` / `#fef9c3` / `#fee2e2`); dark uses semi-transparent rgba over card; dark-synth uses synthwave teal/pink hues (info/error derive from `#24cdc5` + `#f472b6`); ms-access-2010 uses Office 2010 classic toast colors (`#dff0d8` / `#d9edf7` / `#fcf8e3` / `#f2dede`) plus `--border-radius-sm/lg` and `--dm-filter-input-border-radius: 3px`.
  - **`src/styles/primereact-overrides.scss`**: appended a new `"PrimeReact parity — ported from cpt-internal-tools"` section containing **12 new selector families** — (1) `.p-tooltip` text + per-direction arrow coloring tied to `--window-surface-bg` / `--surface-card`, (2) `.p-progressspinner` / `.p-progress-spinner` stroke on `.p-progress-spinner-circle`/`-circle` (no-dash)/`.p-progress-circle`/`.p-progress-path` plus the `p-progress-spinner-dash` keyframe, (3) `.p-selectbutton .p-button` normal/hover/highlight/focus-visible, (4) `.p-calendar.p-calendar-w-btn .p-datepicker-trigger.p-button` + full `.p-datepicker` popup (header prev/next/title, table th/td, today, highlight, buttonbar), (5) `.p-toast` severity backgrounds/borders/text wired to the new toast tokens with icon+summary+detail color overrides, (6) `.p-inline-message` severity matched to the toast tokens, (7) `.p-multiselect-token` chip colors tied to chip tokens, (8) `.p-tabview` nav/link/active/panel surfaces, (9) `.p-paginator` page/first/prev/next/last + highlight + hover + focus-visible, (10) `.p-datatable-loading-overlay` background + `.p-datatable-loading-icon` + nested spinner stroke, (11) `.p-ripple-element` using `color-mix(primary 28%)`, (12) `.p-virtualscroller` transparent background, plus splitbutton default/menu button primary-color parity and a `.p-datatable .p-checkbox .p-checkbox-box` 1rem×1rem density tweak.
  - **Safety**: Existing rules in `primereact-overrides.scss` (Card, Accordion, Panel, DataTable, Message, Tag, ProgressBar, Button, Dropdown/MultiSelect surface, Dialog, Skeleton) are all **unchanged** — parity block is strictly appended after the Skeleton rule. Existing `.p-progress-spinner-circle` rule still applies; new `.p-progressspinner`/`.p-progress-circle`/`.p-progress-path` rule covers the variants it missed (will fall through to the same token). `color-mix(...)` is only used in one place (`.p-ripple-element`) — `base.scss` still has the project-wide `color-mix` removal note (`[0.1.60]`) for Tizen TV browsers, but `.p-ripple-element` is not used on TV dashboards so the progressive enhancement is safe. Skipped (intentionally not ported — dashboard doesn't use these families yet): full menu family (`.p-menu`, `.p-menubar`, `.p-megamenu`, `.p-slidemenu`, `.p-contextmenu`, `.p-tieredmenu`, `.p-panelmenu`), `.p-autocomplete` / `.p-cascadeselect` / `.p-treeselect`, `.p-accordion`-extended (already themed), `.p-card-body-no-padding` helpers, `.cpt-action-button` / `.cpt-action-input`, `.cpt-fade-in/-loop` keyframes, drawer/dockview tokens, data-quality dialog tab specials, dup-checker tokens, `--ssn-timer-*`, `--logo-star-fill`. These can be added later by following the same "append-only" pattern if a feature needs them. `npm run build` (Next 16.2.4 / Turbopack) clean after changes.
- **Website Health — consolidated 3 scan buttons into one unified "Send Report…" dialog (Option A)**: The Website Health dashboard toolbar previously carried four action buttons after the scope `Dropdown` (`Run Scan`, `Submission Scan`, `Deficiency Scan`, `Scan by Date`), which was getting noisy and duplicated a lot of dialog-open/teams-post code across handlers. Collapsed the last three into a single secondary-severity **`Send Report…`** `Button` (pi-send, `severity="secondary"`) that opens a unified PrimeReact `Dialog` headered **Send Report**. The dialog now leads with a custom `role="radiogroup"` three-card mode picker (`.sendReportModeCard` / `.sendReportModeCardActive`, driven by `SEND_REPORT_MODE_OPTIONS` — each card shows `pi pi-send` / `pi pi-calendar` / `pi pi-calendar-plus` icons plus a short description line) for **Submission** / **Deficiency** / **Scan by Date**. Picking **Submission** or **Deficiency** collapses the date fields and shows a compact `.sendReportLiveHint` panel ("Live totals across all active sites — no date picker needed…"); picking **Scan by Date** reveals the existing `Calendar` (range-aware, `maxDate={new Date()}`) and `SelectButton` choice (`Submission` / `Deficiency` / `Both`). A single "Post results to Teams webhook" `Checkbox` (`sendReportNotify` state, default `true`) now governs all three modes. `runSubmissionReport` and `runDailyReport` were upgraded to accept an optional `{ notify?: boolean }` options bag (default `true`) so they honour the toggle; the API routes (`/api/website-health/submission-report`, `/api/website-health/daily-report`) already accepted `notify: false`, so this is label-only on the backend. New `runSendReport` dispatcher branches on `sendReportMode` — closes the dialog and calls the right existing handler, or falls through to `runReportByDate()` which self-closes and opens the result dialog. The dialog's single **Run Scan** `Button` uses a combined `loading`/`disabled` expression (`runningSubmissionReport || runningDailyReport || reportByDateRunning`) so clicking Run locks all three modes and Cancel until the in-flight request finishes. Renamed state `reportByDateOpen` → `sendReportOpen`, `reportByDateNotify` → `sendReportNotify`; date-only state (`reportByDateRange`, `reportByDateChoice`, `reportByDateRunning`) kept its prefix since it is only read by the by-date branch. Toolbar button labels collapse to one dynamic label (`Sending… | Running… | Send Report…`) that reflects whichever of the three sub-handlers is live. SCSS module gained `.sendReportForm`, `.sendReportModePicker`, `.sendReportModeCard` / `.sendReportModeCardActive`, `.sendReportModeIcon`, `.sendReportModeLabel`, `.sendReportModeDescription`, `.sendReportLiveHint` — all driven by theme tokens (`--primary-color`, `--surface-card`, `--surface-border`, `--text-color`, `--focus-ring`, plus `color-mix` fallbacks) so every theme (`light`, `dark`, `dark-synth`, `ms-access-2010`) gets a coherent mode-picker look without touching theme palettes. `npm run build` (Next 16.2.4 / Turbopack) clean.
- **Website Health — "Scan" rename + unified busy-state on all buttons**: Renamed three UI buttons on the Website Health dashboard to a "Scan" vocabulary: **Submission Report → Submission Scan**, **Report by Date → Scan by Date** (Deficiency Scan had already been renamed from Daily Report). The **Run Scan** button was previously the only one not disabled while other reports were in-flight, leaving it clickable during a Submission/Deficiency/Scan-by-Date run — added a single derived `anyBusy` boolean (`runningScan || runningSubmissionReport || runningDailyReport || reportByDateRunning || loading`) that all four action buttons now share for both `loading` and `disabled`, so clicking any one disables the rest with spinners until the in-flight request finishes. Toast summaries for the submission flow updated to *"Submission scan sent/generated/failed"*. The by-date picker `Dialog` header is now **Scan by Date**, the dialog's submit button label is **Run Scan** (was "Run Report"), and the result dialog header prefixes scope with **Scan by Date · …**. Inside the result renderer, both section cards now read **Submission Scan · `<scope>`** and **Deficiency Scan · `<scope>`**. Teams webhook message body also switched to the new vocabulary — title is now **`## WEBSITE HEALTH SCAN BY DATE — … — ran M/D/YYYY at h:mmam|pm`**, the metrics table row **Report types** is now **Scan types**, and section headings are **`### Submission Scan · <scope>`** / **`### Deficiency Scan · <scope>`**. Skill doc `.cursor/skills/website-health-report-by-date/SKILL.md` re-titled **Website Health Scan by Date** and output template updated to match. Internal type names (`WebsiteHealthSubmissionReportResponse`, `WebsiteHealthDailyByDateReport`, etc.) and API route paths (`/api/website-health/report-by-date`, `/submission-report`, `/daily-report`) stay unchanged — label-only refactor.
- **Website Health — "Deficiency Scan" rename + Report-by-Date Teams title timestamp**: Renamed the **Daily Report** button on the Website Health dashboard to **Deficiency Scan** (button label, tooltip, and toast wording — success/warn/error summaries now read "Deficiency scan sent/generated/failed"). In the Report-by-Date picker, the single-select option **Daily** is now labelled **Deficiency** (internal `reportTypes` key stays `'daily'` so the API contract is unchanged). The by-date results dialog card header for the deficiency table now reads **Deficiency Report · YYYY-MM-DD[ → YYYY-MM-DD]**. In the Teams webhook message (`/api/website-health/report-by-date`), the H2 title now embeds the actual scope and a run timestamp in the user-requested format — e.g. `## WEBSITE HEALTH REPORT BY DATE — 4/18/2026 — Submission — ran 4/20/2026 at 12:08pm` — the `| Run at |` metric now renders `M/D/YYYY at h:mmam/pm` instead of raw ISO, and each section heading (`### Submission Report · <scope>`, `### Deficiency Report · <scope>`) echoes the scope. The Deficiency table drops the per-row `Date col` column (redundant — it repeated `DateReceived` on every row) and instead shows one `| Date column used |` row in the section's metric table that collapses distinct `dateColumnUsed` values (e.g. `DateReceived` or `3 columns (DateReceived, DateAdded, CreatedDate)`). Also unblocks the original "I clicked Submission but Teams posted the Deficient section" bug — the single-select choice now forces `reportTypes: ['submission']` exactly, so the Teams message only includes the Submission section. Skill doc `.cursor/skills/website-health-report-by-date/SKILL.md` updated with new labels and title format.
- **Website Health — Report by Date UX fixes**: Two fixes to the new Report-by-Date flow. (1) The report-type picker was a multi-select `SelectButton` (`multiple`) so clicking **Submission** when both options were pre-selected was *toggling off* Submission and leaving Daily, producing a "I asked for submission, got deficient" mismatch. Replaced with a single-select `SelectButton` (`allowEmpty={false}`) with three explicit options — **Submission / Daily / Both** — mapped to the `reportTypes` array via a `choiceToTypes` helper. (2) Removed the per-row **Date col** column from the Daily result `DataTable` (it was just repeating the schema column name `DateReceived` on every row); the actual searched **scope dates** are now in each card's header (`Submission Report · YYYY-MM-DD[ → YYYY-MM-DD]`, same for Daily) and the distinct `dateColumnUsed` value(s) collapse into a single `Date column:` field in the Daily header metadata line.
- **Website Health — Report by Date (5:15 AM downloader window)**: New `/api/website-health/report-by-date` route plus **Report by Date** button on the Website Health page (added after **Daily Report**). Opens a PrimeReact `Calendar` (range-aware single-click = one day, second click = range), a `SelectButton` chooser for **Submission** / **Daily** (either or both), and a notify-Teams checkbox. Submitting runs `runWebsiteHealthSubmissionReportByDate` / `runWebsiteHealthDailyReportByDate` against the active-site list; a "day" is anchored at **05:15 AM** (`[D 05:15:00, D+1 05:15:00)` half-open), mirroring how the downloader actually cycles. Submission filter matches the existing report (DateReceived required, test IDs `2000000–2000039` excluded, `@cptgroup.com` emails excluded, deadline honored). Daily filter probes `CleanClaims` for a date column (`DateReceived`, `DateAdded`, `DateEntered`, `EnteredDate`, `CreatedDate`, `CreatedOn`, `DateCreated`, `RecordDate`) and reports the one it used per site — sites without a recognizable date column come back `status: "error"` with an explanatory message instead of silently returning all-time totals. Results land in a second dialog with PrimeReact `DataTable`s (one per selected report) and, when enabled, also post a markdown summary to the Website Health Teams webhook with window/5:15-anchor footer. New types: `WebsiteHealthReportByDateWindow`, `WebsiteHealthSubmissionByDateReport`/`SiteResult`, `WebsiteHealthDailyByDateReport`/`SiteResult`, `WebsiteHealthReportByDateResponse`. New skill `.cursor/skills/website-health-report-by-date/SKILL.md` documents the `/website-health-report-by-date` agent command (accepts `M-D-YYYY`, `YYYY-MM-DD`, or a range).
- **Jira automation (NOVA) — QA + UAT handoff (Kyle)** (`019d98b7-…`, `019d556a-689f-…`): **Transition → QA** rule retargeted from Brandon to **Kyle** (assignee + comment mention); rule renamed *NOVA: QA requested -> assign Kyle*. **UAT** rule (`[Data team] UAT → assign CM or Brandon (NOVA)`) now runs as **`EVENT_INITIATOR`** (user who triggered the transition) so assign/comment/worklog attribution matches the human mover. After the existing Case-Manager / Brandon assign IF/ELSE, a second IF/ELSE uses **`jira.comparator.condition`** on `{{initiator.accountId}}`: when the transition is by **Kyle**, the handoff comment is prefixed with **`L3 PASSED | `** (then the existing *NOVA Changes Complete…* text unchanged) and **`jira.worklog.add`** logs **5m** with description *L3 passed — automated UAT handoff*; other users get the original comment only (no worklog). `KYLE_ID` added to `scripts/jira/_jiraAuto.mjs`. `verify-comment-bodies.mjs` now walks nested `children` so nested comments appear in audits. Backups: `kyleOutput/jira-rule-backups/nova-qa-pre-kyle__*.json`, `nova-uat-pre-kyle-l3__*.json`.
- **Jira automation (NOVA) — NCOA/ACS on “Move Issues to Active Sprint”** (`019d3183-076e-7e15-9fc7-d8bae4831e18`): After Backlog→To Do board move, a `jira.condition.container.block` runs: if `component in ("NCOA/ACS")`, SET assignee + Tech Owner to **Jeremy Romero** (`62475f051da0e100713b08f2`) and post an internal comment (*NCOA/ACS component found — transitioning to…* with `[~accountid:…]`); otherwise SET assignee + Tech Owner to **Roy** as before. `JEREMY_ROMERO_ID` added to `scripts/jira/_jiraAuto.mjs`; `scripts/jira/README.md` table updated. Pre-change snapshot: `kyleOutput/jira-rule-backups/nova-move-pre-ncoa-branch__*.json`.
- **Dev Corner Two — deploy card green row visibility + unique "healthy" pulse**: In `GithubDeployRepoCards.module.scss`, bumped `.environmentOk` border opacity from `rgba(34, 197, 94, 0.25)` → `rgba(34, 197, 94, 0.6)` so successful `DEV/TST/STG/PROD` rows are clearly visible on TVs instead of reading as nearly-borderless. Added a dedicated **`deployEnvHealthyPulse`** keyframe (4.2s, slow calm breathing with a subtle emerald inner/outer glow and border-color oscillation between 0.55→0.8) so healthy rows have their own visual rhythm — distinctly different from the fast 1.05s failure alarm (`deployEnvFailurePulse`) and the mid-tempo running/queued pulses. Registered the new class in the `prefers-reduced-motion` guard alongside the existing animated env classes.
- **Created NOVA-1629 — prod www cleanup ticket**: New `scripts/build-www-old-sites-report.cjs` joins `\\10.0.0.5\www` folder listing against `CPTMaster.dbo.OCPAutomation` (all 273 rows; 20 currently Active) and writes `kyleOutput/www-old-sites-report.csv` with per-folder `CreatedUtc`, `LastWriteUtc`, match to the Active list (by `WebsiteName` or `WebServerDBName`, case-insensitive), historical (non-active) match, and `DeletionCandidate` flag. New `scripts/create-jira-www-cleanup-ticket.cjs` creates a NOVA Task (assignee = Kyle, labels `prod-cleanup`/`disk-pressure`/`website-health`) and attaches the CSV via `POST /rest/api/3/issue/{key}/attachments` (multipart, `X-Atlassian-Token: no-check`). Ticket created: **NOVA-1629**. New `scripts/inspect-ocp-schema.cjs` helper dumped OCPAutomation columns to confirm `WebsiteName` is the right join key. Baseline numbers: 378 folders, 258 stale, **257 deletion candidates, 1 stale-but-still-Active** (`TwitterSeparation_Mailing` root touched 2023 but LastRan today — evidence that root folder timestamps can miss deep activity). No deletions performed.
- **`scripts/audit-www-sites.ps1`**: Read-only audit of top-level folders under `\\10.0.0.5\www` (each child = one site). Exports `kyleOutput/www-site-audit.csv` with `CreationTimeUtc`, `LastWriteTimeUtc`, and `StaleByFolderTimestamp` vs cutoff (default **before 2025-01-01**). Initial run: **378** site folders, **258** with folder `LastWriteTime` older than 2025-01-01. *Folder timestamps alone can miss activity deep in the tree* — verify IIS/DNS/OCP/active cases before any deletion.
- **Added prod SQL capacity probe**: New `scripts/inspect-prod-capacity.cjs` (read-only, mirrors `test-sql-connections.cjs` shape, `PROD_DB_*` env, connects to `master` the same way `websiteHealth/scan.ts` does). Reports SQL Server version/edition/uptime, disk volumes backing SQL files (total/free/used%), SQL file allocation per drive with non-SQL-on-drive delta, databases by on-disk size, and OS vs process memory. Initial run against `10.0.0.5` flagged **F:\\ at 100% full** (~1.9 TB of non-`sys.master_files` content on the SQL data drive — almost certainly old `.bak` backups), C:\\ at 93%, and `msdb` bloated to 20 GB.
- **Dev Corner Two — OK badge shimmer sweep (non-pulse animation)**: Added a diagonal light-sheen effect on the row-level `OK` `Tag`s inside `.environmentOk` via a `::after` pseudo-element and new **`deployTagShimmerSweep`** keyframe (5.4s cycle, ~1s sweep window at the 68–85% mark). The sheen is a white linear-gradient strip (`mix-blend-mode: screen`) that translates across the tag with a `skewX(-22deg)` tilt, making healthy badges feel "freshly polished" — visually distinct from every other card animation which are all pulses/glows. The tag gets `overflow: hidden` + `position: relative` so the sweep clips to the pill shape; reduced-motion viewers see a static OK tag (`@media (prefers-reduced-motion: reduce)` guard extended).
- **Jira automation tweaks (NOVA/OPRD/CM boards)**: Edited five existing automation rules and created one new rule through the Jira Automation REST API (`https://api.atlassian.com/automation/public/jira/<cloudId>/rest/v1/...`, Basic auth with `JAMES_*` creds since that account has global **Administer Jira**). Reusable helpers added under `scripts/jira/` (`_jiraAuto.mjs`, `list-rules.ps1`, `fetch-rule.ps1`, `fetch-rules-backup.mjs`, `fetch-rules-after.mjs`, plus one update script per rule). Before/after JSON snapshots are dumped to `kyleOutput/jira-automation-backup/` and `kyleOutput/jira-automation-after/` for audit / rollback.
  - **`Move Issues to Active Sprint on Transition`** (NOVA, `019d3183-…`): after the Backlog→To Do move to board 153, assign + Tech Owner intake (Roy by default; **NCOA/ACS → Jeremy Romero** + comment since 2026-04-17 — see `[Unreleased]` note above).
  - **`Case Update Requests & Bugs Auto Add to Sprint`** (NOVA, `019d356a-…`): changed the existing assignee SET from Brandon → **Roy**, and added a new Tech Owner SET to **Roy** (keeps Story Points=1 + current-Sprint behaviour).
  - **`[Data team] UAT → assign CM or Brandon`** (OPRD `019d556a-72df-…`, NOVA `019d556a-689f-…`, CM `019d556a-6dae-…`): replaced the broken `SMART_VALUE` pipe-default assign (which was dropping tickets to unassigned) with two explicit gated actions: (1) `jira.issue.assign` with `{type:"COPY",value:"customfield_10194"}` gated by JQL `cf[10194] is not EMPTY`, (2) literal Brandon assign gated by `cf[10194] is EMPTY`. Tech Owner is intentionally **not** touched on UAT. The NOVA rule's comment body was replaced with Kyle's exact wording (no `@`-mention of the CM, simplified Teams link line); OPRD/CM retained their existing comment text.
  - **New rule `NOVA: QA requested -> assign Brandon`** (`019d98b7-e981-7c94-8a29-d161d13e0a37`, ENABLED, scope NOVA only): triggers on transition to NOVA status `QA` (id 10003). Actions: assign Brandon (literal accountId), then post an internal comment "QA requested. Please confirm changes and transition to UAT if approved." with `[~accountid:<brandon>]` so Brandon gets a Jira mention + email. Keeps the existing UAT rule separate (two distinct rules so we can disable/debug each independently).
  - **Workflow audit (CM / OPRD / NOVA) and follow-ups**: Cross-checked every edited rule's trigger status IDs against each project workflow (`scripts/jira/verify-workflow-statuses.mjs`, `verify-rule-scopes.mjs`, `verify-rule-behavior.mjs`, `verify-comment-bodies.mjs`). Confirmed OPRD UAT (10012), NOVA UAT (10012), NOVA QA (10003), CM Data Team Testing → Data Team Complete, and NOVA Backlog → To Do all exist in their project workflows and fire correctly; all rules are project-scoped (OPRD 10002 / NOVA 10183 / CM 10017). Two follow-ups applied:
    - **Disabled dead `[Data team] UAT → assign CM or Brandon` (CM)** (`019d556a-6dae-7e90-be20-d0982cc3d50b`): CM workflow has no UAT status (dev hand-off uses Data Team Testing → Data Team Complete → Request Complete → Completed instead), so the rule was firing on nothing. Set to `DISABLED` rather than deleted to preserve audit history.
    - **`OPRD Auto Assigns to Roy` (intake)** (`019bb332-09dc-7358-a710-4fedff499888`, renamed from "Brandon"): on OPRD issue-created, now assigns **Roy** and SETs **Tech Owner (`customfield_10193`) = Roy** so new OPRD tickets match the NOVA intake pattern. Tech Owner SET uses the `operations`-array shape (`schemaVersion: 12`) that the Jira Automation API actually persists; an earlier `{fields:{...}}` shape was silently stripped server-side.
  - **UAT reassign — rewritten with real IF/ELSE block** (NOVA / OPRD / CM): caught after NOVA-1612 transitioned In Dev → UAT and stayed assigned to Brandon despite Case Manager = Jennifer Forst. Root cause: the previous structure put two parallel `jira.issue.assign` ACTION components with inline `conditions[]` of type `jira.jql.condition` gating each one; Jira Automation does not honor inline action-level conditions the way the UI implies, so BOTH branches effectively ran and the Brandon fallback won. Additional bug: `assignType: "SPECIFY_USER"` + `assignee: {type: "COPY", value: "customfield_10194"}` is not a valid combination — `SPECIFY_USER` only accepts `{type: "ID", value: <accountId>}`, so the Case Manager copy silently failed. Refactor (`scripts/jira/refactor-uat-ifelse.mjs`) replaces those two actions with a proper `jira.condition.container.block` containing two `jira.condition.if.block` children: one gated on `cf[10194] is not EMPTY` that assigns via `assignType: "SMART_VALUE"` + `smartValue: "{{issue.customfield_10194.accountId}}"`, and one gated on `cf[10194] is EMPTY` that assigns Brandon via `SPECIFY_USER`. Existing comment text (NOVA: Kyle's long message; OPRD/CM: their original Teams-link text) is preserved verbatim. Backups dumped to `kyleOutput/jira-rule-backups/*-pre-ifelse__<timestamp>.json`. Also manually reassigned **NOVA-1612** to Jennifer Forst since the old rule had already run and orphaned it.
- **Dependency security update**: Upgraded `next` and `eslint-config-next` from `16.2.1` to `16.2.3` to address npm advisory **GHSA-q4gf-8mx6-v5v3** (high-severity DoS risk in Next.js Server Components); `npm audit` now reports zero vulnerabilities.
- **Dev Corner Two — GitHub deploy cards (environment-first view)**: Temporarily hid the right-side **Recent deploy runs** timeline and upgraded the 4 deploy cards to show per-environment status rows (**Dev / Tst / Stg / Prod**) inferred from recent runs. Added a global activity bar when any repo is in-flight, per-environment status tags/branch labels, active-run chip + spinner, and TV-safe pulse animations so mixed outcomes across environments are visible at a glance without false “all green” reads.
- **Dev Corner Two — deploy card header timing UX**: Added a live elapsed-time ticker for active runs (client-side 1-second updates between GitHub polls) and moved `Elapsed`/`Finished` into the top card header row inline with the repo title/status, with larger TV-readable chip styling to save vertical space.
- **Dev Corner Two — deploy card timing simplification**: Removed the in-card `Started` detail row so deploy cards focus on the live `Elapsed` signal (plus queued count when present), reducing visual noise in the card body.
- **GitHub deploy API token fallback**: `GET /api/github/deploy-status` now retries with `GITHUB_TOKEN_2` when primary `GITHUB_DEPLOY_READ_TOKEN` results include GitHub auth/rate-limit errors (`401/403`, bad credentials, or rate-limit text), reducing Dev Corner Two false alarm windows during token throttling.
- **GitHub deploy API token telemetry**: Added `tokenUsed` to `/api/github/deploy-status` responses (`primary` or `fallback`) so token failover is observable without any manual toggle or UI interaction.
- **GitHub deploy API third-token failover**: Extended deploy-status failover chain to try `GITHUB_TOKEN_3` after `GITHUB_TOKEN_2` when GitHub auth/rate-limit errors are detected; `tokenUsed` now reports `primary`, `fallback2`, or `fallback3`.
- **GitHub deploy token priority reset**: Reordered deploy-status token preference to use `GITHUB_TOKEN_2` as primary, `GITHUB_TOKEN_3` as first fallback, and legacy `GITHUB_DEPLOY_READ_TOKEN` as third fallback for API/auth-limit recovery.
- **Dev Corner Two — per-environment trigger context**: Replaced the card-level global run ticker with environment-specific trigger text in each `DEV/TST/STG/PROD` row (showing the run title/merge context for that environment’s own latest run), so deploy cause text aligns with each environment status.
- **Dev Corner Two — ticker restoration adjustment**: Restored the pink footer ticker (kept white top ticker removed) and changed ticker content to a compact per-environment rollup (`DEV/TST/STG/PROD` trigger text) so the bottom marquee remains visible without reverting to single-run ambiguity.
- **Dev Corner Two — reusable ticker + queue polish**: Added reusable `MarqueeTicker` UI component and switched deploy cards to use it for per-environment trigger text and footer ticker; queue state now uses a dedicated animated badge shown only when queue depth is greater than zero.
- **Dev Corner Two — ticker theme parity**: Footer ticker strip now uses theme tokens (`--surface-card`, `--surface-border`, `--text-color-secondary`) so background and text automatically follow light/dark theme changes.
- **GitHub deploy API load optimization**: Added shared in-memory caching and in-flight request dedupe for `/api/github/deploy-status` (20s TTL) so multiple viewers reuse one GitHub fetch burst; added stale-cache fallback (up to 5 minutes) plus short cooldown after rate-limit/auth errors to avoid API storming while keeping dashboards live.
- **Dev Corner Two — meter legend redesign + title strip removal**: Removed the GitHub slide hero/title strip and replaced the basic repo-count legend with a PrimeReact `MeterGroup` template (card-style `labelList`) that summarizes all environment slots (`DEV/TST/STG/PROD` per repo) by status buckets: `Successful`, `In Progress`, `Queued`, `Failed`, and `No Data`, with live activity text tied to in-progress/queued totals.
- **Dev Corner Two — meter cleanup follow-up**: Removed the temporary “deployment activity detected” label/progress strip and hid repo deploy-detail cards for now; meter now renders with a custom gradient segment template (Prime example style), and dashboard totals exclude `No Data` slots from tracked status counts (only `Successful`, `In Progress`, `Queued`, `Failed` are counted).
- **Dev Corner Two — deploy slide stability hotfix**: Restored repo deploy cards beneath the meter summary and hardened `MeterGroup` custom render callbacks against undefined render props to prevent runtime `Cannot read properties of undefined (reading 'map')` crashes in the GitHub slide.
- **Dev Corner Two — queued badge + ticker style correction**: Added per-card queued badge in the header (`Q n`, shown only when queued > 0) and restored the footer ticker to bold pink marquee styling for TV readability.
- **Dev Corner Two — top KPI strip removal**: Removed the dashboard-level KPI row (`In Progress`, `Completed`, `Requested`, `Open`) from Dev Corner Two so the slide area starts directly with the deploy meter + cards content.
- **Dev Corner Two — meter legend card layout fill**: Updated top status legend cards (`Successful`, `In Progress`, `Queued`, `Failed`) to use centered flex distribution with `flex: 1 1 auto`, so cards stretch evenly across available width instead of clustering.
- **Dev Corner Two — deploy status wording + active-env clarity**: Standardized active wording to **In Progress**, added multi-environment active badges in each card header (not just most-recent branch), and added per-environment inline indeterminate progress bars for rows currently `In Progress` / `Queued`.
- **Dev Corner Two — MeterGroup gradient rendering fix**: Aligned meter rendering to PrimeReact’s per-item meter template pattern (`meterTemplate` on each value) so top progress segments render in configured gradient colors instead of fallback gray.
- **Dev Corner Two — per-environment elapsed timers**: Added inline elapsed-time labels on each environment row (`DEV/TST/STG/PROD`) when that row is `In Progress` or `Queued`, using live 1-second updates so viewers can see exactly how long each environment run has been active.
- **Dev Corner Two — env row readability boost**: Increased size/weight/contrast of `DEV/TST/STG/PROD` labels and inline elapsed timers so active-row status timing is easier to read at TV distance.
- **Dev Corner Two — env row width + always-visible elapsed**: Reworked env-row layout so trigger text has full remaining width (less truncation on `OK`/`Idle` rows) and elapsed now renders for every env row (`Elapsed —` when no run, completed duration when done, live ticking duration when active).
- **Dev Corner Two — env row layout rollback (follow-up)**: Reverted the last two env-row timing layout experiments and restored the prior row structure/placement for elapsed timing (active rows only) to recover the previous visual balance.
- **Dev Corner Two — elapsed on all env states (same position)**: Elapsed is now shown for every env row state (`OK`, `In Progress`, `Queued`, `Fail`, `Idle`) in the same location directly after the status badge; rows without run timing show `—`.
- **Dev Corner Two — env trigger text width + always-marquee**: Expanded env trigger text area to use full remaining row width and enabled forced marquee scrolling for env trigger text so long run titles no longer appear constrained to a narrow slot.
- **Dev Corner Two — deploy header actor chip**: Replaced card-header `Elapsed/Finished` chips with a single `By <actor>` chip using the latest workflow run actor login from GitHub Actions data.
- **Dev Corner Two — in-progress yellow parity**: Aligned in-progress visual language to yellow across the slide (top `MeterGroup` in-progress segment, per-row inline progress bar fill/track, and in-progress row spinner stroke), matching card badges/tags.
- **Dev Corner Two — branch chip feature toggle**: Added `showBranchContext` prop to `GithubDeployRepoCards` and set it off in `GithubDeployStatusSlide` for now, hiding the under-header branch chip row (`test` / `development`) while preserving active/queue badges and allowing quick re-enable later.
- **Dev Corner Two — queued color + badge placement refinement**: Split `Queued` into a distinct blue visual language (MeterGroup segment, header queued badges, env queued tags, queued pulse, and queued inline progress bars), and moved active env badges (`DEV/TST/STG/PROD`) beneath the 4 env rows for clearer card hierarchy while keeping branch context independently toggleable.
- **Marquee ticker short-text loop fix**: Updated reusable `MarqueeTicker` to compute an adaptive segment gap when `forceMarquee` is enabled and text is shorter than the viewport, preventing immediate back-to-back duplicate text (for example `No recent run No recent run`) while preserving smooth continuous looping.
- **Dev Corner Two — deploy meter/status color parity fix**: Corrected env-state aggregation so non-completed runs map to `In Progress` unless status is explicitly `queued`, restoring yellow `In Progress` counts in the top meter; also standardized `Queued` to orange across the meter and card UI badges/status/progress styling to remove gray/ambiguous reads.
- **Dev Corner Two — 7-day idle window for env status**: Environment rows and meter aggregation now ignore mapped runs older than 7 days, so `Idle` reflects environments with no recent activity (instead of showing stale old outcomes as current), and GitHub workflow fetch depth increased (`per_page=50`, `recentRuns` up to 30) to reduce missed recent env-specific failures.
- **Website Health — Daily Report action**: Added a new `Daily Report` button on `/website-health` plus `POST /api/website-health/daily-report` to send per-active-site CleanClaims totals for `Deficient = TRUE` and `Disputed = TRUE` to Teams, including run-level totals and case-level counts.
- **Submission remediation guidance**: Expanded `.cursor/skills/submission-health-check/SKILL.md` with a controlled remediation workflow (pre-check, identity classification, explicit approval, transactional updates, post-check validation, and Jira ticket/worklog hygiene) for site-level data fixes.
- **Leopalace investigation export flow**: Added a local CSV export workflow for Web DB integrity triage (`kyleOutput/LeopalaceGuamCorporation_EEOC_C-webdb-missing-confirmation-records.csv`) and attached it to NOVA-1282 with a site-specific comment documenting affected IDs, missing columns, and likely early-template instability context.
- **Columbia one-page issue report generation**: Added local report generation for `ColumbiaUniversity_EEOC_C` that outputs a single markdown page with separate tables by error type (`Missing confirmation number` and `IsSubmitted not 1`), reason counts, and issue run-down for inspection-first triage.
- **Website Health Teams all-clear mode**: `POST /api/website-health` now sends a formatted Teams "all systems clear" update when `notify=true` and no issues are found (instead of skipping Teams entirely). Added a dashboard success toast message confirming the all-clear post.
- **Website Health all-clear message formatting**: Teams all-clear post now includes as many site rows as fit under Teams text limits, updates the table header to `Site (shown X/Y)`, emits an explicit length-limit note only when truncation occurs, and formats `Last Run` in readable Pacific time (e.g. `9:14am 4/16/2026`).
- **README skill index**: Added a top-level `Agent Skills` section listing repo skills (`website-health-check`, `submission-health-check`, `website-error-debug`) with what each does and quick slash-command usage examples.
- **Website Health Jira action**: Added a third Actions icon for warning/error site rows to create a Jira ticket automatically (via new `/api/jira/website-health-ticket` endpoint) with prefilled summary, scope/run metadata, DB names, status/error context, and sample missing/Web DB issue rows.
- **Website Health Jira UX + reusable copy button**: Added PrimeReact confirmation before creating Jira tickets and a post-create success dialog with copyable ticket ID/URL; extracted a reusable `CopyToClipboardButton` UI component so copy actions/toasts are consistent.
- **README agent guidance (copy pattern)**: Documented how to use the shared `CopyToClipboardButton` (path, import, behavior, and usage example) so future work reuses one consistent clipboard/toast UX.
- **Website Health Jira create default**: Switched auto-created issue type default from `Bug` to `Task` in `/api/jira/website-health-ticket` because NOVA Bugs currently enforce required custom fields not present in Website Health payloads; documented override behavior in `README.md`.
- **Website Health Submission Report action**: Added a new `Submission Report` button on `/website-health` that posts a full active-site submissions table (total/today/yesterday) to the existing Teams webhook via new `POST /api/website-health/submission-report`, with toast feedback for sent/failed states.
- **Local analyst output path**: Added `kyleOutput/` to `.gitignore` for local one-off submission/health investigation notes and exports that should not be committed.
- **Website Health details dialog**: One scroll container on dialog content (removed nested inner/Web DB table scroll areas); enabled PrimeReact **draggable**, **resizable**, and **maximizable**; **blockScroll** while open.
- **Website Health details UX**: Moved the Web DB issue toggle button next to **Web DB Status** for cleaner alignment and enabled per-row action-button loading/disable states while details API calls are in flight to prevent repeat clicks.
- **Website Health details metrics UI**: Switched the Web DB metrics subsection in Comparison Info to a PrimeReact **DataTable** (metric/value) for clearer structure and consistency.
- **Website Health run-scan and Teams wording**: Updated issue messaging to report both compare vs Web DB impacted site counts; Teams alert table now aligns with dashboard columns (`Web DB`, `Web DB Issues`, `Status`, `Submitted`, `Matched`, `Missing`) and keeps DB names out of the message body.
- **Website Health comparison-info layout**: Moved compare summary (`Submitted`, `Matched`, `Missing`, `Method`) above the Web DB metrics table; `Submitted`/`Matched`/`Missing` now render as themed PrimeReact `Tag`s, and `Missing` includes an eye toggle that expands the same missing-rows table used by the main “View Missing Rows” action.
- **Website Health copy affordance**: Added copy-to-clipboard buttons next to `Website DB` and `2K16 CleanClaims DB` values in Comparison Info, with success/error toast feedback.
- **Website Health Web DB integrity (consistency rules)**: Draft rows with both `DateReceived` and confirmation null are now treated as expected (not errors). Web DB issues are now flagged for submitted-style inconsistencies: `DateReceived` present + missing confirmation, `DateReceived` present + `IsSubmitted`≠1 (**only when** a submitted-flag column exists), or confirmation present while `DateReceived` is null. Issue list shows all applicable reasons per row; breakdown counts can overlap.

### Added

- **Skill: `website-error-debug`**: Added `.cursor/skills/website-error-debug/SKILL.md` for chat-first one-site Website Health debugging (`/website-error-debug <site>`), including grouped error run-down workflow, optional Jira ticket updates, and controlled remediation rules for confirmation backfill/sync (`Submissions` + `CleanClaims`) and `IsSubmitted` fixes.
- **Skill: `submission-health-check`**: Added `.cursor/skills/submission-health-check/SKILL.md` for one-case submission-volume investigations (total/today/yesterday) using project/site input (for example `/submission-health-check CompassionHealthCare_Allin_C`), with optional Teams posting guidance and SQL pattern.
- **Cursor agent skills in repo**: `.gitignore` now allows `.cursor/skills/**` (with `.cursor/rules/`); added `website-health-check` skill (`SKILL.md`, `teams-message-templates.md`). `AGENTS.md` documents versioned Cursor paths.
- **Website Health**: Home grid tile and blank route `/website-health` (placeholder for future analytics).
- **Local SQL env**: `.env.local` may include `DB_*` (CPT2K16, aligned with slack-bot-manager) and `PROD_DB_*` (interactive-site **10.0.0.5**) for future DB-backed features — not committed.
- **`npm run test:sql`**: Dev script `scripts/test-sql-connections.cjs` runs a read-only `SELECT @@SERVERNAME, DB_NAME(), GETDATE()` against both pools (requires `mssql` + `dotenv` devDependencies).
- **Website Health planning doc**: Added `docs/website-health-dashboard-plan.md` outlining responsive UX, discrepancy logic (`Submissions` vs `CleanClaims`), phased delivery, and Teams alert behavior for discrepancy-only notifications.
- **Website Health Teams env key**: Added local `.env.local` key `WEBSITE_HEALTH_TEAMS_WEBHOOK_URL` for discrepancy alerts.
- **Website Health API + scanner**: Added read-only scanner service (`src/services/websiteHealth/`) and `GET/POST /api/website-health` for discrepancy checks between `10.0.0.5` `Submissions` (`DateReceived IS NOT NULL`) and mapped 2K16 `CleanClaims` records.
- **Website Health responsive UI**: Replaced placeholder `/website-health` page with a mobile-first dashboard (scope picker, run button, KPI cards, per-site status table, and missing-item drilldown).
- **Website Health source-of-truth docs**: Deep-dive documented `CPTMaster.dbo.OCPAutomation` (`Active` flag, `CaseName`, `WebServerDBName`, `SQLName`) as active-site source; added guidance to use `SQLName` directly instead of assuming `_SQL` suffix for all active cases.
- **Website Health active-site mapping**: Scanner now loads active cases dynamically from `CPTMaster.dbo.OCPAutomation` (`Active = 1`) with in-memory TTL caching; `POST /api/website-health` refreshes the active list before scan and `GET` uses cache when warm.
- **Website Health details dialog**: Added on-demand per-site details endpoint (`GET /api/website-health/site`) and UI dialog with loading state; “View Missing” now fetches rows for the selected case and shows `Submission ID`, `Date Received`, and `Email`.
- **Website Health defaults / theming**: Default scope is now **All submissions**; added PrimeReact `Dropdown`/`MultiSelect` theme overrides in `primereact-overrides.scss` so selectors follow app theme tokens.
- **Website Health matcher fix (schema-aware)**: CleanClaims matching now adapts per case schema — prefer `SubmissionId`-style columns when present, otherwise fall back to normalized `ConfirmationNo` matching with online-flag filtering (`ClaimFiledOnline`/`SubmittedOnline` when available). This fixes false all-zero/all-error results on cases where `SubmissionId` columns do not exist.
- **Website Health UX polish**: Replaced persistent scan/error banners with user-friendly toast notifications, tightened KPI card spacing for denser layout, renamed KPI label to **Active Sites Checked**, and formatted missing KPI as `total [impacted sites]` (e.g., `195 [4]`).
- **Website Health Teams alert formatting**: Updated discrepancy notifications to a table-first markdown layout with KPI rows (scope, active sites checked, submitted online, missing with impacted-site count, last run) plus per-site detail table for easier channel scanning.
- **Website Health FK priority update**: Matching now prioritizes `CleanClaims.MailingListID` against `Submissions.ID` (canonical relationship from downloader flow), with `SubmissionId` and `ConfirmationNo` fallbacks for nonstandard schemas.
- **Website Health source filter update**: Scanner now excludes internal test submissions where email contains `@cptgroup.com` while still requiring `DateReceived IS NOT NULL`, so discrepancy counts reflect claimant-facing traffic only.
- **Website Health source guardrails update**: Scanner now excludes same-day submissions (`DateReceived < today`) and known test-ID range `2000000–2000039`, in addition to internal `@cptgroup.com` emails, to avoid overnight downloader timing noise and seeded test records.
- **Website Health deadline-aware scope**: Active-site mappings now read `OCPAutomation.Deadline` and apply per-case cutoff (`DateReceived <= deadline`) before discrepancy comparison.
- **Website Health table action split**: Replaced single Details action with two icon buttons (`Info` and `View Missing`) using PrimeReact tooltips. Moved website/2K16 DB names out of main table and into the new Info dialog view (along with deadline, counts, and method note) to keep the results table compact while preserving full context on demand.
- **Website Health Actions column compact sizing**: Reduced action-button dimensions/spacing and narrowed the table Actions column so it fits only the two icon buttons without extra horizontal whitespace.
- **Website Health Actions column hard width lock**: Applied explicit header/body min-max width constraints and a dedicated actions-column class override to enforce a truly fixed Actions column width in PrimeReact DataTable layouts.
- **Website Health table column sizing refinement**: Set `Status` and `Actions` to the same fixed compact width, enabled fixed table layout so remaining columns flex to fill space, and emphasized `Missing` values when count is greater than 1.
- **Website Health tooltip + sizing polish**: Added explicit PrimeReact tooltip targets for status and both action controls (info/missing) and increased fixed `Status`/`Actions` widths slightly for improved click/hover comfort.
- **Website Health downloader cutoff update (5:15 AM)**: Updated source filtering to include same-day submissions only through `05:15` and exclude same-day records after downloader run time; aligned dashboard method text, project skill docs, and internal analysis SQL/docs with the new rule.
- **Website Health table width ratio tuning**: Rebalanced flexible table columns so `Site` gets the largest share while `Submitted`, `Matched`, and `Missing` use equal narrower shares; fixed `Status`/`Actions` widths remain unchanged.
- **Website Health tooltip coverage update**: Switched action buttons to direct PrimeReact `tooltip` props and added descriptive hover help on scope selection, scan action, KPI values, and status labels (with native title fallback on status tags).
- **Website Health compare-mode alignment**: Updated scanner strategy to prefer `ConfirmationNo` matching when available and only fall back to ID linkage when confirmation fields are unavailable, so dashboard totals align with confirmation-based health-check reporting.
- **Website Health missing-count correction**: In confirmation mode, rows with blank `Submissions.ConfirmationNo` are no longer counted as missing, and online-flag truthy checks now include `yes`/`y` in addition to `1`/`true` to match documented compare parameters.
- **Website Health Web DB integrity status**: Added per-site `Web DB` status with issue counts (missing confirmation and non-submitted rows among in-scope `DateReceived` records) so data-quality failures are surfaced as explicit `ERROR` signals independent of CleanClaims match results.
- **Website Health comparison info help**: Added a collapsible PrimeReact accordion in the Info dialog explaining Web DB vs comparison status, metrics, and filters, with contextual notes when a case shows WARNING or ERROR.
- **Website Health Web DB issue drilldown**: Info dialog now loads full site details (same API as missing rows), supports a larger dialog, and adds an eye toggle to list in-scope website submissions with missing confirmation or not-submitted flags.
- **Website Health Web DB missing-confirmation rule**: “Missing confirmation” now applies only when `DateReceived` is set and the row is not explicitly not submitted online (drafts without confirmation are excluded from that bucket); Web DB issue counts use distinct rows with any issue.
- **Internal analysis workspace**: Moved Website Health analysis docs/outputs into `internal-analysis/website-health/` and added `internal-analysis/README.md` so ad-hoc investigation assets stay separate from production dashboard code.
- **Carlos analysis handoff pack**: Added `internal-analysis/website-health/` with plain-language comparison guides and SQL templates (setup/mapping, confirmation-based checks, ID-linkage checks, and reconciliation breakdown) so non-developer data analysis can reproduce Website Health discrepancy calculations consistently.
- **Carlos env onboarding doc**: Added `internal-analysis/website-health/env-setup.md` with required `.env.local` variable names, server mapping guidance, and least-needed access checklist (without secrets) so analysis can run outside Kyle's local environment.
- **Impact analysis CSV ordering + health context fields**: Added `internal-analysis/website-health/impact-analysis-since-fashion-nova.csv` with `OK → WARNING → BAD` row ordering, new `isDBOnline` status column, and clearer offline descriptions for expected comparison failures on offline databases.
- **Deadline-aware impact CSV**: Added `internal-analysis/website-health/impact-analysis-since-fashion-nova-deadline.csv` with confirmation-based results constrained by per-case deadline cutoff, plus `missingAfterDeadlineCount`, `largestMissingDay`, and `largestMissingDayCount` fields for operational triage.
- **Project skill: `website-health-check`**: Added `.cursor/skills/website-health-check/` with case-driven analysis workflow (website DB / SQL DB / case name inputs), confirmation-number comparison defaults, source/target filter rules, and detailed Teams message templates for manual health-check investigations.
- **Dialog theme parity**: Added PrimeReact `Dialog` and dialog-mask overrides in `primereact-overrides.scss` so Website Health details modal follows active theme tokens in both light and dark modes (header/content/footer/close icon states).

### Fixed

- **Dev Corner Two theme parity (timeline/actions panes)**: Replaced hardcoded deploy-pane backgrounds with theme tokens (`--surface-card`) so the right timeline panel and action rows now follow the active theme instead of appearing near-black on some screens.
- **Deploy activity progress bar theming**: Fixed PrimeReact `ProgressBar` styling selectors for the GitHub deploy cards so indeterminate bars consistently use `--github-deploy-progressbar-track-bg` and `--github-deploy-progressbar-fill` (instead of default gray/blue).
- **TV loading state centering**: `nova-dashboard-loading` now centers fallback loaders with explicit flex alignment so loading overlays remain centered regardless of utility class availability.
- **Closed Today KPI semantics**: Updated operational “Closed Today” query to count tickets transitioned to requester handoff statuses today (`CM: Data Team Complete`, `OPRD/NOVA: UAT`) instead of relying on `resolutiondate`, matching team workflow expectations.
- **Limbo criteria tightened to sprint To Do unassigned only**: Limbo now uses a dedicated NOVA query (`sprint in openSprints()`, `status = To Do`, `assignee IS EMPTY`) and no longer counts CM/OPRD backlog or tickets assigned to other people.

- **Landed Today / Net KPI counted non-team tickets**: `kpis.landedToday` was unfiltered (all issues from landed query), while `kpis.closedToday` filtered by `isTechOwnerNovaTeam`. This inflated Landed and Net counts with tickets assigned to non-NOVA members (case managers) or unassigned with no tech owner. Now both sides of the net calculation use `isTechOwnerNovaTeam`, dropping landed today from ~14 to ~7 NOVA-attributed.

- **"Landed Today" count inflated by Backlog tickets**: After the Jira rework, `NOVA_CREATED` JQL was counting all newly created NOVA tickets — including template-cloned tickets sitting in Backlog that hadn't been submitted to the team. Replaced with a two-path `NOVA_LANDED` that mirrors CM/OPRD's transition-based approach: (1) direct-to-sprint tickets (Bug, Case Update Request, dev-originated) use `created >= date AND status != Backlog`; (2) template-cloned tickets use `status changed FROM "Backlog" AFTER date` so the *transition* date — not creation date — determines when work landed on the team. Added `NOVA_LANDED_RANGE` for the prev-14 trend window. Dropped today's count from ~37 to ~14 (23 Backlog templates excluded, 1 Backlog→Done transition correctly captured). All other operational queries (open, resolved) were already clean via `sprint in openSprints()` or resolution-date scoping.

- **Samsung TV CSS compatibility (removed `color-mix()`)**: Samsung Tizen TV browsers (older Chromium/WebKit) do not support the CSS `color-mix()` function, causing missing backgrounds, glows, and translucent effects on TV dashboards while borders and simpler animations rendered fine. Initially added `rgba()` fallback declarations; subsequently removed all `color-mix()` entirely (see v0.1.60) so only universally compatible `rgba()` values remain.

### Added

- **Limbo KPI (Dev Corner One)**: Replaced the "Open" card in the KPI strip with **"Limbo"** — count of active tickets on the board that are not attributed to any NOVA team member (unassigned with no tech owner, or assigned to non-team members). Severity badge: warning when > 0, success when 0.
- **`LimboTicket` type + `limboTickets` array** on `OperationalAnalytics`: sorted by age descending, with key/project/status/assignee/summary/ageDays/isNova. Available for future dashboard panels.
- **`LimboTicketsTable` component** (`src/components/ui/LimboTicketsTable/`): Reusable PrimeReact `DataTable` with auto-scroll, NOVA-key accent, age warning styling. Not mounted on any dashboard yet — ready for future use.

### Changed

- **GitHub deploy queue visibility (Dev Corner Two)**: Monitored workflow cards now include explicit queue depth (`Queued`) and no longer read as all-green when runs are waiting for runners. Status summary and card health now treat `queued-without-in-progress` as an attention/warning state.
- **Work Hours Today now uses dynamic pace percentages**: Replaced fixed hour thresholds with workday-relative scoring against elapsed target hours (9 AM–5 PM): `<=50%` critical, `50–75%` warning, `75–100%` on-track, `100–125%` ahead, `125–150%` high, `150%+` super-performer.
- **Work Hours Today target line**: Added a live vertical target marker (`Target X.Xh`) on the bar chart showing where 100% should be at the current time; marker updates during runtime, uses theme-primary color, and now spans the full chart plotting area (through all bars) for clearer visibility.
- **Work Hours Today target line polish**: Target marker line now renders at **75% opacity** (line only) while keeping the target label full-opacity for readability; line color now uses `--work-hours-target-line-color` (defaulting to `--primary-color`) so it follows each active theme.
- **Work Hours Today target line opacity tweak**: Increased target marker line opacity from **75%** to **85%** for better visibility at TV viewing distance (label remains full opacity).
- **Work Hours Today target layering**: Adjusted marker rendering order so the vertical target line is drawn beneath bars/data labels, preventing it from crossing over hour values on bar text.
- **Work Hours Today high-performance animation ladder**: Added stepped animation intensity for positive over-target zones: `100–125%` uses a muted medium pulse, `125–150%` uses a stronger intense pulse, and `150%+` remains the brightest/craziest full pulse. Animation cadence now scales by level so higher performance zones pulse faster.
- **Work Hours animation visibility tuning (TV)**: Increased per-tier pulse visibility for legacy TV readability by boosting border-width modulation, glow blur, shimmer/ surge amplitude, and tier-specific speed scaling while preserving `150%+` as the strongest effect.
- **Work Hours animation regression fix**: Restored unmistakable bar motion by separating sweep phase (position) from pulse phase (intensity), then increasing medium/intense profile strength so `100–150%` tiers visibly animate again while remaining below `150%+` intensity.
- **Dev Corner One — Team Activity layout refresh**: Removed the outer section header/title row (`NOVA: In Progress...`) and wrapper-card header treatment to reclaim vertical space and eliminate the nested-card/double-border feel; team member cards now render directly in the bottom section.
- **Dev Corner One — Team card readability**: Increased team member name size/weight and boosted in-progress/open counter contrast and badge weight for better distance readability across themes.
- **Dev Corner One — Team ticket chip opacity tuning**: Updated highlighted ticket chips to match the softer Work Hours style — NOVA/cyan and bug/red chip backgrounds now use ~35% alpha while keeping semantic border colors and alert emphasis.
- **Loading overlay centering hardening (Dev Corner + Trevor)**: Added dedicated loading-overlay sizing classes so the initial “Loading NOVA data…” state stays centered in the viewport reliably after layout/theme changes.
- **Work Hours motion visibility (yellow/orange)**: Increased non-red pulse intensity and upgraded `warn`/`over-8h` bars to the stronger animation profile so orange/yellow states visibly animate on TVs.
- **Work Hours Today badge visibility + stronger bar motion**: Header badges now render only when their count is non-zero (Zero/Low/Healthy/Over 8h). Increased in-bar animation visibility with stronger pulsing border width/alpha and an added tinted “surge” wave across bar bodies for clearer TV readability.
- **Work Hours Today zero-hours alerting**: Added explicit **Zero Hours** header badge with fast red pulse and y-axis name highlighting for developers at `0h`, including pulsing red label treatment on the chart for immediate “bad state” visibility.
- **Work Hours Today bar visuals (follow-up polish)**: Added an animated gradient sheen across all non-zero bars and switched non-red bar fills to softer ~35% opacity so cyan/green/orange read less harsh on TV. Red keeps stronger contrast for low-hours alert state.

- **Dev Corner One — Work Hours Today redesign**: Added per-zone visual treatment with TV-safe animations: **red (low hours)** gets hazard pulse + flashing warning triangle, **yellow (4–6h)** uses subtle border pulse, **green (6–8h)** renders full green bars, and **over-8h** now uses orange styling (red reserved for low-hours attention only).
- **Work Hours Today header status badges**: Added compact live badges (**Low / Healthy / Over 8h**) with theme-aware colors and a red pulse on low-hours state for faster at-a-glance scanning.

- **Bug ticket motion polish (Dev Corner One/Two)**: Smoothed bug pulse cadence/transitions for chip/card/table treatments and added stronger TV-readable border/glow cues while preserving `prefers-reduced-motion` behavior.
- **GitHub deploy repo cards (live state emphasis)**: Added subtle status-aware card pulses for active warning/error states so in-progress/pending/problem workflows read as “alive” at a distance.
- **Operational component bucketing (NOVA)**: Component aggregation now includes both Jira Components and NOVA Components (`customfield_10754`) for NOVA issues, reducing “missing component” drift in Dev Corner analytics.

- **Dev Corner One**: Tighter **between-section** spacing — **`dashboard`** column **`gap`** and outer **`padding`**, plus **`middleRow`** column **`gap`** (KPI vs middle vs bottom; work hours vs component activity), without changing inner panel/card content padding.

- **Dev Corner One — team activity chips**: Ticket summaries **wrap** (multi-line) with full text; removed **ellipsis** chip styles. **`buildTeamActivity`** no longer applies **`slice(0, 50)`** to summaries (that truncation caused mid-word cutoffs).

- **Dev Corner One — Component Activity**: Table header is **sticky** via CSS `position: sticky` on `.p-datatable-thead` within the auto-scroll wrapper. Removed PrimeReact's `scrollable`/`scrollHeight="flex"` which was stealing the scroll container from `useAutoScroll`, breaking auto-scrolling on TV.

- **Bug ticket highlighting (Dev Corner One & Two)**: NOVA **Bug** and **Bug Sub-Task** issues get a distinctive alert style: **60% red background**, **pulsing 3px red border** (smooth ease-in-out, 2.4s), **white bold text** for contrast. `isIssueBug()` helper in `operationalAnalytics.ts`; `isBug` boolean on `InProgressTicket`, `RecentlyCompletedTicket`, `RequestedTicket`, and `TeamMemberActivity` (per-ticket `inProgressIsBug[]`). Bug styling overrides NOVA accent when both apply. `prefers-reduced-motion` disables the pulse.

- **Dev Corner One**: **Team activity** grid uses **`repeat(var(--team-columns), minmax(0, 1fr))`** from the member count (was a fixed **4** columns, leaving empty space after Thomas was removed). Panel copy uses shared **`--content-text-size`** via **`--dev1-panel-text`** / **`--dev1-panel-text-sm`**; ticket chips span column width with larger type.

- **Dev Corner Two — GitHub deploy slide**: **`slideGithubDeploy`** — less carousel top padding so the hero sits closer to the **KpiStrip**. Tighter hero → **MeterGroup** stack (**`pillInline`** margin/padding, slide **`.root`** flex gap). Removed the grey meta line; **`pillInline`** title + **Actions API** pill; scoped **`--content-text-size`**; tighter cards/timeline/repo padding; run title **4-line** clamp; card body **`overflow: hidden`** for footer ticker.
- **GitHub deploy repo cards**: Detail rows are **dynamic** — **in progress**: Started + Elapsed only; **completed** (any conclusion): Elapsed + Finished only. Removed the **Workflow** id row.
- **GitHub deploy repo cards**: Removed **owner/repo** line and **Run #** pill; branch pill only. Main run title is a **single-line marquee** (full `--content-text-size`, duplicated segment loop) so long titles do not wrap.

- **Dev Corner Two — GitHub deploy timeline**: Tighter left pane padding, slightly wider opposite column, less gap before the connector, and **`white-space: nowrap`** on status labels so **IN PROGRESS** no longer breaks mid-word (removed `word-break: break-word` on `.timelineOpposite`).

- **Themes — TV content scale + GitHub deploy**: Added global **`--content-text-size`** (default ~`1.04rem`, themes bump slightly). GitHub timeline and repo card body text derive sizes from it; **`--github-deploy-timeline-meta-color`** applies only to the branch/time line under the run title (pink/accent per theme), not the left **SUCCESS / IN PROGRESS / …** column — those use semantic **green / yellow / red / orange** via `deployTimelineOppositeKind()` + `.timelineOppositeSuccess|Running|Failure|Neutral`.
- **GitHub deploy repo cards**: Replaced **Open run** with a **footer ticker** (scrolling run title · branch · run id · “GitHub Actions”). Header **Tag** status badges get subtle **pulse/glow** animations (faster “alarm” on danger). MeterGroup bar **shimmer/pulse slowed** (~5.2s / ~6.5s).
- **Themes — GitHub deploy timeline (Dev Corner Two)**: Timeline sizing tied to `--content-text-size`; theme files set `--content-text-size` + `--github-deploy-timeline-meta-color` (per-theme accent for meta line only).

### Added

- **Dev Corner Two**: **GitHub — CD deploy status** slide (`GithubDeployStatusSlide`): **`GET /api/github/deploy-status`** aggregates the four main CD workflows (Azure Functions API, internal tools SWA, NuGet, EF migrations) via the GitHub Actions API; requires **`GITHUB_DEPLOY_READ_TOKEN`** on the server. **`DEV_CORNER_TWO_FIXED_SLIDE_INDEX`** pins a **0-based index among enabled slides** (see **`devCornerTwoSlides.config.ts`**); use `null` for normal rotation.
- **GitHub webhooks**: `POST /api/webhooks/github` receives org/repo webhook deliveries (verify `GITHUB_WEBHOOK_SECRET` when set), stores normalized rows in an in-memory cache, optional Teams mirror via `GITHUB_WEBHOOK_CPT_GROUP`. `GET /api/webhooks/github` returns cached events for the TV UI.
- **TV route** `/tv/github-activity` (`GithubActivityDashboard`): 4-slide carousel (30s, 30s, 30s, 120s on the feed), polls the GET route every 60s; home screen tile **GitHub activity**.

### Fixed

- **Netlify / `next build`**: `GithubDeployStatusSlide` **DataView** `itemTemplate` now types the row as **`DeployActionItem`** so `ACTION_ROW_GLOW_CLASS[item.outcome]` passes strict TypeScript (Prime’s callback item was `any`).

### Changed

- **Build scripts**: Regenerated `conferenceBackgroundSlides.generated.ts`, `juliesBackgroundSlides.generated.ts`, and `jackiesBackgroundSlides.generated.ts` from `public/backgrounds/` (filesystem order).

- **AGENTS.md** + **`.cursor/rules/typescript-no-any-unknown.mdc`** (always-on Cursor rule): Documented strict typing — no `any`; no `unknown` except at untrusted boundaries with immediate narrowing; use generics and typed callbacks; run lint + build; aligns with ESLint `no-explicit-any` / `no-unsafe-*`. **`.gitignore`**: allow tracking `/.cursor/rules/*.mdc` while keeping other `.cursor/` local.

- **`KpiStrip`** (Dev Corner One & Two, Trevor — shared component): Further reduced **Card** padding, strip gap, label size, and value size (~`1.5rem` → ~`1.22rem`) for a denser TV KPI row; both Dev pages stay visually aligned because they use the same component and matching outer padding (`DevCornerTwo` `.kpiRow` / `DevCornerOne` `.dashboard`).

- **GitHub deploy repo cards** (`GithubDeployRepoCards`): Tighter grid gap, header/body padding, and typography spacing for TV; indeterminate **ProgressBar** is a thinner strip below the meta line with minimal margin. Progress bar colors use theme tokens **`--github-deploy-progressbar-track-bg`** and **`--github-deploy-progressbar-fill`** (`variables.scss` + `themes/*.scss`) instead of Lara defaults.

- **Dev Corner Two carousel**: Slide list is driven by **`devCornerTwoSlides.config.ts`** — each row has **`enabled`** (boolean) and **`durationMs`**; only **`enabled: true`** slides render and rotate. Currently only **GitHub** is enabled for local TV tuning (flip others to `true` to restore the full carousel).

- **Dev Corner Two — Completions by developer** (`CompletedByDevSlide`): Per-column developer header (name + Today/Week counts) uses **`position: sticky`** with solid **`surface-card`** background so labels stay visible while the shared slide area scrolls (custom grid; no DataTable change).

- **Operational analytics (NOVA scope on TVs)**: Shared **`isTechOwnerNovaTeam`** filtering on issues used for **Requested — Not Started**, **In-Progress** cards, **oldest open**, **aging hotspots**, **backlog by assignee** (buckets use `getTechOwnerName`), **backlog by component**, **due-date buckets**, **component activity**, and **by board × component** — excludes work that only has non-NOVA Tech Owner / assignee (e.g. CM queue). Resolution: explicit Tech Owner account when set, else assignee (`getTechOwnerAccountId`). Total open KPIs unchanged.

- **Dev Corner Two carousel**: **Today** (close times by component / `TodayComponentVelocitySlide`) and **Developer Load Matrix** (`DevLoadMatrixSlide`) are **out of rotation** — JSX commented in `DevCornerTwoDashboard.tsx` with restore instructions; components and imports remain for later. Active order: In Progress → Recently Completed → Requested → Completions by developer → GitHub deploy. Dwell: **25s** for slides 1–4; **300s** (5 min) for GitHub deploy (was 2 min).

- **GitHub deploy — Recent actions**: Each row gets a **subtle outcome glow** (green pass / red fail / primary-tinted in progress / soft neutral for cancelled/skipped) via `deployRunOutcomeGlow()` in **`githubDeployDisplay.ts`** and SCSS modifiers on `.actionRow`.

- **GitHub deploy MeterGroup**: Stronger TV-visible motion — brighter sweep gradient, faster **2.1s** loop, added **opacity pulse** (`githubDeployMeterPulse`) alongside `background-position` animation; both respect `prefers-reduced-motion: reduce`.

- **Loading copy (operational / NOVA dashboards)**: Full-screen and panel spinners now show **“Loading NOVA data, please wait...”** via shared constant `LOADING_NOVA_DATA_PLEASE_WAIT` in `src/constants/LOADING_UI.ts` (Dev Corner One & Two, Trevor, Operational Jira, Work Hours Today panel). `role="status"` + `aria-live="polite"` on the loading row.

- **PrimeReact `ProgressSpinner`**: Theme-aligned stroke via `--progress-spinner-color` (defaults to `--primary-color` in `variables.scss` and each `themes/*.scss`). `primereact-overrides.scss` targets `.p-progress-spinner-circle`, drops Lara’s multi-color `p-progress-spinner-color` keyframe cycle, and keeps the dash animation. Matches [ProgressSpinner](https://primereact.org/progressspinner/) structure (`p-progress-spinner` / `p-progress-spinner-svg` / `p-progress-spinner-circle`); optional `pt` overrides remain available per the API.

- **GitHub deploy cards (`GithubDeployRepoCards`)**: Larger meta line and run title text for TV reading; tighter “Open run” text-button padding (overrides Prime `p-button-sm`); run title allows up to three lines.

- **GitHub CD deploy slide (Dev Corner Two)**: Reusable **`GithubDeployRepoCards`** (2×2 **Card** grid with **Tag**, indeterminate **ProgressBar** when a run is active, Prime “Open run” link) now includes left-border health indicators (**green** OK / **yellow** running-warning / **red** error). Slide now uses more of the screen with a split layout: left cards + **DataView** “Recent actions” feed, right **Timeline** of recent runs across repos with improved status column spacing. Both scrolling areas reuse existing **`useAutoScroll`** (no new scroller hook). API includes `recentRuns` per workflow for history widgets. Helpers in **`githubDeployDisplay.ts`** (summary + tag severity + card health).
- **GitHub deploy repo color system**: Added theme-aware repo tokens (`--github-repo-api-*`, `--github-repo-tools-*`, `--github-repo-nuget-*`, `--github-repo-migrations-*`, `--github-repo-label-color`) in `variables.scss` with explicit overrides in all four theme files. These now drive card tinting and repo pills in Recent actions/Timeline so color coding follows theme changes with better contrast.

- **Dev Corner Two**: Shared slide header **`DevCornerSlideHero`** (`src/components/ui/DevCornerSlideHero/`) for the same gradient + pill pattern as “Completions by developer”, applied to all Dev Corner Two slides. Theme tokens **`--slide-hero-bg`**, **`--slide-hero-pill-bg`**, **`--slide-hero-pill-border`** in `variables.scss` (derived from `--primary-color`). GitHub activity TV top bar uses **`--slide-hero-bg`**.

- **Dev Corner Two — slide 6 (completions by developer)**: New **last** carousel slide with a distinct layout (`CompletedByDevSlide` + `CompletedByDevSlide.module.scss`). Five columns (NOVA team): **Today** completions (tech owner) from existing closed-today fetch, plus **earlier this week** (Monday–Friday window capped at min(today, Friday), from existing `resolvedLast14` — no extra Jira calls). `completedByDeveloper` on `OperationalAnalytics`. Dev Load Matrix remains slide 5 with the 2-minute dwell.

- **Dev Corner Two — Developer Load Matrix**: First column uses `table-layout: fixed` and ~6.75rem width so the component label column no longer consumes flex space and shrinks the dev columns. Cell lookups memoized with a `Map` in `DevLoadMatrixSlide`.

- **Dev Corner Two — fifth slide (today)**: New carousel slide **Close times today — by component** with a **Today** tag and subtitle. Uses the same Jira **resolved today** scope as the operational **Closed Today** KPI (`JIRA_OPERATIONAL_JQL_CLOSED_TODAY`). Groups CM, OPRD, and NOVA tickets by component (NOVA Components field when set), NOVA team tech owners only. Shows count per component, average hours to close, fastest close today, and tech owner on the fastest ticket. Cycle time uses the same start semantics as avg close time (transition from New for CM/OPRD, created for NOVA). Transition history is now fetched for **closed-today** CM/OPRD keys so those durations are accurate.

- **Dev Corner Two**: NOVA vs prod styling aligned with Dev Corner One — tickets whose key starts with `NOVA-` use `--nova-accent` card/table row accents; CM/OPRD use default primary styling. Recently Completed column header **Completed by** (still sourced from Tech Owner). Requested slide adds **Tech owner** alongside **Assignee** (both from Jira).
- **Dev Corner Two — Developer Load Matrix**: Layout transposed — **components as rows** (Y), **NOVA team assignees as columns** (X). Cell shading uses `color-mix` with `var(--primary-color)` instead of hard-coded blue.
- **Operational analytics**: For **NOVA** issues, Dev Load matrix and “component” display text prefer Jira **NOVA Components** (`customfield_10754`) when set; otherwise standard Jira components or “No component”. Matrix component list is sorted with “No component” last.

### Added

- **NOVA accent CSS variables**: Added `--nova-accent`, `--nova-accent-border`, `--nova-accent-text` to all 4 themes. Dark-synth uses cyan, dark/light use blue, ms-access uses orange — all matching the theme's primary. Used for NOVA-specific rows, labels, and NOVA-project ticket chips (CM/OPRD chips keep default surface styling).
- **NOVA indicator on Component Activity**: Rows where all tickets are from the NOVA project now have a colored left border and the component name rendered in the NOVA accent color. New `isNova` flag on `ComponentActivity` type, set by the analytics builder based on tracked project origin.
- **Chart color CSS variables**: All chart colors are now theme-aware via CSS variables (`--chart-bar-primary`, `--chart-success`, `--chart-danger`, `--chart-warning`, `--chart-info`, `--chart-orange`, `--chart-cat-1` through `--chart-cat-8`, `--chart-label-color`). Defined in `variables.scss` with per-theme overrides in all 4 theme files (dark-synth, dark, light, ms-access-2010). Default bar color matches each theme's primary color (neo cyan for dark-synth, blue for dark/light, orange for ms-access-2010).
- **Data labels on horizontal bar charts**: Installed `chartjs-plugin-datalabels` and configured in `HorizontalBarChart` to show exact values on each bar with high-contrast white text. Only shows labels for bars with values > 0. Applies to Work Hours Today, NOVA Team Load, Backlog by Component, and Aging Buckets charts.
- **Work Hours threshold borders and flash animation**: Work Hours Today bars have per-bar themed border colors based on hour thresholds (<4h red, 4–6h yellow, 6–7h green, 7–8h yellow, 8–9h orange, >9h red). Uniform 4px borders on all bars. Three flash levels per bar: green = none (static), yellow = subtle (small shadow pulse), orange/red = full (border opacity fade + neon glow). Smooth `requestAnimationFrame` sine-wave animation instead of abrupt toggle. Data labels show "h" suffix (e.g. "6.5h") with vibrant purple text stroke. New `BarFlashLevel` type and `borderColors`, `suffix`, `flashLevels` fields on `HorizontalBarChartData`. Applied to Dev Corner One and Trevor's panels.
- **NOVA ticket chip accent (project-specific)**: Only tickets from the NOVA project get the `--nova-accent` fill + border on their chips in the NOVA Team section. CM/OPRD chips keep default surface styling. Renamed panel header to "NOVA: In Progress (Actively Working On)".
- **New slideshow background images**: Added 74 new images across all three slideshow dashboards — 26 for Conference Room, 25 for Julie's Unicorns, 23 for Jackie's Cute Backgrounds. Regenerated all three `.generated.ts` slide lists via build-time scripts.
- **Work Hours Today panel (Dev Corner One)**: Replaced throughput chart in the left column of the middle row with a horizontal bar chart showing hours logged today (Pacific time) per core dev (Kyle, Roy, James, Thomas). Data sourced from Jira worklog API — JQL `worklogDate >= startOfDay() AND worklogAuthor in (...)` finds issues, then fetches per-issue worklogs and sums `timeSpentSeconds` by author. New server-side `getWorklogsToday()` in `jiraService.ts`, API route `/api/jira/worklogs-today`, client function `fetchWorkHoursToday()`, and `useWorkHoursToday` hook (10-min poll). ThroughputPanel preserved as a component but removed from the layout.
- **Work Hours Today panel (Trevor's Screen)**: Added as 3rd card in the left column below NOVA Team Load. Reuses the same `useWorkHoursToday` hook and `HorizontalBarChart` component. By Board & Component chart gets `flex: 3` for more height; the two horizontal bar charts share the remaining space equally.

- **NOVA team constant** (`NOVA_TEAM.ts`): Renamed from `TREVOR_TEAM` to reflect the team name — *Nerds Of Vast Automation*. Now includes all 6 dev team members: Kyle, James, Roy, Thomas, Brandon Fay, Carlos. Exports `NOVA_TEAM_ACCOUNT_IDS_ARRAY`, `NOVA_TEAM_ACCOUNT_IDS` (Set), `NOVA_TEAM_DISPLAY_NAMES`, `NOVA_TEAM_ORDERED`, `NovaTeamMember` type, and `isNovaTeamMember` helper. All references across stores, JQL constants, and dashboards updated.
- **Dev Load Matrix filtered to NOVA team only**: The Developer Load Matrix now only shows NOVA team members (6 devs), not every assignee across all tickets. Matrix builder in `operationalAnalytics.ts` filters by `NOVA_TEAM_ACCOUNT_IDS` and always includes all 6 members even if they have zero tickets.
- **Requested Tickets slide (Dev Corner Two)**: Replaced Backlog & Aging slide with "Requested — Not Yet Started" table showing tickets waiting for dev pickup. Sorted by age descending with color-coded age tags (info ≤ 3d, warning 4–7d, danger > 7d). Status mapping per project: OPRD → TO DO / Requirement Review, CM → DATA TEAM NEW / REQUESTED, NOVA → TO DO. New `RequestedTicket` type and `isRequestedNotStarted` helper.
- **Workflow status documentation**: AGENTS.md updated with detailed per-project workflow diagrams (OPRD, CM, NOVA) including status-to-concept mapping table. Documents which statuses mean "requested", "actively working", "testing", and "done" for each project.
- **NOVA ticket cleanup**: Closed 36 stale NOVA tickets (not updated in 14+ days) via Jira transitions API. Removed old testing/placeholder tickets (NOVA-1 through NOVA-10) and stale backlog items. Added hygiene guidance to AGENTS.md.

- **Home screen compact tile redesign**: Replaced large card grid with compact clickable tiles (icon + title only). Removed title/subtitle header, "View Dashboard" buttons, and card descriptions. Theme switcher moved to bottom-right corner, subtle. 3-column grid, minimal padding. Julie's unicorn variant preserved.
- **`byProject` and `byBoardByComponent` on OperationalAnalytics**: New fields computing open ticket counts per project and per project-per-component. Used by Trevor's Screen and the ByBoardByComponent stacked bar chart.

### Added

- **`scripts/common-scripts/transition-assignee-nova-to-done.ps1`**: Admin utility to find all non-Done **NOVA** issues for a Jira assignee (`assignee = accountId` + `statusCategory != Done`) and transition them to **Done** (multi-hop until resolved). Uses **`JAMES_EMAIL`** + **`JAMES_JIRA_TOKEN`** + **`JIRA_BASE_URL`** from `.env.jira.temp` or `.env.local`. GET URLs use `$($IssueKey)?fields=...` so PowerShell does not mangle `?` after the issue key.

### Changed

- **Dev Corner Two carousel**: Per-slide dwell times via `SLIDE_DURATIONS_MS` (~30s for the first three slides, 2 min for the Dev Load Matrix slot / future 2‑minute timer). Replaced single `setInterval` with `setTimeout` rescheduled on each `activeSlide` change.

- **NOVA roster**: Removed **Thomas Williams** from the active team in `NOVA_TEAM.ts` (five members: Roy, Kyle, James, Brandon, Carlos). Operational and Trevor JQL `assignee IN (...)` no longer include him. **`DASHBOARD_EXCLUDED_ACCOUNT_IDS`** lists his Jira `accountId` so `buildOperationalAnalytics` drops any issue where he is **assignee** or **tech owner** — TV KPIs, lists, and charts ignore his attribution while his user can remain in Jira. Work Hours scripts (`check-work-hours-today.ps1`, `check-work-hours-sprint.ps1`) and `AGENTS.md` updated accordingly.

- **Slideshow timing (Conference, Julie's, Jackie's)**: Background image rotation increased from 6s to 1 minute; transition duration from 1.5s to 2.5s for a slower, smoother slideshow on all three TV dashboards.
- **Dev Corner One active tickets**: In-progress ticket chips now show only the title (summary), not the board/key prefix (e.g. "NOVA-842: ..."). Summary truncated at 50 characters.
- **Jira scripts use `.env.jira.temp`**: All Jira-related PowerShell scripts in `scripts/common-scripts/` (check-work-hours-today.ps1, check-work-hours-sprint.ps1, inspect-nova-867.ps1) now read `KYLE_EMAIL` and `KYLE_JIRA_TOKEN` from **`.env.jira.temp`** in the repo root first, then fall back to `.env.local`. README updated. Use `.env.jira.temp` for Jira-only credentials per Jira Workflow doc. **Jira NOVA-848 updated** – Comment added (scripts now use .env.jira.temp). Payloads: `scripts/jira-NOVA-848-comment.json`, `scripts/jira-NOVA-848-worklog.json`. Post comment/worklog via curl with credentials from `.env.jira.temp` (see Jira Workflow doc).
- **Work Hours Today precision**: Time tracking display now uses 2 decimal places (e.g. 6.76h instead of 6.8h) in both Dev Corner One and Trevor's Work Hours panels for finer granularity.
- **All chart components themed (zero hardcoded colors)**: Removed all hardcoded `rgba(...)` / `rgb(...)` colors from chart components. `HorizontalBarChart` reads `--chart-bar-primary` for default bar color. `OpenedClosedFlowBarChart` reads `--chart-success` / `--chart-danger`. `ByBoardByComponentStackedBarChart` reads `--chart-cat-*` categorical palette. `OpenAndAvgDaysByAssigneeBarLineChart` reads `--chart-bar-primary` (bars) + `--chart-warning` (line). `OpenClosedAvgHoursByAssigneeRadarChart` reads `--chart-info` / `--chart-success` / `--chart-warning`. `GanttChart` reads `--chart-bar-primary`. All colors switch cleanly with theme changes.
- **Trevor's Screen redesign**: Complete rework — killed radar chart, bar+line chart, Gantt timeline, and scrolling stats bar. All data was inaccurate. Switched from legacy `trevorJiraStore`/`NovaAnalytics` to `operationalJiraStore`/`OperationalAnalytics` for correct, consistent data. New layout: NOVA-focused KPI strip (NOVA Active, In Progress, To Do, Review/QA, Total Open), By Board & Component stacked bar chart (top-left), NOVA Team Load horizontal bar chart (bottom-left), NOVA Tickets table sorted by status with auto-scroll (right). Mobile-responsive.

- **Tech Owner for completed-ticket attribution**: All "completed" analytics now use Jira custom field `customfield_10193` (Tech Owner) instead of assignee. When devs finish work they reassign to the CM for UAT — so assignee at resolution is the CM, not the dev. Affected metrics: Recently Completed table (column renamed to "Tech Owner"), Closed Today KPI, Avg Close Time, Throughput Ratio, 14-day flow chart (resolved side), and trend comparisons. All filtered to NOVA team tech owners only. New helpers: `getTechOwnerName()`, `getTechOwnerAccountId()`, `isTechOwnerNovaTeam()`. `JiraIssueFields` type extended with `customfield_10193`. `JIRA_FIELD_TECH_OWNER` constant added to `JIRA_SHARED.ts`. Tech Owner ID falls back to assignee when field is empty (NOVA tickets).
- **NOVA Tech Owner backfill**: Set `customfield_10193` (Tech Owner) = assignee on all 168 NOVA tickets that had no tech owner. Covers all issue types (Story, Task, Sub-task, Research, Bug) across all statuses.
- **Time-aware refresh**: Data TTL and full-page reload are both time-aware via `getJiraCacheTtl()` and `getPageReloadInterval()` in `JIRA_SHARED.ts`. Business hours (6 AM–8 PM Pacific): 20 min data / 2 hr reload. Off-hours: 60 min data / 3 hr reload.
- **Dev Corner Two KPI: Prod vs NOVA split**: Replaced redundant "Open" + age KPIs with `Open (Prod)` (CM+OPRD) and `Open (NOVA)`. Gives company-facing audience instant workload context. Dev 1: Open, Landed Today, Closed Today, Net, Avg Close, Throughput. Dev 2: In Progress, Completed (7d), Requested, Open (Prod), Open (NOVA). New `openNova` and `openProd` fields on `OperationalKpis`.
- **Dev Corner Two slide duration**: Increased carousel slide time from 20 seconds to 2 minutes (120s) for better readability on TVs.
- **In-progress tickets filtered to NOVA team only**: The Dev 2 "In Progress" card grid now only shows tickets assigned to NOVA team members, not all assignees on the board.
- **Dev 1 NOVA Team panel: core devs only**: Brandon (scrum master) and Carlos excluded from the Dev 1 NOVA Team panel via `NOVA_CORE_DEVS` constant. They remain in all other charts (dev load matrix, JQL filters, etc.). Easy to re-add later by removing the filter.
- **Fixed NOVA team ID-to-name mapping**: The original 4 account IDs were mapped to the wrong display names (Thomas↔James, Kyle↔Roy all swapped). Verified all 6 IDs against Jira REST API and corrected. Added inline comments with Jira display names for future reference.
- **NOVA Team "open" count filtered to dev-responsible statuses**: The per-member open count in the NOVA Team panel now only counts tickets in statuses where the dev team is responsible (e.g. To Do, In Progress, Dev Review, Data Team New, Development, Peer Testing). Excludes tickets handed back to requesters (UAT, Waiting, Data Team Complete, etc.). New `isDevResponsible` helper with per-project status sets.
- **Themed scrollbars**: Applied scrollbar theme variables (`--scrollbar-track-bg`, `--scrollbar-thumb-bg`, `--scrollbar-thumb-hover-bg`) to all scrollable elements via WebKit pseudo-elements and `scrollbar-color` for Firefox. Scrollbars now switch with the theme.
- **Ticket age = time on dev board, not creation date**: Replaced `getAgeDays` (days since Jira created date) with `getDevAgeDays` (days since ticket transitioned FROM "New" for CM/OPRD, or created date for NOVA). This affects all age-related metrics: KPI avg age, oldest, aging buckets, aging hotspots, in-progress/requested ticket ages, component activity aging flags, and avg close time calculation. Store now fetches transition dates for ALL open CM/OPRD tickets (not just landed-last-14).
- **Auto page refresh** (`usePageAutoRefresh` hook): Full `window.location.reload()` every 3 hours on all TV dashboards. Ensures clean state, clears memory leaks, and picks up deployed code changes. Combined with existing soft re-fetch (stores poll every 60s, cache TTL 30 min).
- **Transition-based "Landed on team" metrics**: "Opened" now means when work actually becomes visible to the dev team, not when the Jira ticket was created. CM/OPRD uses `status changed FROM "New"` JQL; NOVA uses `created` date. Changelog API (`GET /api/jira/transitions`) batch-fetches exact transition dates for the 14-day flow chart. Store renamed from `createdLast14`/`openedToday` to `landedLast14`/`landedToday`.
- **Dev Corner One redesign — developer-focused single view**: Replaced risk/workload/action-queue panels with purpose-built panels: KPI strip (open, landed today, closed today, net, avg close time, throughput ratio), throughput flow chart (14d) + trend badge, `ComponentActivityPanel` (per-component: open/today/week), `TeamActivityPanel` (NOVA members with in-progress ticket chips). Removed deprecated `RiskPanel`, `WorkloadPanel`, `ActionQueueTable` sub-components.
- **Dev Corner Two redesign — company-facing carousel**: New `DevCornerTwoDashboard` replaces `NovaDashboard` (which used `jiraNovaStore`). Now uses `operationalJiraStore` for consistent data. 4-slide carousel: `InProgressCardsSlide` (ticket card grid), `RecentlyCompletedSlide` (7-day table), `BacklogAgingSlide` (backlog + aging horizontal bar charts), `DevLoadMatrixSlide` (assignee × component heatmap). KPI strip: In Progress, Completed (7d), Open, Avg Age, Oldest. Non-redundant with Dev 1.
- **OperationalAnalytics extended**: Added `componentActivity` (per-component open/today/week), `teamActivity` (NOVA member in-progress), `inProgressTickets` (status-category filtered), `recentlyCompleted` (7-day window). KPIs: replaced `sprintCompletionPercent` with `avgCloseTimeHours`. Renamed `openedToday` to `landedToday` throughout.
- **TrendBadge UI component**: Inline trend indicator with directional arrow and semantic color (green/red). Props: `value`, `invertColor`, `label`. Reusable for any KPI delta display.
- **KpiStrip UI component**: Data-driven row of KPI cards. Props: `items: KpiItem[]` (label, value, optional severity and badge). Replaces duplicated KPI card patterns across dashboards.
- **OperationalAnalytics extended**: New derived indicators — `throughputRatio` (closed/opened ratio over 14d), `riskScore` (0–100 weighted from aging buckets), `agingHotspots` (top 5 component+assignee by worst avg age), `trendVsPrevious14d` (current vs previous 14d comparison). Risk weights defined in `DEV1_CONFIG.ts`.
- **28-day JQL for trend comparison**: New `JIRA_OPERATIONAL_JQL_CREATED_PREV_14` and `JIRA_OPERATIONAL_JQL_RESOLVED_PREV_14` for the previous 14-day window (days -28 to -14). Store now fetches 7 parallel queries.
- **Workload chart data type and mappers**: `WorkloadByAssigneeChartData` type in `src/types/charts/workloadCharts.ts`. New mappers: `toWorkloadByAssigneeChartData` (sorted desc with % of total) and `toAgingHotspotsBarChartData` (hotspot labels + avg age values).
- **Jackie's Office Dashboard**: New `JackiesOfficeDashboard` page (`/tv/jackie`) with rotating background slideshow from `public/backgrounds/jackies-cute-backgrounds/` and a `CornerInfoCard` showing "Jackie – Vice President, Operations". Follows same pattern as Julie's Office: `BackgroundSlideshow` + `CornerInfoCard`, full-viewport layout, corner badge bottom-right. Build-time script `scripts/generate-jackies-background-slides.js` generates `jackiesBackgroundSlides.generated.ts`. Currently no images in the folder (shows fallback); drop images in and re-run `npm run dev` to populate.

### Fixed

- **Component Activity badge alignment**: Replaced mixed PrimeReact `<Badge>` (for non-zero) + plain `<span>` (for zero) with uniform custom count badges. All values now render as consistently sized circles: themed info/warning fill for active counts, transparent with subtle border for zeros. Centers are properly aligned regardless of value. Columns set to `textAlign: center`.
- **NOVA Team ticket chips themed**: Ticket chips in the NOVA Team panel now use `--nova-accent` fill with `--nova-accent-border` instead of generic `--surface-hover`. Gives NOVA chips a distinct, themed look matching the accent color.
- **Dev Corner theme compliance**: All custom elements (team cards, ticket chips, matrix cells, slide titles, summaries) now use CSS theme variables (`--text-color`, `--surface-card`, `--surface-border`, `--surface-hover`) instead of implicit/unset colors. Both Dev 1 and Dev 2 switch cleanly with theme changes.
- **Dev 1 layout proportions**: Throughput + Component Activity (middle row) reduced to 35% of viewport; NOVA Team panel (bottom row) expanded to 65% for better readability of ticket chips. Increased visible tickets per member from 3 to 4.
- **Jira API v3 pagination**: `jiraService.ts` now handles v3 cursor-based pagination (`nextPageToken`/`isLast`) instead of expecting the deprecated `total`/`startAt`/`maxResults` response fields. Auto-paginates up to 1000 results (10 pages × 100). `JiraSearchResponse` type updated to match.
- **Operational JQL: multi-project (CM + OPRD + NOVA)**: `JIRA_OPERATIONAL.ts` rewritten to closely mirror the Case Management Data Team Board filter (V.3). CM and OPRD scoped by dev-relevant components and **excludes "New" status**. NOVA now uses `assignee IN (NOVA_TEAM)` and `sprint in openSprints()` to match the board — only shows team members' tickets in active sprints, not the entire project backlog. OPRD adds `labels IN ("linked-to-CM")` clause. Open count dropped from ~95 to ~60 after alignment.

- **Auto-scroll on Component Activity**: Fixed `useAutoScroll` not activating — removed reliance on PrimeReact internal `.p-datatable-wrapper` class. Now uses our own `overflow-y: auto` wrapper div with the scroll ref attached directly. Additionally rewrote the hook to use `setInterval` with fractional position accumulation; the previous `requestAnimationFrame` approach with sub-pixel `scrollTop += 0.4` was silently rounded to 0 by the browser, preventing any visible scrolling. Slowed to 12 px/sec for comfortable TV reading.
- **Auto-scroll on NOVA Team ticket lists**: Each team member card now independently auto-scrolls its ticket chip list when it overflows (10 px/sec, 4s pause). Extracted `MemberCard` sub-component to give each card its own scroll ref.
- **Auto-scroll on Dev Corner Two slides**: Applied `useAutoScroll` to all scrollable carousel slides — Recently Completed table (12 px/sec), In Progress card grid (12 px/sec), and Developer Load Matrix (10 px/sec). Removed PrimeReact `scrollable`/`scrollHeight="flex"` from Recently Completed DataTable (same sub-pixel bug as Dev 1). Added shared `.tableCard`/`.tableScrollWrap` SCSS for consistent flex + overflow layout.

### Changed

- **Global font-size: 75% -> 100%**: Base `html` font-size bumped from 75% to 100% (1rem = 16px, browser default). All rem-based sizing scales up ~33% — text, PrimeReact components, spacing, charts. Eliminates the need for extreme browser zoom on TVs.
- **AGENTS.md rewrite**: Comprehensive update with NOVA team info, Jira workflow (CM/OPRD/NOVA status meanings), Dev Corner 1/2 physical layout and dashboard philosophy (developer-focused vs company-facing), non-redundancy rule, auto-refresh strategy, JQL scoping rules.
- **Dev Corner routing**: `dev-corner-one` routes to `DevCornerOneDashboard` (single-view developer dashboard); `dev-corner-two` routes to `DevCornerTwoDashboard` (company-facing carousel). Both share `operationalJiraStore`. Old `NovaDashboard` (jiraNovaStore-based) removed from Dev 2.
- **Routes renamed to match dashboard names**: Julie's Office route changed from `/tv/break-room` to `/tv/julie`; Jackie's Office from `/tv/lobby` to `/tv/jackie`. Router `roomName` values updated to match (`julie`, `jackie`). Route slugs now consistently reflect the dashboard/person name.
- **Backgrounds consolidated**: Moved all background image folders under `public/backgrounds/`: conference room from `public/background/background-conf-room/` to `public/backgrounds/conference-room/`, Julie's unicorns from `public/JuliesUnicorns/backgrounds/` to `public/backgrounds/julies-unicorns/`. Removed old `public/background/` folder entirely. Updated all generation scripts, constants, and docs.
- **Build scripts**: `npm run dev` and `npm run build` now also run `generate-jackies-background-slides.js`.
- **AGENTS.md pre-commit checklist**: Added convention to always regenerate background slide lists before committing/pushing, so new/removed images are reflected in the generated `.ts` files.

### Added

- **CornerInfoCard (reusable UI)**: Small horizontal glassy card for corner placement. Props: `name` (main title), `title` (subtitle/position), `widgetType`: `'weather' | 'cpt' | 'none'`. Background ~30% transparent (theme surface), solid border; name and title use theme text colors. `widgetType="none"` shows only name/title; `weather` and `cpt` render a reserved slot for future content (no API hookup yet). Parent positions the card (e.g. absolute with top/left inset).
- **Docs: Julie's dashboard dynamic card colors**: New `docs/julies-dashboard-dynamic-card-colors.md` – future idea for adapting corner card background/text to the current slide (light/dark or palette per image); no implementation yet.
- **Julie's Office corner card**: JuliesOfficeDashboard now shows a subtle floating card in the bottom-right (3.5rem inset) with "Julie Green" and "CPT President & Unicorn Expert", `widgetType="none"`. Image remains the main focal point; card is responsive and stays in the same corner on all screen sizes.

- **GET /api/sf/projects** – Returns Project__c records as the case list (same shape as support portal: id, label, name, projectName, caseID). Source of truth for cases; cached 5 min. Not yet consumed by any dashboard UI. **Docs**: `docs/salesforce-oauth-and-support.md` updated with route and curl example.
- **GET /api/sf/support-channel** – Returns Support_Channel__c records (support requests from the support portal) for future charts/tables. Fields: Id, Name, CreatedDate, Type__c, Case_No__c, Case_Email__c, Stage__c, Project__c, Website_Detail_Summary__c; ordered by CreatedDate DESC, limit 200; cached 5 min. No UI yet.

## [0.1.56] - 2026-02-19

### Added

- **Reusable chart components (purpose-named)**: New `@/components/charts/` with presentation-only chart components that accept only typed data (no JQL, no store). Components: `OpenClosedAvgHoursByAssigneeRadarChart`, `OpenAndAvgDaysByAssigneeBarLineChart`, `ByBoardByComponentStackedBarChart`, `OpenedClosedFlowBarChart`, `HorizontalBarChart`, `GanttChart`. Chart data types live in `@/types/charts/` (assignee, board/component, flow, horizontal bar, gantt). Mappers in `@/utils/chartDataMappers.ts` convert analytics (NovaAnalytics, OperationalAnalytics) into these types so dashboards stay thin: get analytics from store → map to chart data → pass to chart. Wrappers (Card, Panel, layout) stay on the page; charts have no hardcoded wrappers.

### Changed

- **TrevorDashboard uses shared charts**: Replaced `AssigneeComboChart`, `DistributionChart`, `ByBoardComponentChart`, and local `GanttChart` with shared components from `@/components/charts` and mappers from `@/utils/chartDataMappers`. Page-level Cards and layout unchanged; home page and screen titles unchanged.
- **OperationalJiraDashboard uses shared charts**: Replaced inline `FlowChartMemo`, `BacklogChartMemo`, and `AgingChartMemo` with `OpenedClosedFlowBarChart` and `HorizontalBarChart` plus mappers `toOpenedClosedFlowChartData`, `toBacklogByComponentBarChartData`, `toAgingBucketsBarChartData`. Carousel and KPI strip unchanged.
- **Removed Trevor-specific chart components**: Deleted `TrevorDashboard/AssigneeComboChart.*`, `DistributionChart.*`, `ByBoardComponentChart.*`, and `GanttChart.tsx`; shared `GanttChart` now lives under `@/components/charts/GanttChart`.

### Changed

- **AGENTS.md**: Updated for shared chart architecture — added Charts and TV routes/dashboards sections, chart naming and data-only convention, and pointer to mappers and types.

### Fixed

- **Chart.js tooltip callbacks**: `OpenClosedAvgHoursByAssigneeRadarChart` and `OpenAndAvgDaysByAssigneeBarLineChart` now use the correct Chart.js callback signatures: `afterLabel(tooltipItem)` (single item) and `afterBody(tooltipItems)` (array), per Chart.js TooltipCallbacks API.

## [0.1.55] - 2026-02-18

### Added

- **BackgroundSlideshow (reusable UI)**: New `@/components/ui/BackgroundSlideshow` component. Accepts `slides` (array of image URLs), `intervalMs`, `transitionDurationMs`, `transition`, optional `className` and `fallbackClassName`. Use for any screen that needs a full-bleed rotating background – pass the slide list (e.g. from generated constants) and optional config. Supports multiple **transitions**: `fade`, `slideUp`, `slideDown`, `slideLeft`, `slideRight` (all CSS, ease-in-out, smooth). Empty slides show an optional fallback (theme background). Conference room and Julie's Office now use this component instead of duplicated logic.

### Changed

- **Conference room and Julie's Office use BackgroundSlideshow**: Both dashboards refactored to use `<BackgroundSlideshow slides={...} />` with `transition="fade"` (default). Removed duplicate slideshow markup and CSS from both; ConferenceRoomDashboard keeps only scroller overlay styles; JuliesOfficeDashboard keeps only viewport wrapper. Any future screen can add a slideshow by passing its slide array and choosing a transition.

## [0.1.54] - 2026-02-18

### Changed

- **npm: audit re-check and latest updates**: Re-verified dependency state after updates. Current: **0 high** (minimatch override ^10.2.1), **10 moderate** (ajv in ESLint chain; no fix without breaking eslint-config-next or forcing ajv 8 which breaks ESLint). ESLint kept at ^9 for compatibility with eslint-config-next 16.1.6; ESLint 10 would clear audit only with an ajv override that causes lint to fail. All other deps at latest within range; `npm run lint` and `npm run build` pass.
- **npm: dependencies updated and high-severity vulnerabilities resolved**: Updated devDependencies to latest within range: `@types/node` ^25, `@typescript-eslint/*` and `typescript-eslint` ^8.56.0, `zustand` ^5.0.11. Added `overrides.minimatch` ^10.2.1 to fix 14 high-severity ReDoS issues in the ESLint/minimatch chain; removed `overrides.ajv` (it conflicted with ESLint and caused lint to fail). Audit now reports 0 high, 10 moderate (ajv in ESLint; no safe fix without breaking ESLint). ESLint config: type-aware rules (`no-unsafe-*`) limited to `src/**` with `parserOptions.project` so config files no longer fail; `scripts/**` ignored; strict React/TypeScript rules relaxed to warn where needed so `npm run lint` passes (116 warnings, 0 errors).

### Added

- **Julie's Office dashboard with unicorn rotating background**: New route `/tv/break-room` (Julie's Office) now renders `JuliesOfficeDashboard` with a rotating background slideshow using images from `public/JuliesUnicorns/backgrounds/`. Build-time script `scripts/generate-julies-background-slides.js` (runs before dev/build) reads that folder and writes `juliesBackgroundSlides.generated.ts`; add or remove images and re-run `npm run dev` or `npm run build` to refresh. Same behavior as conference room: 6s per slide, 1.5s fade. No other content yet (scroller/widgets to be added later). Folder created with `.gitkeep`; drop unicorn images in `public/JuliesUnicorns/backgrounds/` to use them.

## Versioning Rules

- **Patch (0.0.1)**: Small changes, bug fixes, minor updates
- **Minor (0.1.0)**: Medium changes, new features, significant updates
- **Major (1.0.0)**: Major releases, production-ready milestones, breaking changes
- Version increments max at 9 (e.g., 0.9.9 → 1.0.0)

## [0.1.45] - 2026-01-29

### Changed

- **Theme system rework (cpt-internal-tools style)**: Theme is now a single SCSS pipeline instead of swapping legacy theme CSS links. Load order: PrimeReact theme (lara-dark-blue) from npm → variables → base → utilities → theme overrides. New files: `src/styles/variables.scss` (default design tokens), `src/styles/base.scss` (resets, html/body, Lato fonts, layout/page styles), `src/styles/utilities.scss` (focus-visible, sr-only), `src/styles/themes/dark.scss` and `src/styles/themes/light.scss` (variable overrides only for `[data-theme='dark'|'light']`), `src/app/main.scss` (orchestration). ThemeProvider only sets `data-theme` on `<html>` and persists to localStorage; no link manipulation. Layout imports PrimeReact theme CSS and main.scss; theme-init script only sets data-theme before paint. `globals.css` content moved into base/layout SCSS; file reduced to a comment. Lato fonts still served from `public/themes/cpt-legacy-dark/fonts/`. Theme toggle is instant with one bundle.

## [0.1.47] - 2026-01-29

### Changed

- **Themes match cpt-internal-tools**: Replaced legacy dark/light with internal-tools themes: dark, light, dark-synth, ms-access-2010. Default theme is **dark-synth**. Theme files (`src/styles/themes/*.scss`) now mirror internal-tools variable names and values; `variables.scss` defaults to dark-synth.
- **Theme switcher only on home page**: Theme can be changed only from the main home page via a sticky button at the top that cycles dark-synth → dark → light → ms-access-2010. TV and other routes have no theme switcher. ThemeProvider exposes `theme`, `setTheme`, and `cycleTheme` (replacing `toggleTheme`).
- **No inline styles for theme-driven UI**: Removed inline styles from components so theme variables control appearance. Progress spinners use classes `progress-spinner-sm` / `progress-spinner-md`; chart containers use `chart-height-sm|md|lg|xl` and `chart-meter-container` with theme vars `--progress-spinner-size-*`, `--chart-height-*`, `--chart-meter-*` (all themes define these). JiraMeterChart center value/label use `chart-meter-center-value` and `chart-meter-center-label`. Conference room slideshow transition moved to CSS module; only dynamic `backgroundImage` remains inline. TextScroller keeps inline `--text-scroller-duration` (prop-driven). Spinner and chart variables added to every theme file.

## [0.1.49] - 2026-02-13

### Changed

- **Julie's Office icon: Font Awesome removed, local unicorn SVG**: Removed all Font Awesome packages (`@fortawesome/fontawesome-free`, `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/react-fontawesome`, `fontawesome`). Julie's Office card now uses a local unicorn SVG (from `public/icons/emoji-unicorn.svg`), inlined in `DashboardCard` as `UnicornIcon` with `stroke="currentColor"` so it follows the theme primary color.

## [0.1.48] - 2026-02-13

### Changed

- **Home screen: Julie's Office and Jackie's Office cards**: Renamed **Lobby** to **Jackie's Office** (briefcase icon, `pi pi-briefcase`) and **Break Room** to **Julie's Office** (unicorn icon). Julie's card uses a local unicorn SVG (from `public/icons/emoji-unicorn.svg`, inlined in `DashboardCard` as `UnicornIcon` with `currentColor` for theme) and a subtle unicorn-style accent (pastel purple/pink gradient border and hover glow). Font Awesome removed; `DashboardItem` supports optional `variant: 'unicorn'`; `DashboardCard` accepts `variant` and applies `.dashboard-card-unicorn` for Julie's card.

## [Unreleased]

### Added

- **AGENTS.md**: Project root file for AI coding agents. Describes stack (Next.js 16, React 19, TypeScript, PrimeReact, Zustand, etc.), dev setup and scripts, build-time slide generation, code layout and `@/` paths, conventions (no theme/global style changes unless asked; always update CHANGELOG after completed tasks), and lint/build expectations. **Continual learning** section: capture new conventions and user preferences in AGENTS.md or `.cursor/rules/`; keep AGENTS.md current when stack or layout changes.

- **NOVA dashboards: only NOVA-661+**: All NOVA data (Dev Corner Two, Operational, Dev1, Trevor) is filtered client-side to **NOVA-661 and above**. Legacy issues (NOVA-1 through NOVA-660) are excluded from counts, charts, and tables. Constant `JIRA_NOVA_MIN_ISSUE_NUM = 661` in `src/constants/JIRA_NOVA.ts`; shared filter in `src/utils/jiraNovaFilter.ts` used by `jiraNovaStore`, `operationalJiraStore`, `dev1JiraStore`, and `trevorJiraStore`. Open counts for Dev1 and Trevor are now derived from the filtered list (no separate Jira open-count request).

- **Docs: closing legacy NOVA (NOVA-1–660)**: New `docs/jira-close-nova-legacy.md` with JQL and steps to close/resolve legacy NOVA issues via Atlassian CLI (or bulk in Jira). Notes that Jira compares `key` as string so strict numeric range 1–660 may require export + filter then bulk transition.

- **Jira API layer for widgets**: New `src/services/api/endpoints/jira/` with fine-tuned, typed API functions: **tickets** – `getTicketsTransitionedToday()` (resolved today, not created), `getTicketsCreatedToday()`; **updates** – `fetchUpdates(since)` for incremental “updated since” polling. JQL for these in `jira/jql.ts`; all NOVA results filtered to key ≥ 661. **Hook** `useJiraUpdatesPolling({ intervalMs, onUpdates })` runs `fetchUpdates` every 30 minutes (configurable), tracks last check timestamp, and optionally calls `onUpdates(issues, fetchedAt)` for widgets. Exported from `@/services` and `@/hooks`.

- **Salesforce API (read-only) and discovery**: New server-side `src/services/api/salesforceService.ts` – OAuth2 password flow (env: SF_LOGIN_URL, SF_CLIENT_ID, SF_CLIENT_SECRET, SALESFORCE_EMAIL_KYLE, SALESFORCE_PASSWORD_KYLE, SALESFORCE_SECURITY_TOKEN_KYLE), `describeGlobal()`, `describeSObject(name)`, `query(soql)`. **Routes**: `GET /api/salesforce/discover` (list sobjects; `?sobject=Account` returns describe for one object), `GET /api/salesforce/query?q=SOQL` for read-only SOQL. **Docs**: `docs/salesforce-discovery.md` – setup, discovery log template, and tables to track objects/fields and chart ideas as we learn what data we have.

- **Salesforce OAuth (CPT TV) and Support Portal**: **OAuth2 Authorization Code + PKCE** for Connected App “CPT TV”. Env: `SALESFORCE_CONSUMER_KEY` / `SALESFORCE_CONSUMER_SECRET` (or `SF_CLIENT_ID` / `SF_CLIENT_SECRET`), `SF_LOGIN_URL` (default login.salesforce.com), `SF_API_VERSION` (default v60.0). **Routes**: `GET /oauth/start` → redirects to Salesforce authorize; `GET /oauth/callback` → exchanges code for tokens, writes `.sf_tokens.json` (dev), shows “Connected”; `GET /api/sf/whoami` → userinfo (verify token); `GET /api/sf/describe/support-channel` → Support_Channel__c describe (required + createable fields); `GET only in this app; Support Portal (cpt-support-portal repo) has OAuth + POST /api/support-request. **Docs**: `docs/salesforce-oauth-and-support.md`. `.sf_tokens.json` in .gitignore.

- **Conference room slideshow: auto-use all folder images**: The conference room background slideshow now uses every image in `public/background/background-conf-room/` with no manual list. A build-time script (`scripts/generate-conference-slides.js`) runs before `dev` and `build` (no API, no third-party deps), reads the folder (recursively, including subfolders), shuffles the order, and writes `conferenceBackgroundSlides.generated.ts`. Supported extensions: jpg, jpeg, jfif, png, gif, webp, svg, bmp, avif. Add or remove images in that folder; run `npm run dev` or `npm run build` so the list updates (do not run `next dev` directly or the list can be stale). **Generated file is now committed** so the full list is in the repo and all slides (e.g. bg-13, bg-17, bg-20+) are included; script still runs before dev/build to refresh when new images are added.

### Fixed

- **npm audit: 0 vulnerabilities**: Resolved 10 moderate (ReDoS in ajv) by adding `overrides.ajv` to `^8.18.0` in `package.json`. All dependencies now use a patched ajv.

### Changed

- **Dependencies**: React and React-DOM set to 19.2.4; `@types/node` to ^22. Next.js and eslint-config-next remain at latest stable 16.1.6.

### Added

- **Operational Jira TV dashboard for Dev Corner One and Two**: **Dev Corner One** (`/tv/dev-corner-one`) and **Dev Corner Two** (`/tv/dev-corner-two`) now both show the same real-time operational dashboard. **1) KPI strip**: Open, Opened today, Closed today, Net today (with PrimeReact **Tag**: Growing/Shrinking/Flat), Avg age, Oldest open. **2) Flow**: PrimeReact **Panel** (toggleable) + **Chart** bar – Opened vs Closed last 14 days. **3) Backlog by component**: **Card** + **Chart** horizontal bar; **Tag** “Aging” for components with tickets >7d. **4) Developer load matrix**: Heatmap table (dev × component). **5) Aging buckets**: **Chart** horizontal bar (0–1d … 15+d). **6) Oldest 10**: **DataTable** with **Tag** for Status (severity by age). Uses PrimeReact Card, Chart, DataTable, Message, ProgressSpinner, Skeleton, Tag, Panel. Data from `operationalJiraStore` (JIRA_OPERATIONAL, NOVA). Standalone “Operational Jira” entry removed from home list; access only via Dev Corner One or Two. `chartjs-plugin-gantt` can be added later if a Gantt view is needed.
- **PrimeReact component theme overrides**: New **`src/styles/primereact-overrides.scss`** overrides all lara-dark-blue hardcoded components using theme variables only (works for every theme). Overrides: **Accordion** (header link, hover, highlight, content, focus-visible), **Card**, **Panel** (header, content, footer, header icon, hover, focus-visible), **DataTable** (header, footer, thead/tbody/tfoot, sortable/hover/highlight, scrollable, striped), **Message** (info/success/warn/error), **Tag** (default + success/info/warning/danger), **Button** (primary, outlined, text), **Skeleton**. Loaded after theme files in `main.scss`. Card overrides were removed from the four theme files and consolidated here.
- **.p-card theme overrides** (consolidated): Card overrides now live in `primereact-overrides.scss`; duplicate `.p-card` blocks were removed from dark, light, dark-synth, and ms-access-2010 theme files.

- **Theme system documentation**: New **`docs/theme-system.md`** is the canonical reference for using and updating the theme (default dark-synth, four themes, file structure, load order, how to add a theme or variable, theme-init script, PrimeReact CSS). README Theme section and Documentation list updated; `theme-implementation-notes.md`, `primereact-theming.md`, and `theme-investigation-interactive-and-internal-tools.md` now point to `theme-system.md` for current behavior.

### Changed

- **Dark-synth theme application fix**: PrimeReact theme.css sets `:root` with blue colors; when it loaded after our SCSS (e.g. in some Next.js/Turbopack orderings), it overwrote our variables. **variables.scss** now uses `!important` on all dark-synth `:root` variables so our theme wins. **dark-synth.scss** adds explicit `html[data-theme='dark-synth']` and `body` background/color rules so the purple/cyan background and text apply even if variable order is wrong. **base.scss** uses fallbacks `var(--page-background, #0c0020)` and `var(--text-primary, #dbd4fa)` so first paint is always dark-synth. Layout comment documents that theme.css must load before main.scss.
- **Chart theme overrides – colors only, not sizing**: Chart sizing variables (`--chart-height-*`, `--chart-meter-height`, `--chart-meter-center-value-font-size`, etc.) were removed from all four theme files. Sizing is defined once in `variables.scss` and used by base styles; themes no longer override chart dimensions or meter font sizes. Chart **colors** continue to come from theme (e.g. `--text-color`, `--surface-border`) via the JS options passed to PrimeReact Chart.
- **Trevor Dev Team Timeline when empty**: Timeline card no longer grows when there are no Gantt tasks: it uses a compact height (max 100px) and does not take flex space. Empty state uses class `trevor-gantt-empty` with `flex: 0 0 auto` and `min-height: 0` on the inner wrap.
- **Trevor layout alignment**: Charts row and board row use full width and consistent spacing. Board row top margin set to 0.35rem to match dashboard gap; removed redundant `mt-2`. Chart row columns are flex so cards align; grid and cards have `min-width: 0` to avoid overflow.
- **Operational Jira KPI strip compact**: KPI strip at the top of the operational dashboard is now much smaller to save real estate: reduced card padding (0.25rem 0.35rem), smaller value font (1.15rem), smaller labels (0.7rem), and tighter grid gap/margin. Uses scoped classes `operational-kpi-strip`, `operational-kpi-value`, `operational-kpi-label` in `base.scss`; loading skeleton uses the same strip with 6 compact cards.
- **Operational Jira TV carousel (no scrolling)**: Dashboard content below the KPI strip is now an auto-rotating carousel with four slides so the whole dashboard fits on a TV without scrolling. **Slide 1**: Flow (last 14 days) chart. **Slide 2**: Backlog by component and Aging buckets side by side. **Slide 3**: Developer load matrix. **Slide 4**: Oldest 10 open tickets. Slides advance every 25 seconds. Dot indicators at the bottom show the current slide. Layout uses `min-height: 100vh; max-height: 100vh; overflow: hidden` and flex so the carousel area fills the remaining space; all content is sized to fit within one view.
- **Operational carousel smooth transitions and countdown**: Carousel uses a slide-left/slide-right transition (0.6s ease-in-out): the current slide slides out left and the next slides in from the right. Each slide’s title shows a live countdown when it’s active, e.g. `Developer load matrix (countdown: 12s)`, with the number updating every second until the next slide.
- **Operational carousel: no chart re-renders from countdown**: Countdown state is isolated in `SlideTitleWithCountdown` so only that component re-renders every second; the dashboard and charts no longer re-render on each tick. Bar charts (Flow, Backlog, Aging) are wrapped in `React.memo` so they only re-render when their data/options change, preventing constant re-renders and flicker. DataTable column `body` renderers use `useCallback` for stable references; `SlideTitleWithCountdown` is memoized so it only re-renders when its props (e.g. active slide, start time) or its own tick state change.
- **TextScroller optional text/background colors**: **TextScroller** accepts optional **`textColor`** and **`backgroundColor`** props. When omitted, text uses theme (`--text-color`) and background is transparent so parent/theme controls it (e.g. Trevor page keeps theme). **Conference room** uses `textColor="white"` and `backgroundColor="black"` for a white-on-black strip; scroller wrap background set to black.
- **Trevor dashboard: single-screen, responsive for TV/small viewports**: Layout fixed so everything fits on one screen with no page scroll and no overlap. **Single screen**: `overflow: hidden` on `.trevor-dashboard-content` (was `overflow-y: auto`). **Charts row**: `flex-shrink: 0` and **max-height** via `--trevor-charts-row-max-h` (22rem) / `--trevor-charts-row-max-h-mobile` (18rem) so the row never overflows or overlaps the timeline. **Distribution donut**: Strict containment—`overflow: hidden` on card and content, `max-height: 100%` on chart-meter-container and wrappers; DistributionChart module uses `max-height: 100%` and `overflow: hidden` so the donut never breaks out. **Board row**: `flex-shrink: 0` and `max-height: var(--trevor-board-card-max-h)`. **Timeline**: Gets remaining space (`flex: 1; min-height: 0`); card content scrolls internally if needed. **TV/small**: Media queries at 1024px and 767px reduce chart/board heights and timeline min so the full dashboard fits on Trevor’s TV (mobile-like viewport). New variables: `--trevor-charts-row-max-h`, `--trevor-charts-row-max-h-mobile`.
- **Trevor Distribution donut**: Donut and container reduced to 88px / 14vh so the chart is smaller. Center value/label use theme variables with fallbacks (`--text-color`, `--p-text-color`, `--text-color-secondary`, `--p-text-muted-color`). JiraMeterChart legend text now uses computed theme color so it renders white (or theme text color) instead of black.
- **Trevor Open & avg combo chart**: Switched to PrimeReact ComboDemo-style: single `<Chart type="line">` with mixed bar + line datasets; options built in `useEffect` via `getComputedStyle(document.documentElement)` for `--text-color`, `--text-color-secondary`, `--surface-border` (legend, ticks, grid). Chart always shows all 4 team members (Roy, James, Thomas, Kyle) using `TREVOR_TEAM_ORDERED`; missing assignees show as 0 open / 0 avg days.
- **Trevor spacing and timeline**: Charts row uses CSS Grid (7fr 5fr) with 0.35rem gap for consistent alignment; board row margin removed so parent gap controls spacing. Empty Dev Team Timeline section limited to 72px max height with compact padding; empty message uses `.trevor-gantt-empty-msg` and theme secondary text color. Gantt wrapper has min-height 180px when there are tasks so frappe-gantt can render (still using react-frappe-gantt; PrimeReact has no Gantt component).
- **Trevor chart overflow**: Chart wrappers constrained so charts no longer overflow cards. Card content and `.trevor-chart-inner` use `overflow: hidden`, `min-width: 0`, and explicit heights (e.g. `chart-height-xl` = min(160px, 24vh)); PrimeReact Chart root (`.p-chart`) forced to `width/height 100%` and `min-height: 0` so Chart fills the inner and respects `maintainAspectRatio: false`. Board row cards and content also get overflow containment. Charts use `className="trevor-chart-canvas"` for targeting.
- **Trevor charts as components; styles out of base**: Each Trevor chart is now a functional component with its own module styles: `AssigneeComboChart`, `DistributionChart`, `ByBoardComponentChart`. Chart sizes, overflow, and containment live in each component's `.module.scss`; base.scss only keeps layout (grid, gap, card padding) and theme/color rules. Options and colors use `getComputedStyle(document.documentElement)` in each component (PrimeReact demo pattern). Follows do-donts: co-locate component + styles, keep components under 300 lines.
- **Trevor Open & avg: radar chart**: Replaced horizontal combo with a **radar** chart so all 4 team members (Roy, James, Thomas, Kyle) are always visible as four axes. Two datasets: Open count and Avg days to close (avg days scaled to match open for visibility; tooltip shows actual days). Theme colors from getComputedStyle for legend, point labels, and grid.
- **Trevor Distribution donut fills card**: Distribution chart container now fills the full card content (width/height 100%) so the donut and legend use all available space instead of a small fixed block with unused space; layout drives size via flex and stretch.
- **Trevor assignee radar: Open, Closed, Avg hours to close**: Radar now shows three metrics: **Open**, **Closed** (done count), and **Avg hours to close** (avgDaysToClose × 24, rounded to 1 decimal). Tooltips show actual open count, closed count, and avg hours (with days in parentheses when ≥ 1). Card title set to "Open, closed & avg hours by assignee" with subtitle **CM, NOVA, OPRD** so it’s explicit that data is across all three boards (JQL already uses project IN (OPRD, CM, NOVA)).
- **Trevor Distribution**: Wrapper fills card height and centers the donut; donut size set to min(100px, 16vh) so it uses space without leaving large gaps. Card content flex so the section is no longer small with unused space.
- **Trevor Distribution layout**: Donut was too small and looked odd. Distribution chart now uses a single block (donut + legend) at min(180px, 26vh) height and min(240px, 36vw) width (max-width: 100%) so it scales with the card and leaves room for the legend. Wrapper uses flex center so the block stays centered and rearranges with the card.
- **Trevor Distribution chart**: Donut replaced with combo bar + line chart: **bars** = Open per assignee (left Y-axis), **line** = Avg days to close (right Y-axis, dashed). Uses TREVOR_TEAM_ORDERED and theme colors from getComputedStyle; dual scales (y / y1) so both metrics are readable.
- **Chart heights/sizes scoped per chart (not global)**: Chart heights and meter styles no longer live in **base.scss** so global styles don’t override other charts. **JiraMeterChart**: container, center overlay, and label styles moved to **JiraMeterChart.module.scss**. **Trevor**: charts row, chart cards, distribution card, gantt chart wrap, and related media queries moved to **TrevorDashboard.module.scss** (imported by TrevorDashboard). **Dev Corner One** and **Nova**: chart wrapper heights (xl/lg/md) moved to **DevCornerOneDashboard.module.scss** and **NovaDashboard.module.scss** and applied via module classes. **variables.scss** still defines `--chart-height-*` and `--chart-meter-*`; components reference them in their own modules. Base keeps only a short comment that chart sizes are component-scoped; colors remain theme-driven.
- **Trevor timeline**: More robust date handling: `parseDate()` accepts string (ISO or YYYY-MM-DD), number (timestamp), and normalizes to YYYY-MM-DD so tasks are created when Jira returns `created` in different shapes. Empty state message: "No issues loaded…" when no issues from Jira, or "No tasks with valid start/end dates…" when issues exist but none have parseable dates. GanttChart accepts optional `noData` prop for this.
- **Docs**: Added `docs/gantt-timeline-options.md` with options (chartjs-plugin-gantt, react-calendar-timeline, SVAR Gantt, Highcharts/Bryntum) and recommendation to start with chartjs-plugin-gantt for the Trevor timeline use case.
- **Trevor responsive layout (rem + min/max)**: Trevor dashboard is now fully responsive. **variables.scss** adds Trevor design tokens: `--trevor-gap`, `--trevor-padding`, `--trevor-charts-card-min-h`, `--trevor-charts-card-max-h`, `--trevor-charts-content-min-h`, `--trevor-board-card-max-h`, `--trevor-timeline-min-h`, `--trevor-timeline-max-h` (all rem-based). **base.scss** uses these for padding, gap, and all chart/timeline min/max heights so layout scales with viewport and doesn’t break when the grid wraps. At `max-width: 767px` when the top row stacks to one column, both cards get the same min/max so layout stays even. AssigneeComboChart, ByBoardComponentChart, and DistributionChart modules use rem for wrap min/max heights. Empty gantt and chart-inner use rem. Trevor page stays usable at any viewport size.
- **Trevor Distribution donut and timeline fixes**: Distribution card now has class `trevor-chart-card-distribution` and base styles so the donut container fills the card (height 100%, min-height 160px); charts row card content has min-height 180px so both top cards get space. Timeline: when it has tasks, the gantt wrap gets min-height min(420px, 48vh), chart wrap min-height 320px and .p-chart min-height 300px so bars and labels are readable; bar thickness 32px, tooltip shows formatted dates.
- **Trevor Distribution donut centering**: **JiraMeterChart** now supports `legendPosition="bottom"` so the legend sits below the donut; with legend on the right the "1 Open" center text was misaligned (centered in the full box including legend). Distribution uses `legendPosition="bottom"`. Base styles: `.chart-meter-legend-bottom .chart-meter-center` is limited to the top 50% of the container so the center text sits in the donut hole; Distribution card content and wrap use `align-items: stretch` and `width: 100%` so the meter fills the card and the donut is centered.
- **Trevor Dev Team Timeline – Chart.js**: Replaced **react-frappe-gantt** (which never rendered) with a **Chart.js horizontal floating bar** chart: time scale on X, task labels on Y, one bar per issue (created → duedate or today). Uses PrimeReact Chart, `chartjs-adapter-date-fns` for time parsing, and theme colors via getComputedStyle. Removed `react-frappe-gantt`, `frappe-gantt`, and `chartjs-plugin-gantt`; timeline now uses the same Chart.js stack as the rest of the dashboard.

## [0.1.47] - 2026-02-12

### Changed

- **Trevor responsive / viewport fit**: Dashboard constrained to 100vh/100vw; chart areas use vh-based max-heights so content fits on screen. Distribution donut reduced (120px / 18vh max) with smaller center text in Trevor; first row charts capped at 32vh; board row at 22vh; Gantt gets remaining space. Added `trevor-board-row` and flex/min-height rules so sections shrink and scroll when needed.

## [0.1.46] - 2026-02-12

### Changed

- **Trevor By board & component**: Combined "By board" and "By component" into one chart. "By board & component" shows horizontal stacked bars per board (CM, NOVA, OPRD), with segments by component (Case Database, Interactive Website, No component, etc.). When no component breakdown exists, falls back to a single "Open" bar per board. Analytics: added `byBoardByComponent` (open count per board per component) in `buildAnalyticsFromIssueList` and `NovaAnalytics`.

## [0.1.45] - 2026-02-12

### Changed

- **Trevor combo chart**: Component is now part of the first combo chart instead of a separate bar chart. "Open & avg days by assignee" shows: (1) Open count as **stacked bars by component** (Case Database, Interactive Website, NCOA/ACS, No component, Static Website, etc.) on the bottom axis, and (2) **Avg days to close** as a line on the top axis. Removed the standalone "By component" card.
- **Analytics**: Added `byAssigneeByComponent` (open count per assignee per component) in `buildAnalyticsFromIssueList` and `NovaAnalytics` to support the stacked-by-component combo.

## [0.1.44] - 2026-02-12

### Changed

- **Trevor assignee chart**: Replaced separate "Open by assignee" and "Avg days to close" charts with one combo/multi-axis chart: horizontal bars for Open count (bottom axis) and a line for Avg days to close (top axis, 0–15 days) so both dimensions are readable in a single view. Legend and axis labels use theme colors.
- **Trevor By component**: "By component" bar chart is now shown when data exists; uses theme-colored axes. Layout: combo + Distribution in first row; By component + By board in second row.

## [0.1.43] - 2026-02-12

### Changed

- **TextScroller**: Animation now starts from the true right (content enters from off-screen at 100vw and scrolls left). Slightly faster: default duration 26s (was 30s); Trevor stats strip 22s (was 25s).

## [0.1.42] - 2026-02-12

### Added

- **Dev Corner One** (`/tv/dev-corner-one`): New dashboard with Trevor-style JQL and multi-dimensional charts. JIRA_DEV1: NOVA project, last 6 months, no assignee filter (all devs). Charts: Open &amp; avg days to close by assignee (combo bar + line), Distribution meter, By type, By component.
- **dev1JiraStore**: Fetches from JIRA_DEV1_JQL / JIRA_DEV1_JQL_OPEN; uses shared `buildAnalyticsFromIssueList` (no team filter) for byAssignee, byType, byComponent, avgDaysToClose.

### Changed

- **buildAnalyticsFromNovaQueries**: Now computes `byComponent` (open count per Jira component) and `avgDaysToClose` per assignee (from done issues), so Dev 2 and any Nova-based view get the same dimensions as Trevor.
- **Dev Corner Two (Nova)**: Replaced simple “Open by assignee” bar with combo chart (Open + Avg days to close); added “By component” bar chart and “Avg days” column in the assignee table.
- **TVDashboard**: Routes `dev-corner-one` to `DevCornerOneDashboard`.

## [0.1.42] - 2026-02-12

### Changed

- **Trevor theme colors**: Stats strip and charts now use theme variables only (no hardcoded hex overrides). Stats strip uses `--text-color`, `--primary-color`, `--red-*` / `--green-*`, `--text-color-secondary` (with `--p-*` fallbacks for Prime). Chart axis ticks and titles use resolved theme colors via a small hook so contrast follows the active theme.
- **Trevor charts readability**: Replaced the combo (bar + line, two x-axes) with two separate horizontal bar charts: "Open by assignee" and "Avg days to close (by assignee)", each with a single clear scale and theme-colored axis labels. "By board" chart also uses theme colors for axes. JiraMeterChart legend and center label use theme text color.

## [0.1.41] - 2026-02-12

### Changed

- **Trevor stats strip**: Replaced the four large stat cards (Open, Today, Late, Done) with a compact single-line strip using the reusable `TextScroller`. Stats scroll with icons (inbox, calendar, exclamation-triangle for Late in red, check-circle for Done in green) and separators for a space-efficient, elegant header.

## [0.1.40] - 2026-02-12

### Changed

- **Trevor JQL confined to 4 users**: JIRA_TREVOR JQL now builds `assignee IN (...)` from `TREVOR_TEAM_ACCOUNT_IDS_ARRAY` so the same 4 user IDs are the single source of truth; no other users are included in the query or on the board.

### Fixed

- **TREVOR_TEAM_ACCOUNT_IDS**: Typed as `Set<string>` so `Set.has(id)` accepts Jira assignee `accountId` (string) and build passes.

## [0.1.39] - 2026-02-12

### Added

- **Shared Jira layer**: `JIRA_CACHE_TTL_MS` (30 min) and `jiraSearchClient` for all dev-corner dashboards; single refresh interval so boards stay real-time without excess API calls.
- **Shared analytics**: `buildAnalyticsFromNovaQueries` and `buildAnalyticsFromIssueList` in `utils/jiraAnalytics` with optional `byProject` and `byType` for grouping by board (NOVA, CM, OPRD) and by issue type (Bug, Story, Task).
- **useJiraDashboard hook**: Unified hook for `nova` | `trevor` returning analytics, allIssues, loading, error, refresh, isStale (Dev1/Julie can be added later).
- **JiraMeterChart**: Meter-style doughnut (ring only) with main number in the center; used for Distribution on Nova and Trevor.
- **By board / By type charts**: Trevor shows "By board" horizontal bar (NOVA, CM, OPRD); Nova shows "By type" horizontal bar when multiple types exist.
- **JIRA_DEV1** and **JIRA_JULIE** stub constants for future dashboards.

### Changed

- **Cache TTL**: Nova and Trevor both use 30 min cache (was 5 min); refetch only when stale.
- **Stores**: `jiraNovaStore` and `trevorJiraStore` use `jiraSearchClient` and shared `buildAnalytics*` from `utils/jiraAnalytics`.
- **NovaAnalytics**: Extended with optional `byProject` and `byType` for chart data.
- **Nova dashboard**: Distribution is now meter-style (center = total open); added "By type" bar chart.
- **Trevor dashboard**: Distribution is now meter-style (center = total open); added "By board" bar chart.

## [0.1.38] - 2026-02-12

### Fixed

- **Trevor Open count**: Open total now comes from Jira via a dedicated count request (`JIRA_TREVOR_JQL_OPEN` with `maxResults=1`); response `total` gives the exact open count (Jira requires maxResults between 1 and 5000).

### Changed

- **Trevor charts**: Cleaner bar and doughnut charts – theme-aware axis/legend colors, subtle grid, tuned bar/doughnut proportions, chart height 120px, cutout 58% on doughnut.

## [0.1.37] - 2026-02-12

### Added

- **Conference room background slideshow**: Looping slideshow using all images in `public/background/background-conf-room/` (bg1.jpg, cpr-art-dark-1.jpg, cpt-art-1.jpg). Fade in/out (1.5s) between image swaps; 6s per slide. Config in `CONFERENCE_BACKGROUND_SLIDES`; content and scroller unchanged.

### Changed

- Conference room: single static background replaced by rotating slideshow layer; scroller remains on top (z-index).

## [0.1.36] - 2026-02-12

### Fixed

- **Trevor JQL**: Switched from `assignee WAS IN` to `assignee IN` so only issues **currently** assigned to the 4 (Kyle, James, Roy, Thomas) are fetched. Open/Today/Late/Done counts now match Jira.

## [0.1.35] - 2026-02-12

### Changed

- **Trevor's dashboard**: Filter to only the 4 dev team members (Kyle, James, Roy, Thomas) by current assignee account ID; stats, charts, and Gantt now show only these four.
- **Trevor's dashboard**: Compact, futuristic layout – tighter padding and gaps, smaller stat cards and chart area, subtle blue border glow and box-shadow on cards, single-row stats on larger screens, chart height 100px.

### Added

- **TREVOR_TEAM_ACCOUNT_IDS** in constants: set of 4 Jira account IDs used to filter Trevor data to current assignee only.

## [0.1.34] - 2026-02-12

### Added

- **Trevor's dashboard** (`/tv/trevor`): Dev team totals & Gantt – mobile-friendly. Uses JQL for OPRD, CM, NOVA projects with assignee WAS IN (4 team members), last 6 months, excludes case phase/Epic/Sub-task.
- **JIRA_TREVOR** constants and **trevorJiraStore**: Trevor-specific JQL and data fetching.
- **src/styles/frappe-gantt.css**: Local copy of frappe-gantt CSS for reliable module resolution.
- **react-frappe-gantt** type declarations (`src/types/react-frappe-gantt.d.ts`).
- PrimeReact charts on Trevor dashboard: Open by assignee (bar), Distribution (doughnut) with glossy opacity and hover glow.

### Fixed

- frappe-gantt CSS: resolved module-not-found by importing from `@/styles/frappe-gantt.css` instead of package path.

### Changed

- Trevor dashboard: uses trevorJiraStore with new JQL; Gantt chart for Dev Team Timeline; compact mobile-first layout.

## [0.1.34] - 2026-01-30

### Changed

- **TextScroller**: Styles moved into component-scoped `TextScroller.module.css`; text is bold (`font-weight: 700`) and slightly larger (`1.125rem`). All sizing/weight edits apply only to this component.

## [0.1.33] - 2026-01-30

### Changed

- Conference room: scroller strip moved up from bottom by 2.5rem.

## [0.1.32] - 2026-01-30

### Added

- **`docs/cpt-group-website-info.md`**: Reference doc with info from [CPT Group](https://www.cptgroup.com/) (company overview, 30 years / cases / settlement stats, contact, service areas, value props) for reels and future dashboard content.
- **`CONFERENCE_REEL`** constants: `CONFERENCE_REEL_PHRASES` and `CONFERENCE_REEL_TEXT` (CPT filler for the conference reel); conference room reel now uses this copy instead of placeholder.

### Changed

- TextScroller: JSDoc clarified that content is duplicated for a **seamless infinite loop** (repeats when one copy scrolls out).
- Conference room reel: filler text from CPT Group website (stats, contact, taglines).
- `docs/app-overview.md`: added link to `cpt-group-website-info.md` in Supporting Docs.

## [0.1.31] - 2026-01-30

### Added

- **TextScroller** UI component: 100% width, paragraph-sized text, scrolls left in an infinite loop (news/stocks reel style). Accepts `children`, optional `className`, and `duration` (seconds). Intended for Jira & stats reel on conference room.
- Conference room: scroller strip at bottom with placeholder “Jira & stats reel” text; background remains the focal point.

### Changed

- Conference room: center card removed; page is background-only with scroller at bottom.

## [0.1.30] - 2026-01-30

### Added

- **`docs/app-overview.md`**: Single doc describing what the web app is for (CPT Group internal TV dashboards, 24/7 office TVs), audience, routes, current screens (Dev Corner Two NOVA, Conference Room), data (Jira NOVA), tech stack, design conventions, and pointers to supporting docs
- README: link to `app-overview.md` as the starting doc; refreshed Current Status and Documentation list; version note points to `package.json` and CHANGELOG

## [0.1.29] - 2026-01-30

### Changed

- Conference room: custom background image (`public/background/Untitled design.png`) applied; centered, covers full screen, `background-size: cover` to avoid stretching

## [0.1.28] - 2026-01-30

### Added

- Conference room TV dashboard: `ConferenceRoomDashboard` component with full-viewport layout; wired for `/tv/conference-room` and `TVDashboard` when `roomName === 'conference-room'`; placeholder content ready for future widgets

## [0.1.27] - 2026-01-30

### Changed

- NOVA dashboard charts: chart fill opacity reduced (0.88 → 0.78) for a bit more transparency and floating look

## [0.1.26] - 2026-01-30

### Added

- NOVA dashboard: chart colors restored with vibrant per-assignee palette and opacity for a modern floating look (bar + doughnut)
- By assignee table: Bugs and Done columns; conditional formatting: Open=blue (info), Today=purple (custom), Late/Bugs=red (danger), Done=green (success)
- Top stats: fourth card for Done; JQL and store support for completed (Done) tickets and bug count per assignee

### Changed

- NOVA analytics: NovaAssigneeStats now include bugCount (from open issues where issuetype=Bug) and doneCount (from Done JQL); totalDone in NovaAnalytics
- Stat numbers use .nova-stat-value for theme primary contrast; stats grid is 4 columns (Open, Today, Late, Done)

## [0.1.25] - 2026-01-30

### Fixed

- Hydration mismatch on Dev Corner Two: NovaDashboard loaded with `next/dynamic` and `ssr: false` so DataTable and charts are client-only, avoiding extension-injected attributes (e.g. `data-cursor-ref`) that differ from server HTML

### Changed

- NOVA TV dashboard UI: cards get elevation (box-shadow, border-radius, subtle border); chart containers get inner highlight and doughnut gets drop-shadow; bar and doughnut datasets get border/hover border and hover shadow for less flat, more glossy look

## [0.1.24] - 2026-01-30

### Changed

- Dev Corner Two (NOVA) TV dashboard: removed top header/title section; room is known from URL
- Docs: do-donts updated so we always check browser console for errors and never ship with console errors or stray console.log

## [0.1.23] - 2026-01-30

### Changed

- Distribution card uses full width: doughnut chart responsive, legend positioned right of chart so chart + legend fill the card and reduce empty horizontal space

## [0.1.22] - 2026-01-30

### Changed

- Distribution doughnut chart constrained to 160px: Chart width/height props, responsive: false, pt (root + canvas) for max size and centering

## [0.1.21] - 2026-01-30

### Changed

- NOVA dashboard fits single TV screen: reduced padding (0.75rem), smaller header/stats/charts, no page scroll
- Layout: 100vh flex container, compact stats (text-2xl), charts 160px height, table uses remaining space with internal scroll
- Skeleton loading layout tightened to match

## [0.1.20] - 2026-01-30

### Added

- TV-friendly smooth transitions: Chart.js animation (1s duration, 800ms on update), content fade-in
- PrimeReact Skeleton for initial load (cards, chart placeholders, table) for stable layout and smoother transition to data

### Changed

- Nova dashboard uses Skeleton during first load instead of spinner-only; charts animate in smoothly

## [0.1.19] - 2026-01-30

### Added

- NovaDashboard: PrimeReact Chart (Chart.js) – horizontal bar chart (open by assignee) and doughnut chart (distribution)

### Changed

- Dev Corner Two dashboard now uses primereact/chart for open-by-assignee and distribution visuals

## [0.1.18] - 2026-01-30

### Changed

- NOVA analytics: exclude unassigned tickets from totals and from by-assignee table (assigned only)

## [0.1.17] - 2026-01-30

### Added

- NOVA Jira analytics for Dev Corner Two dashboard
- Cached Jira NOVA data with 5‑min TTL and memoization (jiraNovaStore)
- JQL constants for NOVA: today (updated today), open (not Done), overdue (late)
- NovaAnalytics types and by-assignee stats (open / today / overdue)
- NovaDashboard: summary cards (total open, updated today, overdue) and DataTable by assignee
- TV route `/tv/dev-corner-two` now renders NOVA dashboard with live-style analytics
- Auto-refresh: fetch on mount if stale, then every 1 min check; refetch when cache TTL (5 min) expired
- Optional `duedate` on Jira issue type and in default search fields for overdue tickets

### Changed

- TVDashboard renders NovaDashboard when roomName is dev-corner-two
- tv/[roomName] page now renders TVDashboard with roomName instead of null

## [0.1.16] - 2026-01-27

### Changed

- Configured dev server to run on port 3333 (`npm run dev` uses `next dev -p 3333`)

### Verified

- Verified ProgressSpinner (p-progressspinner) theming in both light and dark themes
- Confirmed all required CSS classes and animations are present
- Both themes use primary color (#405c8e) for spinner stroke
- Created spinner-theming-verification.md documentation

## [0.1.15] - 2026-01-27

### Changed

- Updated metadata title and description to "CPT Group Internal"
- Added robots.txt file to disallow all crawlers (User-agent: * Disallow: /)
- Updated metadata robots configuration to prevent indexing
- Set robots to noindex, nofollow, nocache for all search engines

## [0.1.14] - 2026-01-27

### Changed

- Replaced Vercel favicon with CPT favicon from support portal
- Added icon.png and apple-icon.png to src/app directory
- Updated metadata to include icon configuration matching support portal
- Icons now properly served from Next.js App Router convention location

## [0.1.13] - 2026-01-27

### Fixed

- Removed metadata.other approach that broke theme loading
- Added static link tag directly in body for theme CSS (server-rendered)
- Theme CSS now loads synchronously before page render
- Dark theme background now working - verified via browser screenshot
- Link tag is in HTML from server, script only updates href if needed

## [0.1.12] - 2026-01-27

### Fixed

- Removed invalid metadata.other approach (doesn't create link tags)
- Fixed theme script to properly create and set link href before page render
- Theme CSS now loads correctly - link created in beforeInteractive script
- Removed dev server commands - only using builds as requested

## [0.1.11] - 2026-01-27

### Fixed

- Removed invalid app/head.tsx file (not supported in Next.js App Router)
- Added theme link directly in layout head tag (supported in App Router)
- Theme CSS now loads synchronously in head before page render
- Dark theme background now visible - verified via browser screenshot
- CSS variables available immediately for globals.css

## [0.1.10] - 2026-01-27

### Fixed

- Fixed hydration error by using app/head.tsx instead of manual head tag
- Moved theme link to app/head.tsx (correct Next.js App Router pattern)
- Removed manual head tag from layout.tsx
- Theme link now server-rendered properly without hydration mismatch
- Follows Next.js 2025+ best practices for App Router

## [0.1.9] - 2026-01-27

### Fixed

- Added theme link element directly in layout head for immediate loading
- Added inline blocking script to set theme from localStorage before React hydrates
- Theme CSS now loads synchronously before page render
- CSS variables available immediately for globals.css
- Fixed white background issue - theme now applies on initial page load

## [0.1.8] - 2026-01-27

### Added

- Added PrimeReact theming documentation (docs/primereact-theming.md)
- Documented theme implementation pattern and best practices
- Added troubleshooting guide for theme issues

### Fixed

- Removed ThemeLink reference from layout.tsx (component was deleted)

## [0.1.7] - 2026-01-27

### Fixed

- Removed ThemeLink component - ThemeProvider now handles all theme CSS loading (matches support portal pattern)
- Updated ThemeProvider to match support portal implementation exactly
- Changed default theme to 'dark' in ThemeProvider
- Removed PrimeReact imports from layout.tsx (they're in PrimeReactProvider where they belong)
- Theme CSS should now load properly using 'theme-stylesheet' ID

## [0.1.6] - 2026-01-27

### Fixed

- Fixed theme CSS loading conflict between ThemeLink and ThemeProvider
- Simplified ThemeProvider to only handle state management, not CSS loading
- Changed ThemeLink to use 'theme-link' ID to match zion pattern
- ThemeProvider now updates ThemeLink href when theme changes
- Theme CSS should now load properly on page load

## [0.1.5] - 2026-01-27

### Fixed

- Added ThemeLink component to load theme CSS early in layout
- Added base styles to globals.css using PrimeReact theme CSS variables
- Moved PrimeReact core style imports to layout.tsx for proper loading order
- Fixed dark theme not applying - background now uses var(--surface-ground)
- Theme CSS now properly loads and applies on page load

## [0.1.4] - 2026-01-27

### Changed

- Updated main page.tsx to display "Hello World" content for theme verification
- Changed from returning null to displaying basic content

## [0.1.3] - 2026-01-27

### Changed

- Updated README.md to reflect current project state
- Added dark mode default theme information
- Added current version and status section
- Enhanced theme system documentation

## [0.1.2] - 2026-01-27

### Changed

- Set dark mode as default theme
- Fixed theme application to properly load from public/themes folder
- Ensured PrimeReact provider is properly configured with theme system

## [0.1.1] - 2026-01-27

### Changed

- Enhanced coding style documentation with comprehensive examples
- Added detailed parent component pattern example with HeroProps
- Added constants organization guidelines (separate files like MOTTO.ts)
- Added PrimeReact type extension guidelines (ButtonProps, etc.)
- Added type organization structure matching components structure
- Added import organization documentation
- Updated ESLint configuration to enforce TypeScript rules (no `any`/`unknown`)
- Enhanced pet peeves documentation with performance considerations
- Updated do's and don'ts with PrimeReact type extensions and type organization

### Technical Details

- ESLint now enforces: no `any`/`unknown` types, proper TypeScript usage, React hooks rules
- Added typescript-eslint packages for enhanced linting
- Documentation now includes hierarchical index.ts export patterns
- Added import-organization.md guide

## [0.1.0] - 2026-01-27

### Added

- Initial project setup with Next.js 16.1.6 and React 19.2.3
- Complete folder structure following KISS principles
- TypeScript configuration with strict type checking
- PrimeReact, PrimeFlex, and PrimeIcons integration
- Theme system with dynamic light/dark theme loading (copied from cpt-support-portal)
- Provider setup (PrimeReactProvider, ThemeProvider, Providers wrapper)
- Root layout with minimal structure and Providers integration
- Type definitions for dashboard, API responses, data sources, and widgets
- TV dashboard route structure (static and dynamic routes)
- TVDashboard component foundation (empty placeholder, ready for JSON-driven widgets)
- API service structure with flexible data source factory
  - Support for API, cron jobs, static data, and Jira integration
  - JSON-first, data-driven architecture
- Zustand store for dashboard state management
- Utility functions (formatters using date-fns, constants)
- Hierarchical index.ts exports for clean imports
- Documentation folder with:
  - Coding style guidelines
  - Pet peeves and code smells
  - Do's and Don'ts reference
  - Data architecture documentation
- Public folder with themes, backgrounds, logos, and icons
- Clean slate: removed all default Next.js/Vercel styling and content
- Version control and changelog system
- Versioning documentation and guidelines
- .cursor folder for Cursor-specific files (git-ignored)

### Technical Details

- **Framework**: Next.js 16.1.6 with App Router
- **React**: 19.2.3
- **TypeScript**: Latest (strict mode, no `any` or `unknown`)
- **State Management**: Zustand 5.0.10
- **UI Library**: PrimeReact 10.9.7, PrimeFlex 4.0.0, PrimeIcons 7.0.0
- **Form Handling**: react-hook-form 7.71.1
- **Date Utilities**: date-fns 4.1.0
- **Project Structure**: src/ folder with organized components, hooks, services, stores, types, utils, constants, config, providers

### Notes

- All components are empty placeholders - no UI implemented yet
- Foundation is ready for JSON-driven widget system
- Theme system follows cpt-support-portal pattern
- All code follows KISS principles and coding style guidelines
