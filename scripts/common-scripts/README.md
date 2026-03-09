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

### check-work-hours-today.ps1

Reads credentials from `.env.local`, queries Jira for issues with worklogs today, then sums hours per developer.

**JQL used:**
```
worklogDate >= startOfDay()
AND worklogAuthor in ("712020:a6b...", "712020:4a6...", "712020:7d1...", "712020:025...")
AND project in (CM, OPRD, NOVA)
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/common-scripts/check-work-hours-today.ps1
```
