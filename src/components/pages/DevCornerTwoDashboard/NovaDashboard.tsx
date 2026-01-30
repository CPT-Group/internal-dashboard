'use client';

import { useEffect, useMemo } from 'react';
import { Card } from 'primereact/card';
import { Chart } from 'primereact/chart';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { useJiraNovaStore } from '@/stores';

export const NovaDashboard = () => {
  const { fetchNovaData, isStale, loading, error, getAnalytics } = useJiraNovaStore();

  useEffect(() => {
    if (isStale()) void fetchNovaData();
    const interval = setInterval(() => {
      if (isStale()) void fetchNovaData();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNovaData, isStale]);

  const analytics = getAnalytics();

  const barChartData = useMemo(() => {
    const labels = analytics.byAssignee.map((a) => a.displayName);
    const data = analytics.byAssignee.map((a) => a.openCount);
    return {
      labels,
      datasets: [{ label: 'Open tickets', data }],
    };
  }, [analytics.byAssignee]);

  const barChartOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true },
      },
    }),
    []
  );

  const doughnutChartData = useMemo(() => {
    const labels = analytics.byAssignee.map((a) => a.displayName);
    const data = analytics.byAssignee.map((a) => a.openCount);
    return {
      labels,
      datasets: [{ data }],
    };
  }, [analytics.byAssignee]);

  const doughnutChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' as const } },
    }),
    []
  );

  if (loading && analytics.totalOpen === 0 && analytics.totalToday === 0) {
    return (
      <div className="flex align-items-center justify-content-center min-h-screen">
        <ProgressSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Message severity="error" text={error} className="w-full" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold m-0 mb-4">NOVA – Dev Corner Two</h1>
      <p className="text-color-secondary m-0 mb-4">
        Live view of active tickets (cached 5 min). Focus: today’s activity, open by assignee, late tickets.
      </p>

      <div className="grid mb-4">
        <div className="col-12 md:col-4">
          <Card className="h-full">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{analytics.totalOpen}</div>
              <div className="text-color-secondary mt-1">Open tickets</div>
            </div>
          </Card>
        </div>
        <div className="col-12 md:col-4">
          <Card className="h-full">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{analytics.totalToday}</div>
              <div className="text-color-secondary mt-1">Updated today</div>
            </div>
          </Card>
        </div>
        <div className="col-12 md:col-4">
          <Card className="h-full">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{analytics.totalOverdue}</div>
              <div className="text-color-secondary mt-1">Overdue (late)</div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid mb-4">
        <div className="col-12 lg:col-8">
          <Card title="Open tickets by assignee">
            <div style={{ height: '280px' }}>
              <Chart type="bar" data={barChartData} options={barChartOptions} />
            </div>
          </Card>
        </div>
        <div className="col-12 lg:col-4">
          <Card title="Distribution">
            <div style={{ height: '280px' }}>
              <Chart type="doughnut" data={doughnutChartData} options={doughnutChartOptions} />
            </div>
          </Card>
        </div>
      </div>

      <Card title="By assignee (open / today / late)">
        <DataTable
          value={analytics.byAssignee}
          size="small"
          stripedRows
          emptyMessage="No assignees"
          className="p-datatable-sm"
        >
          <Column field="displayName" header="Assignee" sortable />
          <Column
            field="openCount"
            header="Open"
            sortable
            body={(row) => <Tag value={String(row.openCount)} />}
          />
          <Column
            field="todayCount"
            header="Today"
            sortable
            body={(row) => <Tag value={String(row.todayCount)} severity="info" />}
          />
          <Column
            field="overdueCount"
            header="Late"
            sortable
            body={(row) =>
              row.overdueCount > 0 ? (
                <Tag value={String(row.overdueCount)} severity="danger" />
              ) : (
                <span className="text-color-secondary">0</span>
              )
            }
          />
        </DataTable>
      </Card>

      {loading && (
        <div className="flex align-items-center gap-2 mt-2">
          <ProgressSpinner style={{ width: '24px', height: '24px' }} />
          <span className="text-color-secondary text-sm">Refreshing…</span>
        </div>
      )}
    </div>
  );
};
