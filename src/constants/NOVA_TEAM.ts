/**
 * NOVA team — Nerds Of Vast Automation.
 * The dev team: Roy, Thomas, Kyle, James, Brandon, Carlos.
 * Single source of truth for the 6 Jira assignee account IDs.
 * Used for JQL (assignee IN ...) and client-side filtering.
 *
 * IMPORTANT: IDs were verified against Jira REST API (GET /rest/api/3/user?accountId=...)
 * on 2026-02-24. If names or IDs change, re-verify before updating.
 */
export const NOVA_TEAM_ACCOUNT_IDS_ARRAY = [
  '712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f', // royr (Roy)
  '712020:4a657f3c-6d1e-41be-88fc-e168a5e75cbd', // Thomas Williams
  '712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837', // Kyle Dilbeck
  '712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef', // James Cassidy
  '712020:384111d1-8f9d-4155-8420-37ff1888d6c3', // Brandon Fay
  '712020:47cb6286-8794-44bf-bcb8-6ca1b6aadb79', // Carlos
] as const;

export const NOVA_TEAM_ACCOUNT_IDS: Set<string> = new Set(NOVA_TEAM_ACCOUNT_IDS_ARRAY);

/** Display names for the team (must match NOVA_TEAM_ACCOUNT_IDS_ARRAY order). */
export const NOVA_TEAM_DISPLAY_NAMES = [
  'Roy',
  'Thomas Williams',
  'Kyle Dilbeck',
  'James Cassidy',
  'Brandon Fay',
  'Carlos',
] as const;

/** Ordered list of ALL team members (id + displayName) for charts so all 6 always show. */
export const NOVA_TEAM_ORDERED = NOVA_TEAM_ACCOUNT_IDS_ARRAY.map((id, i) => ({
  accountId: id,
  displayName: NOVA_TEAM_DISPLAY_NAMES[i],
})) as { accountId: string; displayName: string }[];

/**
 * Core developers shown on the Dev Corner One NOVA Team panel.
 * Excludes Brandon (scrum master) and Carlos for now — add them back
 * by uncommenting when they should appear on the dev-focused dashboard.
 */
export const NOVA_CORE_DEVS = NOVA_TEAM_ORDERED.filter(
  (m) => ![
    '712020:384111d1-8f9d-4155-8420-37ff1888d6c3', // Brandon Fay (scrum master)
    '712020:47cb6286-8794-44bf-bcb8-6ca1b6aadb79', // Carlos
  ].includes(m.accountId)
);

export type NovaTeamMember = (typeof NOVA_TEAM_DISPLAY_NAMES)[number];

/**
 * Alternative display names / usernames (e.g. Jira @mention format).
 * Add variants here if Jira uses different names.
 */
const NOVA_TEAM_ALIASES = ['royr', 'roy r'];

/** Case-insensitive check if display name belongs to the NOVA team. */
export function isNovaTeamMember(displayName: string): boolean {
  const normalized = displayName.trim();
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  if (NOVA_TEAM_ALIASES.includes(lower)) return true;
  return NOVA_TEAM_DISPLAY_NAMES.some(
    (name) => name.toLowerCase() === lower
  );
}
