'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from 'primereact/card';
import { Message } from 'primereact/message';
import { MeterGroup } from 'primereact/metergroup';
import { Skeleton } from 'primereact/skeleton';
import { GITHUB_ACTIVITY_POLL_INTERVAL_MS } from '@/constants';
import type { GitHubDeployWorkflowStatus } from '@/types/github/GitHubDeployStatus';
import { GithubDeployRepoCards } from './GithubDeployRepoCards';
import styles from './GithubDeployStatusSlide.module.scss';
import slideStyles from './DevCornerTwoDashboard.module.scss';

type DeployEnvironmentKey = 'dev' | 'tst' | 'stg' | 'prod';
type DeployEnvironmentState = 'success' | 'inProgress' | 'queued' | 'failed' | 'noData';

interface DeployLegendValue {
  label: string;
  value: number;
  color: string;
  color1: string;
  color2: string;
}

interface MeterRenderValue {
  color?: string;
  color1?: string;
  color2?: string;
}

interface MeterRenderProps {
  values: MeterRenderValue[];
  percentages: number[];
  totalPercent: number;
}

interface MeterLabelListProps {
  values?: Array<{
    label?: string | HTMLElement;
    value?: number;
    color?: string;
  }>;
}

function detectEnvironment(branch: string | null, title: string): DeployEnvironmentKey | null {
  const b = (branch ?? '').toLowerCase();
  const t = title.toLowerCase();
  const tokens = `${b} ${t}`;
  if (tokens.includes('prod') || tokens.includes('production') || b === 'main' || b === 'master') return 'prod';
  if (tokens.includes('stag') || tokens.includes('stg') || tokens.includes('uat')) return 'stg';
  if (tokens.includes('test') || tokens.includes('tst') || tokens.includes('qa')) return 'tst';
  if (tokens.includes('dev') || tokens.includes('develop') || b === 'development') return 'dev';
  return null;
}

function queuedLike(status: string): boolean {
  return status === 'queued' || status === 'waiting' || status === 'pending' || status === 'requested';
}

function summarizeEnvironmentStates(repos: GitHubDeployWorkflowStatus[]): Record<DeployEnvironmentState, number> {
  const totals: Record<DeployEnvironmentState, number> = {
    success: 0,
    inProgress: 0,
    queued: 0,
    failed: 0,
    noData: 0,
  };

  for (const repo of repos) {
    const byEnv: Record<DeployEnvironmentKey, DeployEnvironmentState> = {
      dev: 'noData',
      tst: 'noData',
      stg: 'noData',
      prod: 'noData',
    };

    const sortedRuns = (repo.recentRuns ?? [])
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    for (const run of sortedRuns) {
      const env = detectEnvironment(run.headBranch, run.title);
      if (!env || byEnv[env] !== 'noData') continue;

      if (run.status !== 'completed') {
        byEnv[env] = queuedLike(run.status) ? 'queued' : 'inProgress';
        continue;
      }

      if (run.conclusion === 'success') {
        byEnv[env] = 'success';
        continue;
      }

      if (run.conclusion === 'failure' || run.conclusion === 'timed_out') {
        byEnv[env] = 'failed';
        continue;
      }

      byEnv[env] = 'noData';
    }

    totals.success += byEnv.dev === 'success' ? 1 : 0;
    totals.success += byEnv.tst === 'success' ? 1 : 0;
    totals.success += byEnv.stg === 'success' ? 1 : 0;
    totals.success += byEnv.prod === 'success' ? 1 : 0;

    totals.inProgress += byEnv.dev === 'inProgress' ? 1 : 0;
    totals.inProgress += byEnv.tst === 'inProgress' ? 1 : 0;
    totals.inProgress += byEnv.stg === 'inProgress' ? 1 : 0;
    totals.inProgress += byEnv.prod === 'inProgress' ? 1 : 0;

    totals.queued += byEnv.dev === 'queued' ? 1 : 0;
    totals.queued += byEnv.tst === 'queued' ? 1 : 0;
    totals.queued += byEnv.stg === 'queued' ? 1 : 0;
    totals.queued += byEnv.prod === 'queued' ? 1 : 0;

    totals.failed += byEnv.dev === 'failed' ? 1 : 0;
    totals.failed += byEnv.tst === 'failed' ? 1 : 0;
    totals.failed += byEnv.stg === 'failed' ? 1 : 0;
    totals.failed += byEnv.prod === 'failed' ? 1 : 0;

    totals.noData += byEnv.dev === 'noData' ? 1 : 0;
    totals.noData += byEnv.tst === 'noData' ? 1 : 0;
    totals.noData += byEnv.stg === 'noData' ? 1 : 0;
    totals.noData += byEnv.prod === 'noData' ? 1 : 0;
  }

  return totals;
}

