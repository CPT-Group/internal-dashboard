# Inspect a NOVA subtask and its parent (and all sibling subtasks) for dev board visibility.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/common-scripts/inspect-nova-867.ps1 [SUBTASK_KEY] [PARENT_KEY]
# Default: NOVA-867 and NOVA-817. If you get 404, the issue may not exist or credentials may not have access.
#
# Dev board JQL requires: project = NOVA AND assignee IN (team) AND sprint in openSprints()
# Subtasks often have NO sprint set (only the parent story does), so they match the NOVA board
# but NOT the dev team board. Fix: set the Sprint field on each subtask to the same sprint as the parent.
# Reads KYLE_EMAIL and KYLE_JIRA_TOKEN from .env.jira.temp (repo root), then .env.local if missing.

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$envFile = Join-Path $root ".env.jira.temp"
if (-not (Test-Path $envFile)) { $envFile = Join-Path $root ".env.local" }
$email = $null; $token = $null
foreach ($line in (Get-Content $envFile)) {
  if ($line -match "^KYLE_EMAIL=(.+)$") { $email = $matches[1].Trim() }
  if ($line -match "^KYLE_JIRA_TOKEN=(.+)$") { $token = $matches[1].Trim() }
}
if (-not $email -or -not $token) { Write-Host "ERROR: Need KYLE_EMAIL and KYLE_JIRA_TOKEN in .env.jira.temp or .env.local"; exit 1 }

$b64 = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("${email}:${token}"))
$headers = @{ Authorization = "Basic $b64"; "Content-Type" = "application/json" }
$base = "https://cptgroup.atlassian.net"

function Get-Issue($key) {
  $uri = "$base/rest/api/3/issue/$key?fields=summary,issuetype,parent,assignee,components,sprint,status,project"
  try {
    Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
  } catch {
    Write-Host "Failed to get $key : $_"
    return $null
  }
}

function Get-Subtasks($parentKey) {
  $jql = "parent = $parentKey"
  $body = @{ jql = $jql; fields = @("summary","issuetype","assignee","components","sprint","status","project") } | ConvertTo-Json -Depth 5
  $r = Invoke-RestMethod -Uri "$base/rest/api/3/search/jql" -Headers $headers -Method Post -Body $body
  return $r.issues
}

Write-Host "=== NOVA-867 (subtask you see only on NOVA board) ==="
$n867 = Get-Issue "NOVA-867"
if ($n867) {
  $f = $n867.fields
  Write-Host "  Key: $($n867.key)"
  Write-Host "  Summary: $($f.summary)"
  Write-Host "  Issuetype: $($f.issuetype.name)"
  Write-Host "  Project: $($f.project.key)"
  Write-Host "  Assignee: $($f.assignee.displayName) (accountId: $($f.assignee.accountId))"
  Write-Host "  Status: $($f.status.name)"
  Write-Host "  Sprint: $(if ($f.sprint) { $f.sprint } else { '(none)' })"
  Write-Host "  Components: $(if ($f.components.Count) { ($f.components | ForEach-Object { $_.name }) -join ', ' } else { '(none)' })"
  Write-Host "  Parent: $($f.parent.key)"
}

Write-Host ""
Write-Host "=== NOVA-817 (parent) ==="
$n817 = Get-Issue "NOVA-817"
if ($n817) {
  $f = $n817.fields
  Write-Host "  Key: $($n817.key)"
  Write-Host "  Summary: $($f.summary)"
  Write-Host "  Issuetype: $($f.issuetype.name)"
  Write-Host "  Assignee: $($f.assignee.displayName)"
  Write-Host "  Sprint: $(if ($f.sprint) { $f.sprint } else { '(none)' })"
  Write-Host "  Components: $(if ($f.components.Count) { ($f.components | ForEach-Object { $_.name }) -join ', ' } else { '(none)' })"
}

Write-Host ""
Write-Host "=== All subtasks of NOVA-817 ==="
$subs = Get-Subtasks "NOVA-817"
foreach ($s in $subs) {
  $f = $s.fields
  Write-Host "  --- $($s.key) ---"
  Write-Host "    Summary: $($f.summary)"
  Write-Host "    Assignee: $($f.assignee.displayName)"
  Write-Host "    Sprint: $(if ($f.sprint) { $f.sprint } else { '(none) <- not on dev board' })"
  Write-Host "    Components: $(if ($f.components.Count) { ($f.components | ForEach-Object { $_.name }) -join ', ' } else { '(none)' })"
  Write-Host "    Status: $($f.status.name)"
}

Write-Host ""
Write-Host "Dev board filter requires: project = NOVA AND assignee IN (team) AND sprint in openSprints()"
Write-Host "If a subtask has no sprint set, it will NOT appear on the dev team board."
