# ─────────────────────────────────────────────────────────────────────
# Check Work Hours for Sprint (or any date range) — CM, OPRD, NOVA
# ─────────────────────────────────────────────────────────────────────
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/common-scripts/check-work-hours-sprint.ps1
#
# Reads .env.local for KYLE_EMAIL and KYLE_JIRA_TOKEN.
# JQL: worklogDate >= StartDate AND worklogDate <= EndDate AND worklogAuthor in (...) AND project in (CM, OPRD, NOVA)
# Fetches each issue's worklogs and sums timeSpentSeconds per author in the range.
#
# Reads KYLE_EMAIL and KYLE_JIRA_TOKEN from .env.jira.temp (repo root), then .env.local if missing.
# CONFIG: Update the two dates below for the sprint or period you want.
# NOVA sprints are 2 weeks, starting Tuesday. Example: Sprint 9 = Feb 18 - Mar 3.
# ─────────────────────────────────────────────────────────────────────

# === CONFIG: Set date range (YYYY-MM-DD). Update for next sprint or custom period. ===
$StartDate = "2025-02-18"   # Sprint 9 start (Tuesday)
$EndDate   = "2025-03-03"   # Sprint 9 end (2 weeks inclusive)

# ─────────────────────────────────────────────────────────────────────

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$envFile = Join-Path $root ".env.jira.temp"
if (-not (Test-Path $envFile)) { $envFile = Join-Path $root ".env.local" }

$email = $null
$token = $null
foreach ($line in (Get-Content $envFile)) {
  if ($line -match "^KYLE_EMAIL=(.+)$") { $email = $matches[1].Trim() }
  if ($line -match "^KYLE_JIRA_TOKEN=(.+)$") { $token = $matches[1].Trim() }
}

if (-not $email -or -not $token) {
  Write-Host "ERROR: Could not read KYLE_EMAIL or KYLE_JIRA_TOKEN from .env.jira.temp or .env.local"
  exit 1
}

$auth = "${email}:${token}"
$base = "https://cptgroup.atlassian.net"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($auth)
$b64 = [Convert]::ToBase64String($bytes)
$headers = @{ Authorization = "Basic $b64"; "Content-Type" = "application/json" }

# All 6 NOVA team (same account IDs as NOVA_TEAM)
$devIds = @{
  "712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f" = "Roy"
  "712020:4a657f3c-6d1e-41be-88fc-e168a5e75cbd" = "Thomas"
  "712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837" = "Kyle"
  "712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef" = "James"
  "712020:384111d1-8f9d-4155-8420-37ff1888d6c3" = "Brandon"
  "712020:47cb6286-8794-44bf-bcb8-6ca1b6aadb79" = "Carlos"
}

$accountList = ($devIds.Keys | ForEach-Object { "`"$_`"" }) -join ","

# Find issues with worklogs in range via POST /search/jql
$jql = "worklogDate >= `"$StartDate`" AND worklogDate <= `"$EndDate`" AND worklogAuthor in ($accountList) AND project in (CM, OPRD, NOVA)"
$body = @{ jql = $jql; fields = @("key") } | ConvertTo-Json -Depth 5
$resp = Invoke-RestMethod -Uri "$base/rest/api/3/search/jql" -Headers $headers -Method Post -Body $body

$keys = $resp.issues | ForEach-Object { $_.key }
Write-Host "Found $($keys.Count) issues with worklogs in range $StartDate to $EndDate"

$totals = @{}
foreach ($name in $devIds.Values) { $totals[$name] = 0 }

$startDt = [DateTime]::ParseExact($StartDate, "yyyy-MM-dd", $null)
$endDt = [DateTime]::ParseExact($EndDate, "yyyy-MM-dd", $null)

foreach ($key in $keys) {
  try {
    $url = "$base/rest/api/3/issue/$key/worklog"
    $wlResp = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    foreach ($wl in $wlResp.worklogs) {
      $authorId = $wl.author.accountId
      if (-not $devIds.ContainsKey($authorId)) { continue }
      # worklog.started is ISO8601; parse and check date is within range (inclusive)
      $wlDate = [DateTime]::Parse($wl.started).Date
      if ($wlDate -ge $startDt -and $wlDate -le $endDt) {
        $totals[$devIds[$authorId]] += $wl.timeSpentSeconds
      }
    }
  } catch {
    Write-Host "WARN: Failed to fetch worklogs for $key"
  }
}

Write-Host ""
Write-Host "=== Work Hours $StartDate to $EndDate (Sprint / period) ==="
foreach ($name in ($totals.Keys | Sort-Object)) {
  $hrs = [math]::Round($totals[$name] / 3600, 2)
  Write-Host "$name : $hrs hr ($($totals[$name]) sec)"
}
$grandTotal = ($totals.Values | Measure-Object -Sum).Sum
Write-Host "---"
Write-Host "Total : $([math]::Round($grandTotal / 3600, 2)) hr"
