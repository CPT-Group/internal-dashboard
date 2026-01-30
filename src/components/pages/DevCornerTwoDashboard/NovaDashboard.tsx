'use client';

import { useEffect, useMemo } from 'react';
import { Card } from 'primereact/card';
import { Chart } from 'primereact/chart';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Skeleton } from 'primereact/skeleton';
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
      animation: { duration: 1000 },
      transitions: { active: { animation: { duration: 800 } } },
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
      animation: { duration: 1000 },
      transitions: { active: { animation: { duration: 800 } } },
      plugins: { legend: { position: 'bottom' as const } },
    }),
    []
  );

  if (loading && analytics.totalOpen === 0 && analytics.totalToday === 0) {
    return (
      <div className="nova-dashboard-loading">
        <Skeleton width="10rem" height="1.5rem" className="mb-2" />
        <div className="grid mb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="col-12 md:col-4">
              <Card className="p-2">
                <div className="flex flex-column align-items-center gap-1">
                  <Skeleton width="3rem" height="2rem" />
                  <Skeleton width="4rem" height="0.75rem" />
                </div>
              </Card>
            </div>
          ))}
        </div>
        <div className="grid mb-2">
          <div className="col-12 lg:col-8">
            <Card title="Open by assignee" className="p-2">
              <Skeleton width="100%" height="160px" />
            </Card>
          </div>
          <div className="col-12 lg:col-4">
            <Card title="Distribution" className="p-2">
              <Skeleton width="100%" height="160px" shape="circle" className="mx-auto" />
            </Card>
          </div>
        </div>
        <Card title="By assignee" className="p-2">
          <Skeleton width="100%" height="120px" />
        </Card>
        <div className="flex align-items-center gap-2 mt-1">
          <ProgressSpinner style={{ width: '18px', height: '18px' }} />
          <span className="text-color-secondary text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-2">
        <Message severity="error" text={error} className="w-full" />
      </div>
    );
  }

  return (
    <div className="nova-dashboard-content">
      <div className="nova-dashboard-header flex align-items-center gap-2 mb-2">
        <h1 className="text-xl font-bold m-0">NOVA – Dev Corner Two</h1>
        <span className="text-color-secondary text-sm">Open / today / late (cached 5 min)</span>
      </div>

      <div className="nova-dashboard-stats grid mb-2">
        <div className="col-12 md:col-4">
          <Card className="p-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{analytics.totalOpen}</div>
              <div className="text-color-secondary text-sm mt-0">Open</div>
            </div>
          </Card>
        </div>
        <div className="col-12 md:col-4">
          <Card className="p-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{analytics.totalToday}</div>
              <div className="text-color-secondary text-sm mt-0">Today</div>
            </div>
          </Card>
        </div>
        <div className="col-12 md:col-4">
          <Card className="p-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{analytics.totalOverdue}</div>
              <div className="text-color-secondary text-sm mt-0">Late</div>
            </div>
          </Card>
        </div>
      </div>

      <div className="nova-dashboard-charts grid mb-2">
        <div className="col-12 lg:col-8">
          <Card title="Open by assignee" className="p-2">
            <div style={{ height: '160px' }}>
              <Chart type="bar" data={barChartData} options={barChartOptions} />
            </div>
          </Card>
        </div>
        <div className="col-12 lg:col-4">
          <Card title="Distribution" className="p-2">
            <div style={{ height: '160px' }}>
              <Chart type="doughnut" data={doughnutChartData} options={doughnutChartOptions} />
            </div>
          </Card>
        </div>
      </div>

      <div className="nova-dashboard-table-wrap flex flex-column min-h-0 flex-1">
        <Card title="By assignee" className="p-2 flex flex-column min-h-0 flex-1">
          <DataTable
            value={analytics.byAssignee}
            size="small"
            stripedRows
            scrollable
            scrollHeight="flex"
            emptyMessage="No assignees"
            className="p-datatable-sm p-datatable-compact"
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
      </div>

      {loading && (
        <div className="flex align-items-center gap-2 mt-1 flex-shrink-0">
          <ProgressSpinner style={{ width: '18px', height: '18px' }} />
          <span className="text-color-secondary text-sm">Refreshing…</span>
        </div>
      )}
    </div>
  );
};
