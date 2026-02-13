'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from 'primereact/card';
import { Chart } from 'primereact/chart';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { Skeleton } from 'primereact/skeleton';
import { Tag } from 'primereact/tag';
import { Panel } from 'primereact/panel';
import { useOperationalJiraStore } from '@/stores';

const KPI_LABEL_CLASS = 'operational-kpi-label';
const KPI_VALUE_CLASS = 'operational-kpi-value';

const SLIDE_DURATION_MS = 25000;
const NUM_SLIDES = 4;
const SLIDE_TRANSITION_MS = 600;

/** Owns countdown state so only this component re-renders every second; charts stay stable. */
const SlideTitleWithCountdown = memo(function SlideTitleWithCountdown({
  title,
  slideIndex,
  activeSlide,
  slideStartTime,
  slideDurationMs,
}: {
  title: string;
  slideIndex: number;
  activeSlide: number;
  slideStartTime: number;
  slideDurationMs: number;
}) {
  const isActive = activeSlide === slideIndex;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [isActive]);

  if (!isActive) return <>{title}</>;
  const secondsLeft = Math.max(0, Math.ceil((slideStartTime + slideDurationMs - Date.now()) / 1000));
  return (
    <>
      {title} (countdown: {secondsLeft}s)
    </>
  );
});

const FlowChartMemo = memo(function FlowChartMemo({
  data,
  options,
}: {
  data: object;
  options: object;
}) {
  return <Chart type="bar" data={data} options={options} />;
});

const BacklogChartMemo = memo(function BacklogChartMemo({
  data,
  options,
}: {
  data: object;
  options: object;
}) {
  return <Chart type="bar" data={data} options={options} />;
});

const AgingChartMemo = memo(function AgingChartMemo({
  data,
  options,
}: {
  data: object;
  options: object;
}) {
  return <Chart type="bar" data={data} options={options} />;
});

