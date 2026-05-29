'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Card } from 'primereact/card';
import { Message } from 'primereact/message';
import { MeterGroup } from 'primereact/metergroup';
import { Skeleton } from 'primereact/skeleton';
import { GITHUB_ACTIVITY_POLL_INTERVAL_MS } from '@/constants';
import type { GitHubDeployWorkflowStatus } from '@/types/github/GitHubDeployStatus';
import {
  detectDeployEnvironmentFromRun,
  type DeployEnvironmentKey,
} from '@/utils/githubDeployEnvironment';
import { GithubDeployRepoCards } from './GithubDeployRepoCards';
import { useTheme } from '@/providers/ThemeProvider';
import styles from './GithubDeployStatusSlide.module.scss';
import slideStyles from './DevCornerTwoDashboard.module.scss';

type DeployEnvironmentState = 'success' | 'inProgress' | 'queued' | 'failed' | 'noData';
const IDLE_AFTER_DAYS = 7;

interface DeployLegendValue {
  label: string;
  value: number;
  color: string;
  color1: string;
  color2: string;
  meterTemplate?: (props: MeterTemplateItem, attr?: React.HTMLAttributes<HTMLSpanElement>) => React.ReactNode;
}

interface MeterTemplateItem {
  index: number;
  percentage: number;
  color1?: string;
  color2?: string;
}

interface MeterLabelListProps {
  values?: Array<{
    label?: string | HTMLElement;
    value?: number;
    color?: string;
  }>;
}

function isWithinIdleWindow(isoTimestamp: string): boolean {
  const updatedAtMs = Date.parse(isoTimestamp);
  if (!Number.isFinite(updatedAtMs)) return false;
  const idleAfterMs = IDLE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - updatedAtMs <= idleAfterMs;
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
    if (repo.isPlaceholder) {
      continue;
    }
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
      const env = detectDeployEnvironmentFromRun({ headBranch: run.headBranch, title: run.title });
      if (!env || byEnv[env] !== 'noData') continue;
      if (!isWithinIdleWindow(run.updatedAt)) continue;

      if (run.status !== 'completed') {
        byEnv[env] = run.status === 'queued' ? 'queued' : 'inProgress';
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
  const { cycleTheme } = useTheme();
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
        color: 'var(--yellow-500)',
        color1: 'var(--yellow-500)',
        color2: 'var(--yellow-300)',
      },
      {
        label: 'Queued',
        value: environmentTotals.queued,
        color: 'var(--orange-500)',
        color1: 'var(--orange-500)',
        color2: 'var(--orange-300)',
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

  const meterTemplate = useCallback(
    (props: MeterTemplateItem, attr?: React.HTMLAttributes<HTMLSpanElement>) => (
      <span
        {...(attr ?? {})}
        key={props.index}
        style={{
          ...(attr?.style ?? {}),
          background: `linear-gradient(to right, ${props.color1 ?? 'var(--primary-color)'}, ${props.color2 ?? 'var(--primary-color)'})`,
          width: `${props.percentage}%`,
        }}
      />
    ),
    []
  );

  const meterValuesWithTemplate = useMemo(
    () => meterValues.map((item) => ({ ...item, meterTemplate })),
    [meterTemplate, meterValues]
  );

  const meterLabelList = useCallback(
    (props?: MeterLabelListProps) => {
      const values = props?.values ?? [];
      if (values.length === 0) return null;

      return (
        <div className={styles.meterLabelCards}>
          {values.map((item, index) => {
            const labelText = typeof item.label === 'string' ? item.label : 'Status';
            const isThemeHit = labelText === 'Successful';
            const inner = (
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
            );
            return (
              <Card
                key={`${labelText}-${index}`}
                className={`${styles.meterLabelCard}${isThemeHit ? ` ${styles.meterLabelCardThemeHit}` : ''}`}
                {...(isThemeHit
                  ? {
                      onClick: () => cycleTheme(),
                      onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          cycleTheme();
                        }
                      },
                      role: 'button' as const,
                      tabIndex: 0,
                      'aria-label': 'Next visual style',
                    }
                  : {})}
              >
                {inner}
              </Card>
            );
          })}
        </div>
      );
    },
    [cycleTheme, trackedEnvironmentSlots]
  );


  if (loading && repos.length === 0 && !error && !configError) {
    return (
      <div className={slideStyles.slideContent}>
        <div className={styles.skeletonGrid} aria-busy="true" aria-label="Loading deploy status">
          {Array.from({ length: 6 }, (_, i) => (
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
            values={meterValuesWithTemplate}
            max={trackedEnvironmentSlots}
            labelPosition="start"
            labelList={meterLabelList}
          />
        </div>
      )}
      <div className={styles.contentLayout}>
        <div className={styles.cardsPanel}>
          <GithubDeployRepoCards repos={repos} showBranchContext={false} />
        </div>
      </div>
    </div>
  );
};
