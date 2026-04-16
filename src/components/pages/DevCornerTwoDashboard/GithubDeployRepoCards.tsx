'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { ProgressSpinner } from 'primereact/progressspinner';
import { MarqueeTicker } from '@/components/ui';
import type { GitHubDeployWorkflowStatus } from '@/types/github/GitHubDeployStatus';
import {
  cardHealthForRow,
  formatDeployRunDuration,
  formatDeployRunTimestamp,
  formatDeployStatusLabel,
  repoToneForRepo,
  tagSeverityForRow,
} from '@/utils/githubDeployDisplay';
import styles from './GithubDeployRepoCards.module.scss';

export interface GithubDeployRepoCardsProps {
  /** Workflow rows from GET /api/github/deploy-status (typically four CD pipelines). */
  repos: GitHubDeployWorkflowStatus[];
}

type DeployEnvironmentKey = 'dev' | 'tst' | 'stg' | 'prod';
type EnvironmentRunState = 'ok' | 'running' | 'failed' | 'queued' | 'idle';

interface EnvironmentSnapshot {
  key: DeployEnvironmentKey;
  label: 'Dev' | 'Tst' | 'Stg' | 'Prod';
  state: EnvironmentRunState;
  branch: string | null;
  triggerText: string | null;
}

function statusTagWrapClass(
  severity: ReturnType<typeof tagSeverityForRow>
): string {
  switch (severity) {
    case 'success':
      return styles.tagWrapSuccess;
    case 'warning':
      return styles.tagWrapWarning;
    case 'danger':
      return styles.tagWrapDanger;
    case 'info':
      return styles.tagWrapInfo;
    default:
      return styles.tagWrapNeutral;
  }
}

function detectEnvironment(
  branch: string | null,
  title: string
): DeployEnvironmentKey | null {
  const b = (branch ?? '').toLowerCase();
  const t = title.toLowerCase();
  const tokens = `${b} ${t}`;
  if (tokens.includes('prod') || tokens.includes('production') || b === 'main' || b === 'master') return 'prod';
  if (tokens.includes('stag') || tokens.includes('stg') || tokens.includes('uat')) return 'stg';
  if (tokens.includes('test') || tokens.includes('tst') || tokens.includes('qa')) return 'tst';
  if (tokens.includes('dev') || tokens.includes('develop') || b === 'development') return 'dev';
  return null;
}

function deriveEnvironmentSnapshots(row: GitHubDeployWorkflowStatus): EnvironmentSnapshot[] {
  const envs: Record<DeployEnvironmentKey, EnvironmentSnapshot> = {
    dev: { key: 'dev', label: 'Dev', state: 'idle', branch: null, triggerText: null },
    tst: { key: 'tst', label: 'Tst', state: 'idle', branch: null, triggerText: null },
    stg: { key: 'stg', label: 'Stg', state: 'idle', branch: null, triggerText: null },
    prod: { key: 'prod', label: 'Prod', state: 'idle', branch: null, triggerText: null },
  };

  const runs = (row.recentRuns ?? []).slice().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  for (const run of runs) {
    const env = detectEnvironment(run.headBranch, run.title);
    if (!env) continue;
    if (envs[env].state !== 'idle') continue;
    if (run.status !== 'completed') {
      envs[env] = {
        key: env,
        label: envs[env].label,
        state: run.status === 'queued' ? 'queued' : 'running',
        branch: run.headBranch,
        triggerText: run.title,
      };
      continue;
    }
    if (run.conclusion === 'success') {
      envs[env] = {
        key: env,
        label: envs[env].label,
        state: 'ok',
        branch: run.headBranch,
        triggerText: run.title,
      };
      continue;
    }
    envs[env] = {
      key: env,
      label: envs[env].label,
      state: 'failed',
      branch: run.headBranch,
      triggerText: run.title,
    };
  }
  return [envs.dev, envs.tst, envs.stg, envs.prod];
}

function environmentSeverity(snapshot: EnvironmentSnapshot): 'success' | 'danger' | 'warning' | 'secondary' | 'info' {
  if (snapshot.state === 'ok') return 'success';
  if (snapshot.state === 'failed') return 'danger';
  if (snapshot.state === 'running' || snapshot.state === 'queued') return 'warning';
  return 'secondary';
}

function environmentStatusText(snapshot: EnvironmentSnapshot): string {
  if (snapshot.state === 'ok') return 'OK';
  if (snapshot.state === 'failed') return 'Fail';
  if (snapshot.state === 'running') return 'Run';
  if (snapshot.state === 'queued') return 'Queue';
  return 'Idle';
}

/**
 * Reusable 2×2 grid of CD deploy cards (repo label, status, branch pill, marquee run title, details, footer ticker).
 * Uses PrimeReact Card, Tag, ProgressBar — TV-safe (no button links).
 */