export const OperationalJiraDashboard = () => {
  const { fetchOperationalData, isStale, loading, error, getAnalytics } = useOperationalJiraStore();
  const [chartColors, setChartColors] = useState({ text: '#e2e8f0', grid: 'rgba(255,255,255,0.1)' });
  const [activeSlide, setActiveSlide] = useState(0);
  const [leavingSlide, setLeavingSlide] = useState<number | null>(null);
  const [slideStartTime, setSlideStartTime] = useState(() => Date.now());
  const activeSlideRef = useRef(0);
  activeSlideRef.current = activeSlide;

  useEffect(() => {
    if (isStale()) void fetchOperationalData();
    const interval = setInterval(() => {
      if (isStale()) void fetchOperationalData();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchOperationalData, isStale]);

  useEffect(() => {
    const root = document.documentElement;
    const text = getComputedStyle(root).getPropertyValue('--text-color').trim() || '#e2e8f0';
    const grid = getComputedStyle(root).getPropertyValue('--surface-border').trim() || 'rgba(255,255,255,0.1)';
    setChartColors({ text, grid });
  }, []);

  useEffect(() => {
    setSlideStartTime(Date.now());
  }, [activeSlide]);

  useEffect(() => {
    const t = setInterval(() => {
      setLeavingSlide(activeSlideRef.current);
      setActiveSlide((i) => (i + 1) % NUM_SLIDES);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (leavingSlide === null) return;
    const t = setTimeout(() => setLeavingSlide(null), SLIDE_TRANSITION_MS);
    return () => clearTimeout(t);
  }, [leavingSlide]);

  const analytics = getAnalytics();
  const { kpis, flowData, backlogByComponent, backlogByAssignee, backlogByDueDate, devLoadMatrix, assignees, components, agingBuckets, oldest10 } = analytics;

  const flowChartData = useMemo(() => {
    const labels = flowData.map((d) => d.date.slice(5));
    return {
      labels,
      datasets: [
        {
          label: 'Opened',
          data: flowData.map((d) => d.opened),
          backgroundColor: 'rgba(34, 197, 94, 0.7)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 1,
        },
        {
          label: 'Closed',
          data: flowData.map((d) => d.closed),
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 1,
        },
      ],
    };
  }, [flowData]);

  const flowChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: { display: true, position: 'top' as const, labels: { color: chartColors.text } },
      },
      scales: {
        x: {
          grid: { color: chartColors.grid },
          ticks: { color: chartColors.text, maxRotation: 45 },
        },
        y: {
          beginAtZero: true,
          grid: { color: chartColors.grid },
          ticks: { color: chartColors.text },
        },
      },
    }),
    [chartColors]
  );

  const backlogChartData = useMemo(() => {
    const labels = backlogByComponent.map((b) => b.component);
    const data = backlogByComponent.map((b) => b.openCount);
    const colors = backlogByComponent.map((b) => (b.hasAging ? 'rgba(234, 179, 8, 0.8)' : 'rgba(59, 130, 246, 0.7)'));
    return {
      labels,
      datasets: [{ label: 'Open', data, backgroundColor: colors, borderColor: colors.map((c) => c.replace('0.7', '1').replace('0.8', '1')), borderWidth: 1 }],
    };
  }, [backlogByComponent]);

  const horizontalBarChartOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: chartColors.grid }, ticks: { color: chartColors.text } },
        y: { grid: { display: false }, ticks: { color: chartColors.text } },
      },
    }),
    [chartColors]
  );

  const agingChartData = useMemo(() => {
    return {
      labels: agingBuckets.map((b) => b.label),
      datasets: [
        {
          label: 'Tickets',
          data: agingBuckets.map((b) => b.count),
          backgroundColor: ['rgba(34, 197, 94, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(234, 179, 8, 0.7)', 'rgba(249, 115, 22, 0.7)', 'rgba(239, 68, 68, 0.7)'],
          borderWidth: 1,
        },
      ],
    };
  }, [agingBuckets]);

  const backlogByAssigneeChartData = useMemo(() => {
    const labels = backlogByAssignee.map((b) => b.assigneeName);
    const data = backlogByAssignee.map((b) => b.openCount);
    return {
      labels,
      datasets: [{ label: 'Open', data, backgroundColor: 'rgba(59, 130, 246, 0.7)', borderColor: 'rgb(59, 130, 246)', borderWidth: 1 }],
    };
  }, [backlogByAssignee]);

  const backlogByDueDateChartData = useMemo(() => {
    const labels = backlogByDueDate.map((b) => b.label);
    const data = backlogByDueDate.map((b) => b.openCount);
    const colors = ['rgba(239, 68, 68, 0.7)', 'rgba(234, 179, 8, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(34, 197, 94, 0.7)', 'rgba(148, 163, 184, 0.7)'];
    return {
      labels,
      datasets: [{ label: 'Open', data, backgroundColor: colors.slice(0, data.length), borderWidth: 1 }],
    };
  }, [backlogByDueDate]);

  const agingChartOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: chartColors.grid }, ticks: { color: chartColors.text } },
        y: { grid: { display: false }, ticks: { color: chartColors.text } },
      },
    }),
    [chartColors]
  );

  const maxLoad = useMemo(() => {
    if (devLoadMatrix.length === 0) return 1;
    return Math.max(1, ...devLoadMatrix.map((c) => c.count));
  }, [devLoadMatrix]);

  const summaryBody = useCallback((r: { summary: string }) => (r.summary.length > 45 ? r.summary.slice(0, 42) + '…' : r.summary), []);
  const componentBody = useCallback((r: { component: string }) => (r.component.length > 12 ? r.component.slice(0, 10) + '…' : r.component), []);
  const ageDaysBody = useCallback((r: { ageDays: number }) => `${r.ageDays}d`, []);
  const statusBody = useCallback(
    (r: { status: string; ageDays: number }) => (
      <Tag value={r.status} severity={r.ageDays >= 15 ? 'danger' : r.ageDays >= 8 ? 'warning' : 'info'} />
    ),
    []
  );

  if (loading && kpis.openCount === 0 && flowData.length === 0) {
    return (
      <div className="operational-dashboard">
        <div className="grid operational-kpi-strip">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="col-6 md:col-2 lg:col">
              <Card className="text-center">
                <Skeleton width="2.5rem" height="1.25rem" />
              </Card>
            </div>
          ))}
        </div>
        <div className="operational-carousel flex-1 flex align-items-center justify-content-center">
          <div className="flex align-items-center gap-2">
            <ProgressSpinner className="progress-spinner-md" />
            <span className="text-color-secondary">Loading…</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="operational-dashboard">
        <Message severity="error" text={error} className="w-full m-2" />
      </div>
    );
  }

  return (
    <div className="operational-dashboard">
      {/* KPI strip always visible */}
      <div className="grid operational-kpi-strip">
        <div className="col-6 md:col-2 lg:col">
          <Card className="text-center">
            <div className={KPI_VALUE_CLASS}>{kpis.openCount}</div>
            <div className={KPI_LABEL_CLASS}>Open</div>
          </Card>
        </div>
        <div className="col-6 md:col-2 lg:col">
          <Card className="text-center">
            <div className={KPI_VALUE_CLASS}>{kpis.openedToday}</div>
            <div className={KPI_LABEL_CLASS}>Opened today</div>
          </Card>
        </div>
        <div className="col-6 md:col-2 lg:col">
          <Card className="text-center">
            <div className={KPI_VALUE_CLASS}>{kpis.closedToday}</div>
            <div className={KPI_LABEL_CLASS}>Closed today</div>
          </Card>
        </div>
        <div className="col-6 md:col-2 lg:col">
          <Card className="text-center">
            <div className="flex align-items-center justify-content-center gap-1 flex-wrap">
              <span className={KPI_VALUE_CLASS}>{kpis.netChangeToday > 0 ? '+' : ''}{kpis.netChangeToday}</span>
              <Tag
                severity={kpis.netChangeToday > 0 ? 'danger' : kpis.netChangeToday < 0 ? 'success' : 'info'}
                value={kpis.netChangeToday > 0 ? 'Growing' : kpis.netChangeToday < 0 ? 'Shrinking' : 'Flat'}
              />
            </div>
            <div className={KPI_LABEL_CLASS}>Net today</div>
          </Card>
        </div>
        <div className="col-6 md:col-2 lg:col">
          <Card className="text-center">
            <div className={KPI_VALUE_CLASS}>{kpis.avgAgeDays}d</div>
            <div className={KPI_LABEL_CLASS}>Avg age</div>
          </Card>
        </div>
        <div className="col-6 md:col-2 lg:col">
          <Card className="text-center">
            <div className={KPI_VALUE_CLASS}>{kpis.oldestAgeDays}d</div>
            <div className={KPI_LABEL_CLASS}>Oldest open</div>
          </Card>
        </div>
      </div>

      {/* Auto-rotating carousel: one slide visible at a time, no scrolling */}
      <div className="operational-carousel">
        {/* Slide 0: Flow */}
        <div className={`operational-carousel__slide ${activeSlide === 0 ? 'active' : ''} ${leavingSlide === 0 ? 'leaving' : ''}`}>
          <div className="operational-carousel__slide-content">
            <Panel
              header={
                <SlideTitleWithCountdown
                  title="Flow (last 14 days)"
                  slideIndex={0}
                  activeSlide={activeSlide}
                  slideStartTime={slideStartTime}
                  slideDurationMs={SLIDE_DURATION_MS}
                />
              }
              className="flex-1 flex flex-column min-h-0"
            >
              <div className="flex-1 min-h-0" style={{ minHeight: '180px' }}>
                <FlowChartMemo data={flowChartData} options={flowChartOptions} />
              </div>
            </Panel>
          </div>
        </div>
        {/* Slide 1: Backlog + Aging */}
        <div className={`operational-carousel__slide ${activeSlide === 1 ? 'active' : ''} ${leavingSlide === 1 ? 'leaving' : ''}`}>
          <div className="operational-carousel__slide-content">
            <div className="grid flex-1 min-h-0 gap-2">
              <div className="col-12 md:col-6 flex flex-column min-h-0">
                <Card
                  title={
                <SlideTitleWithCountdown
                  title="Backlog by component"
                  slideIndex={1}
                  activeSlide={activeSlide}
                  slideStartTime={slideStartTime}
                  slideDurationMs={SLIDE_DURATION_MS}
                />
              }
                  subTitle={
                    <span className="flex align-items-center gap-2 flex-wrap">
                      <Tag severity="warning" value="Aging" /> = &gt;7d
                    </span>
                  }
                  className="flex-1 flex flex-column min-h-0"
                >
                  <div className="flex-1 min-h-0" style={{ minHeight: '140px' }}>
                    <BacklogChartMemo data={backlogChartData} options={horizontalBarChartOptions} />
                  </div>
                </Card>
              </div>
              <div className="col-12 md:col-6 flex flex-column min-h-0">
                <Card title="Aging buckets" className="flex-1 flex flex-column min-h-0">
                  <div className="flex-1 min-h-0" style={{ minHeight: '140px' }}>
                    <AgingChartMemo data={agingChartData} options={agingChartOptions} />
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
        {/* Slide 2: Developer load matrix */}
        <div className={`operational-carousel__slide ${activeSlide === 2 ? 'active' : ''} ${leavingSlide === 2 ? 'leaving' : ''}`}>
          <div className="operational-carousel__slide-content">
            <Card
              title={
                <SlideTitleWithCountdown
                  title="Developer load matrix"
                  slideIndex={2}
                  activeSlide={activeSlide}
                  slideStartTime={slideStartTime}
                  slideDurationMs={SLIDE_DURATION_MS}
                />
              }
              className="flex-1 flex flex-column min-h-0"
            >
              <div className="overflow-auto flex-1 min-h-0">
                <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th className="text-left p-1 border border-surface-border">Dev / Component</th>
                      {components.slice(0, 8).map((c) => (
                        <th key={c} className="text-center p-1 border border-surface-border text-color-secondary">
                          {c.length > 10 ? c.slice(0, 8) + '…' : c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assignees.slice(0, 10).map((aid) => {
                      const name = devLoadMatrix.find((c) => c.assigneeId === aid)?.assigneeName ?? aid;
                      return (
                        <tr key={aid}>
                          <td className="p-1 border border-surface-border font-medium">{name.split(' ')[0]}</td>
                          {components.slice(0, 8).map((comp) => {
                            const cell = devLoadMatrix.find((c) => c.assigneeId === aid && c.component === comp);
                            const count = cell?.count ?? 0;
                            const intensity = maxLoad > 0 ? count / maxLoad : 0;
                            const bg = `rgba(59, 130, 246, ${0.15 + intensity * 0.75})`;
                            return (
                              <td key={comp} className="text-center p-1 border border-surface-border" style={{ backgroundColor: bg }}>
                                {count || '–'}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
        {/* Slide 3: Oldest 10 */}
        <div className={`operational-carousel__slide ${activeSlide === 3 ? 'active' : ''} ${leavingSlide === 3 ? 'leaving' : ''}`}>
          <div className="operational-carousel__slide-content">
            <Card
              title={
                <SlideTitleWithCountdown
                  title="Oldest 10 open tickets"
                  slideIndex={3}
                  activeSlide={activeSlide}
                  slideStartTime={slideStartTime}
                  slideDurationMs={SLIDE_DURATION_MS}
                />
              }
              className="flex-1 flex flex-column min-h-0"
            >
              <DataTable
                value={oldest10}
                size="small"
                scrollable
                scrollHeight="220px"
                stripedRows
                showGridlines
                className="text-sm"
              >
                <Column field="key" header="Key" style={{ width: '80px' }} />
                <Column field="summary" header="Summary" body={summaryBody} />
                <Column field="assignee" header="Assignee" style={{ width: '100px' }} />
                <Column field="component" header="Component" style={{ width: '90px' }} body={componentBody} />
                <Column field="ageDays" header="Age" style={{ width: '60px' }} body={ageDaysBody} />
                <Column field="status" header="Status" style={{ width: '100px' }} body={statusBody} />
              </DataTable>
            </Card>
          </div>
        </div>

        <div className="operational-carousel__indicators">
          {Array.from({ length: NUM_SLIDES }, (_, i) => (
            <div key={i} className={`operational-carousel__indicator ${activeSlide === i ? 'active' : ''}`} aria-hidden />
          ))}
        </div>
      </div>
    </div>
  );
};