export const GithubDeployStatusSlide = () => {
  const [repos, setRepos] = useState<GitHubDeployWorkflowStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/github/deploy-status');
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        repos?: GitHubDeployWorkflowStatus[];
      };
      if (res.status === 503 && data.message?.toLowerCase().includes('missing deploy tokens')) {
        setConfigError(data.message);
        setError(null);
        setRepos([]);
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.message ?? 'Failed to load deploy status');
        setConfigError(null);
        return;
      }
      setConfigError(null);
      setError(null);
      setRepos(Array.isArray(data.repos) ? data.repos : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const id = window.setInterval(() => void fetchStatus(), GITHUB_ACTIVITY_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [fetchStatus]);

  const environmentTotals = useMemo(() => summarizeEnvironmentStates(repos), [repos]);
  const trackedEnvironmentSlots = Math.max(
    1,
    environmentTotals.success + environmentTotals.inProgress + environmentTotals.queued + environmentTotals.failed
  );

  const meterValues = useMemo(
    () => [
      {
        label: 'Successful',
        value: environmentTotals.success,
        color: 'var(--green-500)',
        color1: 'var(--green-500)',
        color2: 'var(--green-300)',
      },
      {
        label: 'In Progress',
        value: environmentTotals.inProgress,
        color: 'var(--blue-500)',
        color1: 'var(--blue-500)',
        color2: 'var(--blue-300)',
      },
      {
        label: 'Queued',
        value: environmentTotals.queued,
        color: 'var(--yellow-500)',
        color1: 'var(--yellow-500)',
        color2: 'var(--yellow-300)',
      },
      {
        label: 'Failed',
        value: environmentTotals.failed,
        color: 'var(--red-500)',
        color1: 'var(--red-500)',
        color2: 'var(--red-300)',
      },
    ],
    [environmentTotals.failed, environmentTotals.inProgress, environmentTotals.queued, environmentTotals.success]
  );

  const meterGradientByLabel = useMemo<Record<string, { color1: string; color2: string }>>(
    () =>
      meterValues.reduce<Record<string, { color1: string; color2: string }>>((acc, item) => {
        acc[item.label] = { color1: item.color1, color2: item.color2 };
        return acc;
      }, {}),
    [meterValues]
  );

  const meterTemplate = useCallback(
    (props?: MeterRenderProps) => {
      const values = props?.values ?? [];
      const percentages = props?.percentages ?? [];
      if (values.length === 0) {
        return <div className={styles.customMeterTrack} />;
      }

      return (
        <div className={styles.customMeterTrack}>
          {values.map((item, index) => {
            const widthPercent = percentages[index] ?? 0;
            const labelText = typeof (item as { label?: string | HTMLElement }).label === 'string'
              ? (item as { label?: string }).label
              : '';
            const gradient = meterGradientByLabel[labelText ?? ''];
            return (
              <span
                key={`${index}-${widthPercent}`}
                className={styles.customMeterSegment}
                style={{
                  width: `${widthPercent}%`,
                  background: `linear-gradient(to right, ${gradient?.color1 ?? item.color ?? 'var(--primary-color)'}, ${gradient?.color2 ?? item.color ?? 'var(--primary-color)'})`,
                }}
              />
            );
          })}
        </div>
      );
    },
    [meterGradientByLabel]
  );

  const meterLabelList = useCallback(
    (props?: MeterLabelListProps) => {
      const values = props?.values ?? [];
      if (values.length === 0) return null;

      return (
        <div className={styles.meterLabelCards}>
          {values.map((item, index) => {
            const labelText = typeof item.label === 'string' ? item.label : 'Status';
            return (
              <Card key={`${labelText}-${index}`} className={styles.meterLabelCard}>
                <div className={styles.meterLabelCardInner}>
                  <div className={styles.meterLabelTextBlock}>
                    <span className={styles.meterLabelTitle}>{labelText}</span>
                    <span className={styles.meterLabelValue}>
                      {item.value ?? 0} / {trackedEnvironmentSlots}
                    </span>
                  </div>
                  <span
                    className={styles.meterLabelIcon}
                    style={{ backgroundColor: item.color ?? 'var(--surface-400)' }}
                  >
                    <i
                      className={
                        labelText === 'Successful'
                          ? 'pi pi-check-circle'
                          : labelText === 'In Progress'
                            ? 'pi pi-spin pi-spinner'
                            : labelText === 'Queued'
                              ? 'pi pi-clock'
                              : 'pi pi-times-circle'
                      }
                    />
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      );
    },
    [trackedEnvironmentSlots]
  );


  if (loading && repos.length === 0 && !error && !configError) {
    return (
      <div className={slideStyles.slideContent}>
        <div className={styles.skeletonGrid} aria-busy="true" aria-label="Loading deploy status">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <Skeleton width="100%" height="1.25rem" className="mb-2" />
              <Skeleton width="70%" height="0.75rem" className="mb-2" />
              <Skeleton width="100%" height="2.5rem" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className={slideStyles.slideContent}>
        <Message severity="warn" text={configError} className="w-full m-2" />
      </div>
    );
  }

  if (error && repos.length === 0) {
    return (
      <div className={slideStyles.slideContent}>
        <Message severity="error" text={error} className="w-full m-2" />
      </div>
    );
  }

  return (
    <div className={`${slideStyles.slideContent} ${styles.root}`}>
      {repos.length > 0 && (
        <div className={styles.meterWrap}>
          <MeterGroup
            values={meterValues}
            max={trackedEnvironmentSlots}
            labelPosition="start"
            meter={meterTemplate}
            labelList={meterLabelList}
          />
        </div>
      )}
      <div className={styles.contentLayout}>
        <div className={styles.cardsPanel}>
          <GithubDeployRepoCards repos={repos} />
        </div>
      </div>
    </div>
  );
};
