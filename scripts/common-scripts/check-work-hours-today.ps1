# ─────────────────────────────────────────────────────────────────────
# Check Work Hours Today — fetches Jira worklogs for NOVA core devs
# ─────────────────────────────────────────────────────────────────────
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/common-scripts/check-work-hours-today.ps1
#
# Reads .env.local for KYLE_EMAIL and KYLE_JIRA_TOKEN.
# JQL: worklogDate >= startOfDay() AND worklogAuthor in (...) AND project in (CM, OPRD, NOVA)
# Then fetches each issue's worklogs and sums timeSpentSeconds per author for today (Pacific).
# ─────────────────────────────────────────────────────────────────────

$envFile = Join-Path $PSScriptRoot "..\..\..\.env.local"
if (-not (Test-Path $envFile)) {
  $envFile = Join-Path $PSScriptRoot "..\..\.env.local"
}

$email = $null
$token = $null
foreach ($line in (Get-Content $envFile)) {
  if ($line -match "^KYLE_EMAIL=(.+)$") { $email = $matches[1].Trim() }
  if ($line -match "^KYLE_JIRA_TOKEN=(.+)$") { $token = $matches[1].Trim() }
}

if (-not $email -or -not $token) {
  Write-Host "ERROR: Could not read KYLE_EMAIL or KYLE_JIRA_TOKEN from .env.local"
  exit 1
}

$auth = "${email}:${token}"
$base = "https://cptgroup.atlassian.net"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($auth)
$b64 = [Convert]::ToBase64String($bytes)
$headers = @{ Authorization = "Basic $b64"; "Content-Type" = "application/json" }

# NOVA core dev account IDs (Kyle, James, Roy, Thomas)
$devIds = @{
  "712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f" = "Roy"
  "712020:4a657f3c-6d1e-41be-88fc-e168a5e75cbd" = "Thomas"
  "712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837" = "Kyle"
  "712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef" = "James"
}

$accountList = ($devIds.Keys | ForEach-Object { "`"$_`"" }) -join ","

# Step 1: Find issues with worklogs today via POST /search/jql
$jql = "worklogDate >= startOfDay() AND worklogAuthor in ($accountList) AND project in (CM, OPRD, NOVA)"
$body = @{ jql = $jql; fields = @("key") } | ConvertTo-Json -Depth 5
$resp = Invoke-RestMethod -Uri "$base/rest/api/3/search/jql" -Headers $headers -Method Post -Body $body

$keys = $resp.issues | ForEach-Object { $_.key }
Write-Host "Found $($keys.Count) issues with worklogs today"

# Step 2: Fetch worklogs for each issue and sum by author
$totals = @{}
foreach ($name in $devIds.Values) { $totals[$name] = 0 }

$today = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId(
  [DateTime]::UtcNow, "Pacific Standard Time"
).ToString("yyyy-MM-dd")

foreach ($key in $keys) {
  try {
    $url = "$base/rest/api/3/issue/$key/worklog"
    $wlResp = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    foreach ($wl in $wlResp.worklogs) {
      $authorId = $wl.author.accountId
      if ($devIds.ContainsKey($authorId) -and $wl.started -match "^$today") {
        $totals[$devIds[$authorId]] += $wl.timeSpentSeconds
      }
    }
  } catch {
    Write-Host "WARN: Failed to fetch worklogs for $key"
  }
}

Write-Host ""
Write-Host "=== Work Hours Today (Pacific: $today) ==="
foreach ($name in ($totals.Keys | Sort-Object)) {
  $hrs = [math]::Round($totals[$name] / 3600, 1)
  Write-Host "$name : $hrs hr ($($totals[$name]) sec)"
}
