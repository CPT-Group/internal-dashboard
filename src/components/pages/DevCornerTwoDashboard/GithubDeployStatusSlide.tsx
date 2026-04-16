'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Message } from 'primereact/message';
import { MeterGroup } from 'primereact/metergroup';
import { ProgressBar } from 'primereact/progressbar';
import { Skeleton } from 'primereact/skeleton';
import { DevCornerSlideHero } from '@/components/ui';
import { GITHUB_ACTIVITY_POLL_INTERVAL_MS } from '@/constants';
import type { GitHubDeployWorkflowStatus } from '@/types/github/GitHubDeployStatus';
import { summarizeDeployRepos } from '@/utils/githubDeployDisplay';
import { GithubDeployRepoCards } from './GithubDeployRepoCards';
import styles from './GithubDeployStatusSlide.module.scss';
import slideStyles from './DevCornerTwoDashboard.module.scss';

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
      if (res.status === 503 && data.message?.includes('GITHUB_DEPLOY_READ_TOKEN')) {
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

  const summary = useMemo(() => summarizeDeployRepos(repos), [repos]);

  const meterValues = useMemo(
    () => [
      { label: 'Idle OK', value: summary.ok, color: 'var(--green-500)' },
      { label: 'Running', value: summary.active, color: 'var(--primary-color)' },
      { label: 'Attention', value: summary.attention, color: 'var(--red-500)' },
    ],
    [summary]
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
        <DevCornerSlideHero
          title="GitHub — CD deploy status"
          pill="Setup"
          description="Add GITHUB_DEPLOY_READ_TOKEN to server env (Actions read on monitored repos)."
        />
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
      <DevCornerSlideHero
        title="GitHub — CD deploy status"
        pill="Actions API"
        pillInline
      />
      {repos.length > 0 && (
        <>
          <div className={styles.meterWrap}>
            <MeterGroup values={meterValues} max={repos.length} labelPosition="start" />
          </div>
          {(summary.active > 0 || loading) && (
            <div className={styles.globalActivityWrap}>
              <div className={styles.globalActivityLabel}>
                {summary.active > 0 ? `Deployment activity detected (${summary.active} repo)` : 'Refreshing deploy status'}
              </div>
              <ProgressBar mode="indeterminate" className={styles.globalActivityBar} style={{ height: '4px' }} />
            </div>
          )}
        </>
      )}
      <div className={styles.contentLayout}>
        <div className={styles.cardsPanel}>
          <GithubDeployRepoCards repos={repos} />
        </div>
      </div>
    </div>
  );
};
