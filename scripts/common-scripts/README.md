# Common Scripts

Reusable templates and scripts for Jira API interactions and development tasks.

## Jira Templates

These are ADF (Atlassian Document Format) JSON templates for Jira REST API v3. Copy and customize for each ticket.

| Template | Purpose | API Endpoint |
|----------|---------|-------------|
| `jira-comment-template.json` | Standard ticket comment | `POST /rest/api/3/issue/{KEY}/comment` |
| `jira-done-comment-template.json` | Completion comment with success panel | `POST /rest/api/3/issue/{KEY}/comment` |
| `jira-worklog-template.json` | Time tracking entry | `POST /rest/api/3/issue/{KEY}/worklog` |

### Usage

```bash
# Copy template, edit placeholders, then POST:
curl -X POST -H "Content-Type: application/json" \
  -u "email:token" \
  -d @scripts/common-scripts/jira-comment-template.json \
  "https://cptgroup.atlassian.net/rest/api/3/issue/NOVA-XXX/comment"
```

### Worklog template fields

- `timeSpentSeconds`: time in seconds (e.g. 900 = 15min, 3600 = 1hr)
- `started`: ISO timestamp with timezone offset (Pacific = `-0700` or `-0800` depending on DST)

## Scripts

| Script | Purpose |
|--------|---------|
| `check-work-hours-today.ps1` | Fetch and display today's work hours for all NOVA core devs |
| `check-work-hours-sprint.ps1` | Fetch and display work hours for a sprint or custom date range (CM, OPRD, NOVA) |

**Credentials:** All scripts read `KYLE_EMAIL` and `KYLE_JIRA_TOKEN` from **`.env.jira.temp`** in the repo root first, then fall back to **`.env.local`**. Use `.env.jira.temp` for Jira-only scripts (see Jira Workflow doc). Keep both files git-ignored.

### check-work-hours-sprint.ps1

Manually run to see time tracking for the **entire sprint** (or any date range). Uses the same Jira worklog API; sums by author for all 6 NOVA team members. NOVA sprints are 2 weeks starting Tuesday.

**Config (top of script):** Set `$StartDate` and `$EndDate` (YYYY-MM-DD). Example for Sprint 9: `2025-02-18` to `2025-03-03`. Update these for the next sprint or any custom period.

**JQL used:**
```
worklogDate >= "StartDate" AND worklogDate <= "EndDate"
AND worklogAuthor in (all 6 NOVA account IDs)
AND project in (CM, OPRD, NOVA)
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/common-scripts/check-work-hours-sprint.ps1
```

### check-work-hours-today.ps1

Reads credentials from `.env.jira.temp` (or `.env.local`), queries Jira for issues with worklogs today, then sums hours per developer.

**JQL used:**
```
worklogDate >= startOfDay()
AND worklogAuthor in ("712020:a6b...", "712020:4a6...", "712020:7d1...", "712020:025...")
AND project in (CM, OPRD, NOVA)
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/common-scripts/check-work-hours-today.ps1
```
