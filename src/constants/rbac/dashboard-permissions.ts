/**
 * Dashboard permission catalog mirror (NOVA-3131 / AP-016).
 * Business authority: NOVA-3131 authorization-antipattern audit follow-up.
 * Entra App Role values MUST match approved-entra-app-roles.yml.
 */

export const DASHBOARD_CURSOR_ANALYTICS_VIEW = 'dashboard.cursorAnalytics.view' as const;

export type DashboardPermissionId = typeof DASHBOARD_CURSOR_ANALYTICS_VIEW;

export const DASHBOARD_PERMISSION_IDS = [DASHBOARD_CURSOR_ANALYTICS_VIEW] as const;

export type DashboardRoleKey =
  | 'developer'
  | 'manager'
  | 'scrumMaster'
  | 'sysAdmin'
  | 'executive';

export const ENTRA_APP_ROLE_BY_DASHBOARD_KEY: Record<DashboardRoleKey, string> = {
  developer: 'InternalTools.Developer',
  manager: 'InternalTools.Manager',
  scrumMaster: 'InternalTools.ScrumMaster',
  sysAdmin: 'InternalTools.SysAdmin',
  executive: 'InternalTools.Executive',
};

export const DASHBOARD_ROLE_KEY_BY_ENTRA_APP_ROLE: Record<string, DashboardRoleKey> = Object.fromEntries(
  Object.entries(ENTRA_APP_ROLE_BY_DASHBOARD_KEY).map(([key, value]) => [value, key as DashboardRoleKey]),
) as Record<string, DashboardRoleKey>;

const CURSOR_ANALYTICS_VIEWERS: readonly DashboardRoleKey[] = [
  'developer',
  'manager',
  'scrumMaster',
  'sysAdmin',
  'executive',
];

export const DASHBOARD_PERMISSION_GRANTS: Record<DashboardPermissionId, readonly DashboardRoleKey[]> = {
  [DASHBOARD_CURSOR_ANALYTICS_VIEW]: CURSOR_ANALYTICS_VIEWERS,
};

/** Union of permissions granted by the caller's Entra App Roles (deny-by-default). */
export function permissionsForDashboardEntraRoles(entraRoles: readonly string[]): Set<DashboardPermissionId> {
  const granted = new Set<DashboardPermissionId>();
  const roleKeys = entraRoles
    .map((r) => DASHBOARD_ROLE_KEY_BY_ENTRA_APP_ROLE[r])
    .filter((k): k is DashboardRoleKey => k !== undefined);
  if (roleKeys.length === 0) return granted;

  for (const id of DASHBOARD_PERMISSION_IDS) {
    const grantedTo = DASHBOARD_PERMISSION_GRANTS[id];
    if (roleKeys.some((k) => grantedTo.includes(k))) {
      granted.add(id);
    }
  }
  return granted;
}

export function hasDashboardPermission(
  entraRoles: readonly string[],
  permissionId: DashboardPermissionId,
): boolean {
  return permissionsForDashboardEntraRoles(entraRoles).has(permissionId);
}
