# ─────────────────────────────────────────────────────────────────────
# Transition all non-Done NOVA issues for a given assignee to Done.
# Uses James's Jira API token (JAMES_EMAIL + JAMES_JIRA_TOKEN) from .env.jira.temp or .env.local.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/common-scripts/transition-assignee-nova-to-done.ps1
#
# Default assignee: Thomas Williams (former dev). Override:
#   -AssigneeAccountId "712020:..."
# ─────────────────────────────────────────────────────────────────────

param(
  [string] $AssigneeAccountId = "712020:4a657f3c-6d1e-41be-88fc-e168a5e75cbd"
)

$ErrorActionPreference = "Stop"

# Repo root = internal-dashboard (two levels up from scripts/common-scripts)
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envFile = Join-Path $root ".env.jira.temp"
if (-not (Test-Path $envFile)) { $envFile = Join-Path $root ".env.local" }

$jamesEmail = $null
$jamesToken = $null
$base = $null

foreach ($line in (Get-Content $envFile)) {
  $t = $line.Trim()
  if ($t -match "^#" -or -not $t) { continue }
  if ($t -match "^JAMES_EMAIL=(.+)$") { $jamesEmail = ($matches[1] -replace '[\r\n]', '').Trim().Trim('"') }
  if ($t -match "^JAMES_JIRA_TOKEN=(.+)$") { $jamesToken = ($matches[1] -replace '[\r\n]', '').Trim().Trim('"') }
  if ($t -match "^JIRA_BASE_URL=(.+)$") { $base = ($matches[1] -replace '[\r\n]', '').Trim().Trim('"').TrimEnd('/') }
}

if (-not $jamesEmail -or -not $jamesToken) {
  Write-Host "ERROR: JAMES_EMAIL and JAMES_JIRA_TOKEN required in .env.jira.temp or .env.local"
  exit 1
}
if (-not $base) {
  Write-Host "ERROR: JIRA_BASE_URL is not set"
  exit 1
}

$auth = "${jamesEmail}:${jamesToken}"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($auth)
$b64 = [Convert]::ToBase64String($bytes)
# GET requests: do not send Content-Type (some Jira endpoints return 404 if Content-Type is set on GET)
$headersGet = @{
  Authorization = "Basic $b64"
  Accept        = "application/json"
}
$headersPost = @{
  Authorization = "Basic $b64"
  "Content-Type" = "application/json"
  Accept         = "application/json"
}

$jql = "project = NOVA AND assignee = `"$AssigneeAccountId`" AND statusCategory != Done ORDER BY key ASC"

function Get-AllIssueKeys {
  $keys = [System.Collections.Generic.List[string]]::new()
  $nextPageToken = $null
  do {
    $body = @{
      jql         = $jql
      fields      = @("key", "summary", "status")
      maxResults  = 100
    }
    if ($nextPageToken) { $body.nextPageToken = $nextPageToken }
    $json = $body | ConvertTo-Json -Depth 6 -Compress
    $resp = Invoke-RestMethod -Uri "$base/rest/api/3/search/jql" -Headers $headersPost -Method Post -Body $json
    foreach ($iss in $resp.issues) {
      $k = if ($iss.key) { $iss.key.ToString().Trim() } else { '' }
      if ($k) { [void]$keys.Add($k) }
    }
    $nextPageToken = $resp.nextPageToken
    $isLast = $resp.isLast
  } while (-not $isLast -and $nextPageToken)
  return $keys
}

function Invoke-TransitionStep {
  param([string] $IssueKey)
  $IssueKey = $IssueKey.Trim()
  $trResp = Invoke-RestMethod -Uri ("$base/rest/api/3/issue/$IssueKey/transitions") -Headers $headersGet -Method Get
  $toDone = $trResp.transitions | Where-Object { $_.to.statusCategory.key -eq 'done' }
  if ($toDone) {
    return @{ Id = $toDone[0].id; Name = $toDone[0].name; ToStatus = $toDone[0].to.name; IsDone = $true }
  }
  $skipNames = @('cancel', 'revert', 'withdraw', 'on hold')
  $cand = $trResp.transitions | Where-Object {
    $n = $_.name.ToLower()
    $bad = $false
    foreach ($skipPat in $skipNames) { if ($n -match $skipPat) { $bad = $true } }
    -not $bad
  } | Select-Object -First 1
  if (-not $cand) { $cand = $trResp.transitions | Select-Object -First 1 }
  if (-not $cand) { return $null }
  return @{ Id = $cand.id; Name = $cand.name; ToStatus = $cand.to.name; IsDone = ($cand.to.statusCategory.key -eq 'done') }
}

function Move-IssueToDone {
  param([string] $IssueKey)
  $IssueKey = $IssueKey.Trim()
  $maxSteps = 20
  for ($stepIdx = 0; $stepIdx -lt $maxSteps; $stepIdx++) {
    # Use $($IssueKey) before ? — PowerShell parses $IssueKey?fields incorrectly otherwise
    $getUrl = "$base/rest/api/3/issue/$($IssueKey)?fields=key,status"
    $issue = Invoke-RestMethod -Uri $getUrl -Headers $headersGet -Method Get
    $cat = $issue.fields.status.statusCategory.key
    if ($cat -eq 'done') {
      Write-Host "  $IssueKey : already Done"
      return $true
    }
    $step = Invoke-TransitionStep -IssueKey $IssueKey
    if (-not $step) {
      Write-Host "  $IssueKey : ERROR no transitions available (status: $($issue.fields.status.name))"
      return $false
    }
    $payload = @{ transition = @{ id = $step.Id } } | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri ("$base/rest/api/3/issue/$IssueKey/transitions") -Headers $headersPost -Method Post -Body $payload | Out-Null
    Write-Host "  $IssueKey : $($step.Name) -> $($step.ToStatus)"
    if ($step.IsDone) { return $true }
  }
  Write-Host "  $IssueKey : ERROR exceeded max workflow steps"
  return $false
}

Write-Host "JQL: $jql"
Write-Host "Auth: JAMES_EMAIL (James Cassidy API user)"
$allKeys = Get-AllIssueKeys
Write-Host "Found $($allKeys.Count) issue(s) to process."
Write-Host ""

$ok = 0
$fail = 0
foreach ($k in $allKeys) {
  try {
    if (Move-IssueToDone -IssueKey $k) { $ok++ } else { $fail++ }
  } catch {
    Write-Host "  $k : EXCEPTION $($_.Exception.Message)"
    $fail++
  }
  Write-Host ""
}

Write-Host "Done. Success: $ok  Failed: $fail"