export const GithubDeployRepoCards = ({ repos }: GithubDeployRepoCardsProps) => {
  const [, setElapsedClock] = useState<number>(Date.now());
  const hasActiveRuns = useMemo(
    () => repos.some((row) => Boolean(row.activeRun && row.activeRun.status !== 'completed')),
    [repos]
  );

  useEffect(() => {
    if (!hasActiveRuns) return;
    const intervalId = window.setInterval(() => {
      setElapsedClock(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [hasActiveRuns]);

  return (
    <div className={styles.root}>
      <div className={styles.grid}>
        {repos.map((row) => {
          const run = row.activeRun ?? row.lastCompletedRun;
          const err = row.error;
          const tagValue = err
            ? 'API error'
            : (row.queuedCount ?? 0) > 0 && (row.inProgressCount ?? 0) === 0
              ? `queued (${row.queuedCount})`
            : run
              ? formatDeployStatusLabel(run.status, run.conclusion)
              : 'No runs';
          const severity = tagSeverityForRow(row, run);
          const health = cardHealthForRow(row, run);
          const tone = repoToneForRepo(row.repo);
          const showActivityBar = Boolean(row.activeRun && run && run.status !== 'completed');
          const isRunning = Boolean(row.activeRun && run && run.status !== 'completed');
          const durationLabel = run
            ? formatDeployRunDuration(run.createdAt, run.updatedAt, isRunning)
            : '—';
          const finishedLabel = run && !isRunning ? formatDeployRunTimestamp(run.updatedAt) : '—';
          const queuedCount = row.queuedCount ?? 0;
          const envSnapshots = deriveEnvironmentSnapshots(row);
          const envTickerText = envSnapshots
            .map((env) => `${env.label.toUpperCase()}: ${env.triggerText ?? env.branch ?? 'No recent run'}`)
            .join(' | ');

          return (
            <Card
              key={`${row.owner}/${row.repo}`}
              className={`${styles.card} ${
                health === 'ok' ? styles.cardOk : health === 'error' ? styles.cardError : styles.cardWarning
              } ${
                tone === 'api'
                  ? styles.repoToneApi
                  : tone === 'tools'
                    ? styles.repoToneTools
                    : tone === 'nuget'
                      ? styles.repoToneNuget
                      : tone === 'migrations'
                        ? styles.repoToneMigrations
                        : ''
              }`}
              header={
                <div className={styles.cardHeader}>
                  <div className={styles.headerTitleWithMeta}>
                    <span className={styles.repoTitle}>{row.shortLabel}</span>
                    <span className={styles.cardHeaderMeta}>
                      <span className={styles.metaChip}>Elapsed {durationLabel}</span>
                      <span className={styles.metaChip}>Finished {finishedLabel}</span>
                    </span>
                  </div>
                  <span className={`${styles.statusTagWrap} ${statusTagWrapClass(severity)}`}>
                    <Tag value={tagValue} severity={severity} rounded />
                  </span>
                </div>
              }
            >
              {err ? (
                <p className={styles.errorText}>{err}</p>
              ) : run ? (
                <>
                  <div className={styles.branchRow}>
                    <span className={styles.branchPill}>{run.headBranch ?? '—'}</span>
                    {queuedCount > 0 ? (
                      <span className={styles.queueTagWrap}>
                        <Tag value={`Queued ${queuedCount}`} severity="warning" rounded />
                      </span>
                    ) : null}
                    {isRunning ? (
                      <span className={styles.runningChip}>
                        <ProgressSpinner className={styles.runningSpinner} strokeWidth="8" />
                        Active
                      </span>
                    ) : null}
                  </div>
                  <div className={styles.environmentBoard}>
                    {envSnapshots.map((env) => (
                      <div
                        key={`${row.repo}-${env.key}`}
                        className={`${styles.environmentRow} ${
                          env.state === 'ok'
                            ? styles.environmentOk
                            : env.state === 'failed'
                              ? styles.environmentFailed
                              : env.state === 'running' || env.state === 'queued'
                                ? styles.environmentRunning
                                : styles.environmentIdle
                        }`}
                      >
                        <span className={styles.environmentLabel}>{env.label}</span>
                        <span className={styles.environmentStatusWrap}>
                          <Tag value={environmentStatusText(env)} severity={environmentSeverity(env)} rounded />
                        </span>
                        <MarqueeTicker
                          text={env.triggerText ?? env.branch ?? 'No recent run'}
                          className={styles.environmentTriggerTicker}
                          durationSeconds={22}
                          gapRem={1.5}
                        />
                      </div>
                    ))}
                  </div>
                  <dl className={styles.detailList}>
                    {queuedCount > 0 && (
                      <div className={styles.detailRow}>
                        <dt>Waiting</dt>
                        <dd>{queuedCount} run(s) in queue</dd>
                      </div>
                    )}
                  </dl>
                  {showActivityBar && (
                    <ProgressBar mode="indeterminate" className={styles.activityBar} style={{ height: '4px' }} />
                  )}
                  <div className={styles.footerTicker}>
                    <MarqueeTicker
                      text={envTickerText}
                      className={styles.footerTickerMarquee}
                      durationSeconds={34}
                      gapRem={2.25}
                    />
                  </div>
                </>
              ) : (
                <p className={styles.meta}>No workflow runs returned.</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
