'use client';

import { useRef } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';

import { formatUsdFromCents, formatUsdNumber } from '@/utils/cursorBillingFormat';
import type { DeveloperMoneyRangeRow } from '@/utils/cursorAnalyticsMonetaryJoin';

import styles from './CursorAnalyticsDashboard.module.scss';

function cycleSpendCell(row: DeveloperMoneyRangeRow) {
  return formatUsdFromCents(row.cycleSpendCents);
}

function cycleOverallCell(row: DeveloperMoneyRangeRow) {
  return formatUsdFromCents(row.cycleOverallCents);
}

function chargedRangeCell(row: DeveloperMoneyRangeRow) {
  return formatUsdFromCents(row.chargedRangeCents);
}

function usdPerUsageCell(row: DeveloperMoneyRangeRow) {
  if (row.chargedRangeCents <= 0 || row.usageReqsInRange <= 0) return '—';
  return formatUsdNumber(row.chargedRangeCents / 100 / row.usageReqsInRange);
}

function usdPerIncludedCell(row: DeveloperMoneyRangeRow) {
  if (row.chargedRangeCents <= 0 || row.includedReqsInRange <= 0) return '—';
  return formatUsdNumber(row.chargedRangeCents / 100 / row.includedReqsInRange);
}

export interface CursorAnalyticsMonetaryRangePanelProps {
  rows: DeveloperMoneyRangeRow[];
}

export const CursorAnalyticsMonetaryRangePanel = ({ rows }: CursorAnalyticsMonetaryRangePanelProps) => {
  const dtRef = useRef<DataTable<DeveloperMoneyRangeRow[]> | null>(null);

  return (
    <>
      <p className={styles.hint}>
        <strong>Monetary (selected range):</strong> joins <code>/teams/spend</code> (current <strong>cycle</strong> billed /
        overall per member) with <code>/teams/filtered-usage-events</code> <strong>charged cents summed for the date
        range</strong> and <code>/teams/daily-usage-data</code> <strong>usage + included request counts summed only on
        days inside the range</strong>. Use Cursor.com <strong>Usage</strong> for line-item reconciliation; totals can
        differ if the UI preset (1d/7d/30d) does not match this page&apos;s range.
      </p>
      <div className={styles.tabExportBar}>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="pi pi-download"
          label="Export CSV"
          disabled={rows.length === 0}
          onClick={() => dtRef.current?.exportCSV({ selectionOnly: false })}
        />
      </div>
      <DataTable
        ref={dtRef}
        value={rows}
        paginator
        rows={20}
        sortMode="multiple"
        removableSort
        size="small"
      >
        <Column field="name" header="Name" sortable />
        <Column field="email" header="Email" sortable />
        <Column field="role" header="Role" sortable />
        <Column field="cycleSpendCents" header="Cycle billed" sortable body={cycleSpendCell} />
        <Column field="cycleOverallCents" header="Cycle overall (API)" sortable body={cycleOverallCell} />
        <Column field="chargedRangeCents" header="Charged (range)" sortable body={chargedRangeCell} />
        <Column field="usageReqsInRange" header="Usage reqs (range)" sortable />
        <Column field="includedReqsInRange" header="Included reqs (range)" sortable />
        <Column header="$ / usage req" body={usdPerUsageCell} />
        <Column header="$ / included req" body={usdPerIncludedCell} />
      </DataTable>
    </>
  );
};
