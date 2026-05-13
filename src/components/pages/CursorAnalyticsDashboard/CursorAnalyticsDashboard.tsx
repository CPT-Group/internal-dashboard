'use client';

import { useMemo } from 'react';
import { KpiStrip } from '@/components/ui';
import type { KpiItem } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import styles from './CursorAnalyticsDashboard.module.scss';

/**
 * =============================================================================
 * CURSOR ANALYTICS (/cursor-analytics) — scaffold for the next implementation
 * =============================================================================
 *
 * KPI ROW
 * - Uses the same **`KpiStrip`** / **`KpiItem`** pattern as **Dev Corner One** (and Trevor):
 *   compact PrimeReact `Card` row via `src/components/ui/KpiStrip`.
 * - **First card**: `onActivate: cycleTheme` — invisible theme switcher (click / Enter / Space),
 *   same as Dev Corner One’s first KPI. Filler `label` / `value` until real metrics exist.
 *
 * PAGE SHELL
 * - All layout and future responsive rules live under **`CursorAnalyticsDashboard.module.scss`**
 *   (scoped to `.root`) so this route does not touch global TV / `main.scss` layout.
 *
 * ARCHITECTURE
 * - Prefer small **functional components** (no classes): one file per widget under this folder,
 *   each taking only typed props (no `any`; narrow at API boundaries per repo rules).
 *
 * ANALYTICS IDEAS (product — not implemented)
 * - Cost per developer, cost per repository, average cost per day, per-sprint rollups.
 * - Jira sprints (~2 weeks): `AGENTS.md`, `src/constants/JIRA_*`, `sprint in openSprints()`, `jiraService`.
 *
 * PRIMEREACT
 * - DataTable: https://primereact.org/datatable/
 * - Chart: https://primereact.org/chart/
 * - Card / Panel: https://primereact.org/card/ · https://primereact.org/panel/
 * - TabView: https://primereact.org/tabview/
 * - Calendar: https://primereact.org/calendar/
 * - Dropdown / MultiSelect: https://primereact.org/dropdown/ · https://primereact.org/multiselect/
 * - MeterGroup: https://primereact.org/metergroup/
 * - Skeleton: https://primereact.org/skeleton/
 * - Message / Toast: https://primereact.org/message/ · https://primereact.org/toast/
 *
 * EXISTING BACKEND (optional for future UI)
 * - `GET /api/cursor-analytics`, `kyleOutput/cursor-analytics-summary.json`, `CURSOR_ANALYTICS_SUMMARY_JSON`.
 * - Types: `src/types/cursorAnalytics.ts`, `src/utils/cursorAnalyticsSummary.ts`.
 */
export const CursorAnalyticsDashboard = () => {
  const { cycleTheme } = useTheme();

  /** Placeholder metrics — replace when wiring spend / Jira sprint / summary data. */
  const kpiItems: KpiItem[] = useMemo(
    () => [
      { label: 'Period', value: '—', onActivate: cycleTheme },
      { label: 'Avg / day', value: '—' },
      { label: 'Per repo', value: '—' },
      { label: 'Per dev', value: '—' },
      { label: 'Sprint', value: '—' },
      { label: 'Total', value: '—' },
    ],
    [cycleTheme]
  );

  return (
    <main className={styles.root} aria-label="Cursor analytics">
      <div className={styles.layout}>
        <div className={styles.kpiRow}>
          <KpiStrip items={kpiItems} />
        </div>
      </div>
    </main>
  );
};
