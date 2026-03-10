# Post comment and worklog to NOVA-848. Uses .env.jira.temp in repo root.
# Run from repo root: powershell -ExecutionPolicy Bypass -File scripts/post-jira-NOVA-848.ps1

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envFile = Join-Path $root ".env.jira.temp"
if (-not (Test-Path $envFile)) {
  Write-Host "ERROR: .env.jira.temp not found at $envFile"
  exit 1
}
$email = $null; $token = $null; $base = $null
foreach ($line in (Get-Content $envFile)) {
  if ($line -match "^KYLE_EMAIL=(.+)$") { $email = $matches[1].Trim() }
  if ($line -match "^KYLE_JIRA_TOKEN=(.+)$") { $token = $matches[1].Trim() }
  if ($line -match "^JIRA_BASE_URL=(.+)$") { $base = $matches[1].Trim() }
}
if (-not $email -or -not $token) { Write-Host "ERROR: KYLE_EMAIL and KYLE_JIRA_TOKEN required in .env.jira.temp"; exit 1 }
if (-not $base) { $base = "https://cptgroup.atlassian.net" }

$commentPath = Join-Path $root "scripts\jira-NOVA-848-comment.json"
$worklogPath = Join-Path $root "scripts\jira-NOVA-848-worklog.json"

Write-Host "Posting comment to NOVA-848..."
& curl.exe -s -X POST -H "Content-Type: application/json" -u "${email}:${token}" -d "@$commentPath" "$base/rest/api/3/issue/NOVA-848/comment"
Write-Host ""

Write-Host "Posting worklog to NOVA-848..."
& curl.exe -s -X POST -H "Content-Type: application/json" -u "${email}:${token}" -d "@$worklogPath" "$base/rest/api/3/issue/NOVA-848/worklog"
Write-Host "Done."
