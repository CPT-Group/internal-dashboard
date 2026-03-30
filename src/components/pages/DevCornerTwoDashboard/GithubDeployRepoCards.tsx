'use client';

import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
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

/**
 * Reusable 2×2 grid of CD deploy cards (repo label, status, branch, run title, footer ticker).
 * Uses PrimeReact Card, Tag, ProgressBar — TV-safe (no button links).
 */
export const GithubDeployRepoCards = ({ repos }: GithubDeployRepoCardsProps) => {
  return (
    <div className={styles.root}>
      <div className={styles.grid}>
        {repos.map((row) => {
          const run = row.activeRun ?? row.lastCompletedRun;
          const err = row.error;
          const tagValue = err
            ? 'API error'
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
                  <span className={styles.repoTitle}>{row.shortLabel}</span>
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
                  <p className={styles.repoPath}>
                    {row.owner}/{row.repo}
                  </p>
                  <div className={styles.runMetaRow}>
                    <span className={styles.runMetaPill}>Run #{run.id}</span>
                    <span className={styles.branchPill}>{run.headBranch ?? '—'}</span>
                  </div>
                  <p className={styles.title}>{run.title}</p>
                  <dl className={styles.detailList}>
                    <div className={styles.detailRow}>
                      <dt>Started</dt>
                      <dd>{formatDeployRunTimestamp(run.createdAt)}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>{isRunning ? 'Elapsed' : 'Finished'}</dt>
                      <dd>
                        {isRunning
                          ? durationLabel
                          : `${formatDeployRunTimestamp(run.updatedAt)} (${durationLabel})`}
                      </dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Workflow</dt>
                      <dd>#{row.workflowId}</dd>
                    </div>
                  </dl>
                  {showActivityBar && (
                    <ProgressBar mode="indeterminate" className={styles.activityBar} style={{ height: '4px' }} />
                  )}
                  <div className={styles.footerTicker} title={run.title}>
                    <div className={styles.footerTickerTrack}>
                      <span className={styles.footerTickerSeg}>
                        {run.title} · {run.headBranch ?? '—'} · Run #{run.id} · GitHub Actions
                      </span>
                      <span className={styles.footerTickerSeg}>
                        {run.title} · {run.headBranch ?? '—'} · Run #{run.id} · GitHub Actions
                      </span>
                    </div>
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
