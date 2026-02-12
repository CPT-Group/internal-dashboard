'use client';

import { useEffect, useMemo } from 'react';
import { Card } from 'primereact/card';
import { Chart } from 'primereact/chart';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { Skeleton } from 'primereact/skeleton';
import { useDev1JiraStore } from '@/stores';
import { JiraMeterChart } from '@/components/ui';

const CHART_COLORS = [
  'rgba(59, 130, 246, 0.82)',
  'rgba(168, 85, 247, 0.82)',
  'rgba(34, 197, 94, 0.82)',
  'rgba(234, 179, 8, 0.82)',
  'rgba(236, 72, 153, 0.82)',
  'rgba(20, 184, 166, 0.82)',
  'rgba(249, 115, 22, 0.82)',
  'rgba(99, 102, 241, 0.82)',
];

export const DevCornerOneDashboard = () => {
  const { fetchDev1Data, isStale, loading, error, getAnalytics } = useDev1JiraStore();

  useEffect(() => {
    if (isStale()) void fetchDev1Data();
    const interval = setInterval(() => {
      if (isStale()) void fetchDev1Data();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchDev1Data, isStale]);

  const analytics = getAnalytics();

  const assigneeComboChartData = useMemo(() => {
    const labels = analytics.byAssignee.map((a) => a.displayName);
    const openData = analytics.byAssignee.map((a) => a.openCount);
    const avgDaysData = analytics.byAssignee.map((a) => a.avgDaysToClose ?? 0);
    const colors = analytics.byAssignee.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    return {
      labels,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Open',
          data: openData,
          backgroundColor: colors,
          borderColor: colors.map((c) => c.replace('0.82', '1')),
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
          order: 2,
        },
        {
          type: 'line' as const,
          label: 'Avg days to close',
          data: avgDaysData,
          borderColor: 'rgba(234, 179, 8, 0.9)',
          backgroundColor: 'rgba(234, 179, 8, 0.1)',
          fill: false,
          tension: 0.2,
          pointRadius: 4,
          pointHoverRadius: 6,
          xAxisID: 'x1',
          order: 1,
        },
      ],
    };
  }, [analytics.byAssignee]);

  const assigneeComboChartOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: { display: true, position: 'top' as const },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          beginAtZero: true,
          position: 'bottom' as const,
          title: { display: true, text: 'Open count' },
          grid: { drawOnChartArea: true },
        },
        x1: {
          beginAtZero: true,
          position: 'top' as const,
          title: { display: true, text: 'Avg days to close' },
          grid: { drawOnChartArea: false },
        },
        y: { grid: { display: false } },
      },
    }),
    []
  );

  const byTypeChartData = useMemo(() => {
    const byType = analytics.byType ?? {};
    const labels = Object.keys(byType).sort();
    const data = labels.map((k) => byType[k]);
    const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    return {
      labels,
      datasets: [
        {
          label: 'Open by type',
          data,
          backgroundColor: colors,
          borderColor: colors.map((c) => c.replace('0.82', '1')),
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  }, [analytics.byType]);

  const byComponentChartData = useMemo(() => {
    const byComponent = analytics.byComponent ?? {};
    const labels = Object.keys(byComponent).sort();
    const data = labels.map((k) => byComponent[k]);
    const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    return {
      labels,
      datasets: [
        {
          label: 'Open by component',
          data,
          backgroundColor: colors,
          borderColor: colors.map((c) => c.replace('0.82', '1')),
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  }, [analytics.byComponent]);

  const barChartOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } },
    }),
    []
  );

  if (loading && analytics.totalOpen === 0 && analytics.totalDone === 0) {
    return (
      <div className="dev1-dashboard-content">
        <div className="grid mb-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="col-6 md:col-3">
              <Card className="p-2">
                <Skeleton width="3rem" height="2rem" />
              </Card>
            </div>
          ))}
        </div>
        <Card className="p-2">
          <Skeleton width="100%" height="200px" />
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
      <div className="dev1-dashboard-content p-2">
        <Message severity="error" text={error} className="w-full" />
      </div>
    );
  }

  return (
    <div className="dev1-dashboard-content">
      <div className="grid mb-2">
        <div className="col-6 md:col-3">
          <Card className="p-2">
            <div className="text-center">
              <div className="text-2xl font-bold">{analytics.totalOpen}</div>
              <div className="text-color-secondary text-sm">Open</div>
            </div>
          </Card>
        </div>
        <div className="col-6 md:col-3">
          <Card className="p-2">
            <div className="text-center">
              <div className="text-2xl font-bold">{analytics.totalToday}</div>
              <div className="text-color-secondary text-sm">Today</div>
            </div>
          </Card>
        </div>
        <div className="col-6 md:col-3">
          <Card className="p-2">
            <div className="text-center">
              <div className="text-2xl font-bold">{analytics.totalOverdue}</div>
              <div className="text-color-secondary text-sm">Late</div>
            </div>
          </Card>
        </div>
        <div className="col-6 md:col-3">
          <Card className="p-2">
            <div className="text-center">
              <div className="text-2xl font-bold">{analytics.totalDone}</div>
              <div className="text-color-secondary text-sm">Done</div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid mb-2">
        <div className="col-12 lg:col-8">
          <Card title="Open &amp; avg days to close by assignee" className="p-2">
            <div style={{ height: '220px' }}>
              <Chart
                type="bar"
                data={assigneeComboChartData}
                options={assigneeComboChartOptions}
              />
            </div>
          </Card>
        </div>
        <div className="col-12 lg:col-4">
          <Card title="Distribution" className="p-2">
            <div style={{ minHeight: '200px' }}>
              <JiraMeterChart
                centerValue={analytics.totalOpen}
                centerLabel="Open"
                labels={analytics.byAssignee.map((a) => a.displayName)}
                data={analytics.byAssignee.map((a) => a.openCount)}
                colors={CHART_COLORS}
                height={200}
              />
            </div>
          </Card>
        </div>
      </div>

      {analytics.byType != null && Object.keys(analytics.byType).length > 0 && (
        <div className="grid mb-2">
          <div className="col-12 md:col-6">
            <Card title="By type" className="p-2">
              <div style={{ height: '160px' }}>
                <Chart type="bar" data={byTypeChartData} options={barChartOptions} />
              </div>
            </Card>
          </div>
          {analytics.byComponent != null && Object.keys(analytics.byComponent).length > 0 ? (
            <div className="col-12 md:col-6">
              <Card title="By component" className="p-2">
                <div style={{ height: '160px' }}>
                  <Chart type="bar" data={byComponentChartData} options={barChartOptions} />
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      )}

      {analytics.byComponent != null &&
        Object.keys(analytics.byComponent).length > 0 &&
        (analytics.byType == null || Object.keys(analytics.byType).length === 0) && (
          <div className="grid mb-2">
            <div className="col-12">
              <Card title="By component" className="p-2">
                <div style={{ height: '160px' }}>
                  <Chart type="bar" data={byComponentChartData} options={barChartOptions} />
                </div>
              </Card>
            </div>
          </div>
        )}

      {loading && (
        <div className="flex align-items-center gap-2 mt-1">
          <ProgressSpinner style={{ width: '18px', height: '18px' }} />
          <span className="text-color-secondary text-sm">Refreshing…</span>
        </div>
      )}
    </div>
  );
};
