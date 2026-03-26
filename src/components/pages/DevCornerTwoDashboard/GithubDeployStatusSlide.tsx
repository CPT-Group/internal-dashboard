'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Message } from 'primereact/message';
import { MeterGroup } from 'primereact/metergroup';
import { Skeleton } from 'primereact/skeleton';
import { Timeline } from 'primereact/timeline';
import { DataView } from 'primereact/dataview';
import { DevCornerSlideHero } from '@/components/ui';
import { useAutoScroll } from '@/hooks';
import { GITHUB_ACTIVITY_POLL_INTERVAL_MS } from '@/constants';
import type { GitHubDeployRunSummary, GitHubDeployWorkflowStatus } from '@/types/github/GitHubDeployStatus';
import {
  type DeployRunOutcomeGlow,
  deployRunOutcomeGlow,
  formatDeployStatusLabel,
  repoToneForRepo,
  summarizeDeployRepos,
} from '@/utils/githubDeployDisplay';
import { GithubDeployRepoCards } from './GithubDeployRepoCards';
import styles from './GithubDeployStatusSlide.module.scss';
import slideStyles from './DevCornerTwoDashboard.module.scss';

const ACTION_ROW_GLOW_CLASS: Record<DeployRunOutcomeGlow, string> = {
  success: styles.actionRowGlowSuccess,
  failure: styles.actionRowGlowFailure,
  running: styles.actionRowGlowRunning,
  neutral: styles.actionRowGlowNeutral,
};

interface DeployTimelineItem {
  id: string;
  repo: string;
  run: GitHubDeployRunSummary;
}

interface DeployActionItem {
  id: string;
  repo: string;
  tone: 'api' | 'tools' | 'nuget' | 'migrations' | 'default';
  outcome: DeployRunOutcomeGlow;
  status: string;
  title: string;
  at: string;
  branch: string;
}

export const GithubDeployStatusSlide = () => {
  const [repos, setRepos] = useState<GitHubDeployWorkflowStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const timelineScrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 8, pauseMs: 5000 });
  const actionsScrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 9, pauseMs: 4500 });

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

  const timelineItems = useMemo<DeployTimelineItem[]>(() => {
    return repos
      .flatMap((row) =>
        (row.recentRuns ?? []).map((run) => ({
          id: `${row.repo}-${run.id}`,
          repo: row.shortLabel,
          run,
        }))
      )
      .sort((a, b) => new Date(b.run.updatedAt).getTime() - new Date(a.run.updatedAt).getTime())
      .slice(0, 12);
  }, [repos]);

  const recentActionItems = useMemo<DeployActionItem[]>(() => {
    return timelineItems.slice(0, 16).map((item) => ({
      id: item.id,
      repo: item.repo,
      tone: repoToneForRepo(item.repo),
      outcome: deployRunOutcomeGlow(item.run),
      status: formatDeployStatusLabel(item.run.status, item.run.conclusion),
      title: item.run.title,
      at: item.run.updatedAt.slice(5, 19).replace('T', ' '),
      branch: item.run.headBranch ?? '—',
    }));
  }, [timelineItems]);

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
        description={
          <>
            Four main deploy workflows · poll {GITHUB_ACTIVITY_POLL_INTERVAL_MS / 1000}s ·{' '}
            <span className={styles.meta}>left: cards + action feed · right: timeline</span>
          </>
        }
      />
      {repos.length > 0 && (
        <div className={styles.meterWrap}>
          <MeterGroup values={meterValues} max={repos.length} labelPosition="start" />
        </div>
      )}
      <div className={styles.contentLayout}>
        <div className={styles.cardsPane}>
          <div className={styles.cardsPanel}>
            <GithubDeployRepoCards repos={repos} />
          </div>
          <section className={styles.actionsPane}>
            <div className={styles.actionsHeader}>Recent actions</div>
            {recentActionItems.length === 0 ? (
              <div className={styles.emptyTimeline}>No recent actions returned from the API.</div>
            ) : (
              <div ref={actionsScrollRef} className={styles.actionsScroll}>
                <DataView
                  value={recentActionItems}
                  itemTemplate={(item: DeployActionItem) => (
                    <div
                      key={item.id}
                      className={`${styles.actionRow} ${ACTION_ROW_GLOW_CLASS[item.outcome]}`}
                    >
                      <div className={styles.actionTop}>
                        <span
                          className={`${styles.actionRepo} ${
                            item.tone === 'api'
                              ? styles.repoPillApi
                              : item.tone === 'tools'
                                ? styles.repoPillTools
                                : item.tone === 'nuget'
                                  ? styles.repoPillNuget
                                  : item.tone === 'migrations'
                                    ? styles.repoPillMigrations
                                    : ''
                          }`}
                        >
                          {item.repo}
                        </span>
                        <span className={styles.actionStatus}>{item.status}</span>
                      </div>
                      <div className={styles.actionTitle}>{item.title}</div>
                      <div className={styles.actionMeta}>
                        {item.branch} · {item.at}
                      </div>
                    </div>
                  )}
                />
              </div>
            )}
          </section>
        </div>
        <aside className={styles.timelinePane}>
          <div className={styles.timelineHeader}>Recent deploy runs</div>
          {timelineItems.length === 0 ? (
            <div className={styles.emptyTimeline}>No recent runs returned from the API.</div>
          ) : (
            <div ref={timelineScrollRef} className={styles.timelineScroll}>
              <Timeline
                className={styles.timeline}
                value={timelineItems}
                align="left"
                marker={(item: DeployTimelineItem) => (
                  <span
                    className={`${styles.timelineDot} ${
                      item.run.status === 'completed' && item.run.conclusion === 'success'
                        ? styles.timelineDotSuccess
                        : item.run.status !== 'completed'
                          ? styles.timelineDotRunning
                          : styles.timelineDotAttention
                    }`}
                  />
                )}
                opposite={(item: DeployTimelineItem) => (
                  <div className={styles.timelineOpposite}>
                    {formatDeployStatusLabel(item.run.status, item.run.conclusion)}
                  </div>
                )}
                content={(item: DeployTimelineItem) => (
                  <div className={styles.timelineItem}>
                    <div className={styles.timelineTop}>
                      <span
                        className={`${styles.timelineRepo} ${
                          repoToneForRepo(item.repo) === 'api'
                            ? styles.repoPillApi
                            : repoToneForRepo(item.repo) === 'tools'
                              ? styles.repoPillTools
                              : repoToneForRepo(item.repo) === 'nuget'
                                ? styles.repoPillNuget
                                : repoToneForRepo(item.repo) === 'migrations'
                                  ? styles.repoPillMigrations
                                  : ''
                        }`}
                      >
                        {item.repo}
                      </span>
                    </div>
                    <div className={styles.timelineText}>{item.run.title}</div>
                    <div className={styles.timelineMeta}>
                      {item.run.headBranch ?? '—'} · {item.run.updatedAt.slice(5, 19).replace('T', ' ')}
                    </div>
                  </div>
                )}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
