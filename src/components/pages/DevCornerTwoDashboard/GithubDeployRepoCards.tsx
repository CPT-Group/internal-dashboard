'use client';

import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import type { GitHubDeployWorkflowStatus } from '@/types/github/GitHubDeployStatus';
import {
  cardHealthForRow,
  formatDeployStatusLabel,
  repoToneForRepo,
  tagSeverityForRow,
} from '@/utils/githubDeployDisplay';
import styles from './GithubDeployRepoCards.module.scss';

export interface GithubDeployRepoCardsProps {
  /** Workflow rows from GET /api/github/deploy-status (typically four CD pipelines). */
  repos: GitHubDeployWorkflowStatus[];
}

/**
 * Reusable 2×2 grid of CD deploy cards (repo label, status, branch, run title, link).
 * Uses PrimeReact Card, Tag, ProgressBar, Button — safe to embed on other dashboards.
 */
export const GithubDeployRepoCards = ({ repos }: GithubDeployRepoCardsProps) => {
  return (
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
                <Tag value={tagValue} severity={severity} rounded />
              </div>
            }
          >
            {err ? (
              <p className={styles.errorText}>{err}</p>
            ) : run ? (
              <>
                <p className={styles.meta}>
                  {row.activeRun ? 'Running · ' : 'Last · '}
                  {run.headBranch ?? '—'} · {run.updatedAt.slice(0, 19).replace('T', ' ')}
                </p>
                {showActivityBar && (
                  <ProgressBar mode="indeterminate" className={styles.activityBar} style={{ height: '3px' }} />
                )}
                <p className={styles.title}>{run.title}</p>
                <a
                  href={run.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${styles.openLink} p-button p-button-text p-button-sm`}
                >
                  <span className="p-button-icon pi pi-github" />
                  <span className="p-button-label">Open run</span>
                </a>
              </>
            ) : (
              <p className={styles.meta}>No workflow runs returned.</p>
            )}
          </Card>
        );
      })}
    </div>
  );
};
