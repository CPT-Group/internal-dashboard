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
import { JiraMeterChart } from '@/components/ui';

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

  /* Per-assignee palette: vibrant colors with opacity for modern floating look */
  const chartColors = useMemo(
    () => [
      'rgba(59, 130, 246, 0.78)',
      'rgba(168, 85, 247, 0.78)',
      'rgba(34, 197, 94, 0.78)',
      'rgba(234, 179, 8, 0.78)',
      'rgba(236, 72, 153, 0.78)',
      'rgba(20, 184, 166, 0.78)',
      'rgba(249, 115, 22, 0.78)',
      'rgba(99, 102, 241, 0.78)',
    ],
    []
  );

  const barChartData = useMemo(() => {
    const labels = analytics.byAssignee.map((a) => a.displayName);
    const data = analytics.byAssignee.map((a) => a.openCount);
    const colors = analytics.byAssignee.map((_, i) => chartColors[i % chartColors.length]);
    return {
      labels,
      datasets: [
        {
          label: 'Open tickets',
          data,
          backgroundColor: colors,
          borderColor: colors.map((c) => c.replace('0.78', '1')),
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
          hoverBorderWidth: 2,
          hoverShadowBlur: 6,
          hoverShadowOffsetY: 2,
          hoverShadowColor: 'rgba(0,0,0,0.25)',
        },
      ],
    };
  }, [analytics.byAssignee, chartColors]);

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

  const byTypeChartData = useMemo(() => {
    const byType = analytics.byType ?? {};
    const labels = Object.keys(byType).sort();
    const data = labels.map((k) => byType[k]);
    const colors = labels.map((_, i) => chartColors[i % chartColors.length]);
    return {
      labels,
      datasets: [
        {
          label: 'Open by type',
          data,
          backgroundColor: colors,
          borderColor: colors.map((c) => c.replace('0.78', '1')),
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  }, [analytics.byType, chartColors]);

  const byTypeChartOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } },
    }),
    []
  );

  if (loading && analytics.totalOpen === 0 && analytics.totalToday === 0) {
    return (
      <div className="nova-dashboard-loading">
        <div className="grid mb-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="col-6 md:col-3">
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
      <div className="nova-dashboard-stats grid mb-2">
        <div className="col-6 md:col-3">
          <Card className="p-2">
            <div className="text-center">
              <div className="nova-stat-value text-2xl font-bold">{analytics.totalOpen}</div>
              <div className="text-color-secondary text-sm mt-0">Open</div>
            </div>
          </Card>
        </div>
        <div className="col-6 md:col-3">
          <Card className="p-2">
            <div className="text-center">
              <div className="nova-stat-value text-2xl font-bold">{analytics.totalToday}</div>
              <div className="text-color-secondary text-sm mt-0">Today</div>
            </div>
          </Card>
        </div>
        <div className="col-6 md:col-3">
          <Card className="p-2">
            <div className="text-center">
              <div className="nova-stat-value text-2xl font-bold">{analytics.totalOverdue}</div>
              <div className="text-color-secondary text-sm mt-0">Late</div>
            </div>
          </Card>
        </div>
        <div className="col-6 md:col-3">
          <Card className="p-2">
            <div className="text-center">
              <div className="nova-stat-value text-2xl font-bold">{analytics.totalDone}</div>
              <div className="text-color-secondary text-sm mt-0">Done</div>
            </div>
          </Card>
        </div>
      </div>

      <div className="nova-dashboard-charts grid mb-2">
        <div className="col-12 lg:col-8">
          <Card title="Open by assignee" className="p-2">
            <div style={{ height: '200px' }}>
              <Chart type="bar" data={barChartData} options={barChartOptions} />
            </div>
          </Card>
        </div>
        <div className="col-12 lg:col-4">
          <Card title="Distribution" className="p-2 nova-dashboard-doughnut-card">
            <div className="nova-dashboard-doughnut-wrap" style={{ height: '200px' }}>
              <JiraMeterChart
                centerValue={analytics.totalOpen}
                centerLabel="Open"
                labels={analytics.byAssignee.map((a) => a.displayName)}
                data={analytics.byAssignee.map((a) => a.openCount)}
                colors={chartColors}
                height={200}
              />
            </div>
          </Card>
        </div>
      </div>

      {analytics.byType != null && Object.keys(analytics.byType).length > 0 && (
        <div className="grid mb-2">
          <div className="col-12">
            <Card title="By type" className="p-2">
              <div style={{ height: '160px' }}>
                <Chart
                  type="bar"
                  data={byTypeChartData}
                  options={byTypeChartOptions}
                />
              </div>
            </Card>
          </div>
        </div>
      )}

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
            body={(row) => (
              <Tag value={String(row.openCount)} severity="info" />
            )}
          />
          <Column
            field="todayCount"
            header="Today"
            sortable
            body={(row) => (
              <Tag value={String(row.todayCount)} className="nova-tag-today" />
            )}
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
          <Column
            field="bugCount"
            header="Bugs"
            sortable
            body={(row) =>
              row.bugCount > 0 ? (
                <Tag value={String(row.bugCount)} severity="danger" />
              ) : (
                <span className="text-color-secondary">0</span>
              )
            }
          />
          <Column
            field="doneCount"
            header="Done"
            sortable
            body={(row) =>
              row.doneCount > 0 ? (
                <Tag value={String(row.doneCount)} severity="success" />
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
