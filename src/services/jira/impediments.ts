import type { JiraIssue } from '@/types'
import { JIRA_FLAGGED_IMPEDIMENT_VALUE } from '@/constants'

const MAX_CACHE_KEYS = 500
const sentFlagNotifications = new Set<string>()
const TRACKED_PROJECT_KEYS = new Set(['NOVA'])

function isDone(issue: JiraIssue): boolean {
  return issue.fields?.status?.statusCategory?.key === 'done'
}

function isImpedimentFlagged(issue: JiraIssue): boolean {
  const flags = issue.fields?.customfield_10021 ?? []
  return flags.some((flag) => flag.value === JIRA_FLAGGED_IMPEDIMENT_VALUE)
}

function isTrackedProject(projectKey: string): boolean {
  return TRACKED_PROJECT_KEYS.has(projectKey)
}

function shouldNotifyForIssue(issue: JiraIssue): boolean {
  if (isDone(issue) || !isImpedimentFlagged(issue)) {
    return false
  }
  const projectKey = issue.fields?.project?.key ?? ''
  return isTrackedProject(projectKey)
}

function toIssueUrl(issueKey: string): string {
  const baseUrl = process.env.JIRA_BASE_URL?.trim() ?? 'https://cptgroup.atlassian.net'
  return `${baseUrl.replace(/\/$/, '')}/browse/${issueKey}`
}

function toReason(issue: JiraIssue): string {
  const flags = issue.fields?.customfield_10021 ?? []
  const match = flags.find((flag) => flag.value === JIRA_FLAGGED_IMPEDIMENT_VALUE)
  return match?.value ?? JIRA_FLAGGED_IMPEDIMENT_VALUE
}

function toDedupKey(issue: JiraIssue): string {
  const issueKey = issue.key
  const updated = issue.fields?.updated ?? issue.fields?.created ?? 'unknown'
  const reason = toReason(issue)
  return `${issueKey}::${updated}::${reason}`
}

function trimCache(): void {
  if (sentFlagNotifications.size <= MAX_CACHE_KEYS) {
    return
  }
  const keys = Array.from(sentFlagNotifications.values())
  const overflow = sentFlagNotifications.size - MAX_CACHE_KEYS
  for (let index = 0; index < overflow; index += 1) {
    const key = keys[index]
    if (key) {
      sentFlagNotifications.delete(key)
    }
  }
}

async function postTeamsMessage(text: string): Promise<boolean> {
  const url = process.env.JIRA_IMPEDIMENTS_TEAMS_WEBHOOK_URL?.trim()
  if (!url?.startsWith('http')) {
    return false
  }
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 4000) }),
    })
    return true
  } catch {
    return false
  }
}

function formatTeamsMessage(issue: JiraIssue): string {
  const issueKey = issue.key
  const summary = issue.fields?.summary ?? '(no summary)'
  const status = issue.fields?.status?.name ?? 'Unknown'
  const reason = toReason(issue)
  const url = toIssueUrl(issueKey)
  return [
    '🚩 Jira impediment flagged',
    `Ticket: [${issueKey}](${url})`,
    `Summary: ${summary}`,
    `Status: ${status}`,
    `Flag message: ${reason}`,
  ].join('\n')
}

export async function notifyImpedimentFlaggedTeamsIfNeeded(issues: JiraIssue[]): Promise<void> {
  if (issues.length === 0) {
    return
  }

  for (const issue of issues) {
    if (!shouldNotifyForIssue(issue)) {
      continue
    }
    const dedupKey = toDedupKey(issue)
    if (sentFlagNotifications.has(dedupKey)) {
      continue
    }
    const sent = await postTeamsMessage(formatTeamsMessage(issue))
    if (sent) {
      sentFlagNotifications.add(dedupKey)
      trimCache()
    }
  }
}
