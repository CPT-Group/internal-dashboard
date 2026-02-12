/**
 * Trevor's dashboard: Jira display names for the development team.
 * Used to filter NOVA analytics and Gantt chart to this subset.
 *
 * @see Jira assignee displayName - may need adjustment if Jira uses different names
 * (e.g. "royr" might be username; display name could be "Roy R" or similar)
 */
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
