/**
 * Trevor's dashboard: dev team = Kyle, James, Roy, Thomas only.
 * Single source of truth for the 4 Jira assignee account IDs.
 * Used for JQL (assignee IN ...) and client-side filtering so no other users are included.
 */
export const TREVOR_TEAM_ACCOUNT_IDS_ARRAY = [
  '712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f',
  '712020:4a657f3c-6d1e-41be-88fc-e168a5e75cbd',
  '712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837',
  '712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef',
] as const;

export const TREVOR_TEAM_ACCOUNT_IDS: Set<string> = new Set(TREVOR_TEAM_ACCOUNT_IDS_ARRAY);

/** Display names for the same 4 (Roy, James, Thomas, Kyle). */
export const TREVOR_TEAM_DISPLAY_NAMES = [
  'Roy R',
  'James Cassidy',
  'Thomas Williams',
  'Kyle Dilbeck',
] as const;

export type TrevorTeamMember = (typeof TREVOR_TEAM_DISPLAY_NAMES)[number];

/**
 * Alternative display names / usernames (e.g. Jira @mention format).
 * Add variants here if Jira uses different names.
 */
const TREVOR_TEAM_ALIASES = ['royr'];

/** Case-insensitive check if display name belongs to Trevor's team. */
export function isTrevorTeamMember(displayName: string): boolean {
  const normalized = displayName.trim();
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  if (TREVOR_TEAM_ALIASES.includes(lower)) return true;
  return TREVOR_TEAM_DISPLAY_NAMES.some(
    (name) => name.toLowerCase() === lower
  );
}
