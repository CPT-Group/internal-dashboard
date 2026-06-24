/**
 * Pure tests for dashboard.cursorAnalytics.view permission resolution (NOVA-3131).
 * Run: npm run test:cursor-analytics-auth
 */

import assert from 'node:assert/strict';

import {
  DASHBOARD_CURSOR_ANALYTICS_VIEW,
  ENTRA_APP_ROLE_BY_DASHBOARD_KEY,
  hasDashboardPermission,
  permissionsForDashboardEntraRoles,
} from '../src/constants/rbac/dashboard-permissions';

function test(name: string, fn: () => void): void {
  fn();
  console.log(`ok ${name}`);
}

test('deny-by-default for unknown roles', () => {
  assert.equal(hasDashboardPermission(['InternalTools.Tax'], DASHBOARD_CURSOR_ANALYTICS_VIEW), false);
  assert.equal(permissionsForDashboardEntraRoles([]).size, 0);
});

test('developer role grants view', () => {
  assert.equal(
    hasDashboardPermission([ENTRA_APP_ROLE_BY_DASHBOARD_KEY.developer], DASHBOARD_CURSOR_ANALYTICS_VIEW),
    true,
  );
});

test('union across multiple roles', () => {
  const perms = permissionsForDashboardEntraRoles([
    ENTRA_APP_ROLE_BY_DASHBOARD_KEY.manager,
    'InternalTools.Tax',
  ]);
  assert.equal(perms.has(DASHBOARD_CURSOR_ANALYTICS_VIEW), true);
});

test('unknown InternalTools role outside allowlist mapping is ignored', () => {
  assert.equal(hasDashboardPermission(['InternalTools.NotARealRole'], DASHBOARD_CURSOR_ANALYTICS_VIEW), false);
});

console.log('All cursor analytics auth permission tests passed.');
