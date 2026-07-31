'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { MarqueeTicker } from '@/components/ui';
import type { GitHubDeployWorkflowStatus } from '@/types/github/GitHubDeployStatus';
import {
  cardHealthFromLaneStates,
  formatDeployRunDuration,
  repoToneForRepo,
  tagSeverityFromLaneStates,
  tagValueFromLaneStates,
  type GitHubRepoTone,
} from '@/utils/githubDeployDisplay';
import { getDeployLaneConfig, type DeployLaneKey } from '@/utils/githubDeployEnvironment';
import {
  deriveEnvironmentSnapshots,
  type EnvironmentSnapshot,
} from '@/utils/deriveDeployEnvironmentSnapshots';
import styles from './GithubDeployRepoCards.module.scss';

export type { EnvironmentRunState, EnvironmentSnapshot } from '@/utils/deriveDeployEnvironmentSnapshots';
export { deriveEnvironmentSnapshots } from '@/utils/deriveDeployEnvironmentSnapshots';

export interface GithubDeployRepoCardsProps {
  /** Workflow rows from GET /api/github/deploy-status. */
  repos: GitHubDeployWorkflowStatus[];
  /** Toggle the branch context chip row below card header. */
  showBranchContext?: boolean;
}

const IDLE_AFTER_DAYS = 7;
const IDLE_MIN_MS = IDLE_AFTER_DAYS * 24 * 60 * 60 * 1000;

function statusTagWrapClass(
  severity: ReturnType<typeof tagSeverityFromLaneStates>
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

function idleEnvironmentSnapshots(
  order: readonly DeployLaneKey[],
  labels: Partial<Record<DeployLaneKey, string>>
): EnvironmentSnapshot[] {
  return order.map((key) => ({
    key,
    label: labels[key] ?? key.toUpperCase(),
    state: 'idle',
    branch: null,
    triggerText: null,
    createdAt: null,
    updatedAt: null,
    deployVersionLabel: null,
  }));
}

function formatIdleLabel(updatedAt: string | null): string {
  // Real deploy lanes never render "N/A" — that label is reserved for package-lib na lanes only.
  if (!updatedAt) return 'Idle';
  const ms = Date.now() - Date.parse(updatedAt);
  if (!Number.isFinite(ms) || ms < IDLE_MIN_MS) return 'Idle';
  const days = Math.floor(ms / 86_400_000);
  if (days < 14) return `Idle ${days}d`;
  return `Idle ${Math.floor(days / 7)}w`;
}

function environmentSeverity(snapshot: EnvironmentSnapshot): 'success' | 'danger' | 'warning' | 'secondary' | 'info' {
  if (snapshot.state === 'ok') return 'success';
  // Cancelled = deliberately aborted deploy (not a failure) → neutral, never danger red.
  if (snapshot.state === 'cancelled') return 'secondary';
  if (snapshot.state === 'failed' || snapshot.state === 'api_error') return 'danger';
  if (snapshot.state === 'running') return 'warning';
  if (snapshot.state === 'queued') return 'info';
  return 'secondary';
}

function environmentStatusText(snapshot: EnvironmentSnapshot): string {
  if (snapshot.state === 'ok') return 'OK';
  if (snapshot.state === 'cancelled') return 'Cancelled';
  if (snapshot.state === 'failed') return 'Fail';
  if (snapshot.state === 'running') return 'In Progress';
  if (snapshot.state === 'queued') return 'Queued';
  if (snapshot.state === 'api_error') return 'API ERR';
  if (snapshot.state === 'na') return 'N/A';
  return formatIdleLabel(snapshot.updatedAt);
}

function environmentRowClass(snapshot: EnvironmentSnapshot): string {
  if (snapshot.state === 'ok') return styles.environmentOk;
  // Neutral row styling (like idle) — a cancelled deploy left the env unchanged, not failed.
  if (snapshot.state === 'cancelled') return styles.environmentIdle;
  if (snapshot.state === 'failed' || snapshot.state === 'api_error') return styles.environmentFailed;
  if (snapshot.state === 'running') return styles.environmentRunning;
  if (snapshot.state === 'queued') return styles.environmentQueued;
  if (snapshot.state === 'na') return styles.environmentNa;
  return styles.environmentIdle;
}

function environmentElapsedText(snapshot: EnvironmentSnapshot): string {
  if (!snapshot.createdAt) return '—';
  const isActive = snapshot.state === 'running' || snapshot.state === 'queued';
  return formatDeployRunDuration(
    snapshot.createdAt,
    snapshot.updatedAt ?? snapshot.createdAt,
    isActive
  );
}

function buildEnvTickerText(envSnapshots: EnvironmentSnapshot[]): string {
  return envSnapshots
    .map((env) => `${env.label.toUpperCase()}: ${env.triggerText ?? env.branch ?? 'No recent run'}`)
    .join(' | ');
}

function repoToneClassName(tone: GitHubRepoTone): string {
  if (tone === 'api') return styles.repoToneApi;
  if (tone === 'tools') return styles.repoToneTools;
  if (tone === 'nuget') return styles.repoToneNuget;
  if (tone === 'migrations') return styles.repoToneMigrations;
  if (tone === 'p2p') return styles.repoToneP2p;
  return '';
}

/** Card body — content-sized; no TV auto-scroll (avoids false overflow gaps). */
function DeployRepoCardBody({ children }: { children: ReactNode }) {
  return <div className={styles.cardBody}>{children}</div>;
}

interface DeployPipelineCardProps {
  row: GitHubDeployWorkflowStatus;
  showBranchContext: boolean;
}

/** One pipeline card — shared layout for live repos and placeholders. */
function DeployPipelineCard({ row, showBranchContext }: DeployPipelineCardProps) {
  const isPlaceholder = Boolean(row.isPlaceholder);
  const run = isPlaceholder ? undefined : row.activeRun ?? row.lastCompletedRun;
  const err = isPlaceholder ? undefined : row.error;
  const queuedCount = isPlaceholder ? 0 : row.queuedCount ?? 0;

  const laneConfig = getDeployLaneConfig(row.repo);
  const envSnapshots = isPlaceholder
    ? idleEnvironmentSnapshots(laneConfig.order, laneConfig.labels)
    : deriveEnvironmentSnapshots(row);
  const envTickerText = buildEnvTickerText(envSnapshots);

  const laneStates = envSnapshots.map((env) => env.state);
  const inProgressCount = isPlaceholder ? 0 : row.inProgressCount ?? 0;
  const laneHasActive = laneStates.some((s) => s === 'running' || s === 'queued');
  // Monitored CD is busy in Actions but no swim lane resolved a target (missing run-name,
  // non-standard dispatch, stuck queue). Keep the primary badge on lane truth; surface a muted
  // secondary chip so we do not contradict green OK lanes with a false Queued/In Progress badge.
  const actionsBusy =
    !isPlaceholder && !err && !laneHasActive && queuedCount + inProgressCount > 0;
  // Single source of truth with the meter + lane pills: swim-lane state only.
  const tagValue = isPlaceholder
    ? 'Not configured'
    : err
      ? 'API error'
      : tagValueFromLaneStates(laneStates);
  const severity = isPlaceholder
    ? 'secondary'
    : err
      ? 'danger'
      : tagSeverityFromLaneStates(laneStates);
  const health = isPlaceholder
    ? 'warning'
    : err
      ? 'error'
      : cardHealthFromLaneStates(laneStates);
  const deployerLabel = isPlaceholder ? '—' : run?.actorLogin ?? 'unknown';

  const cardClassName = [
    styles.card,
    isPlaceholder
      ? styles.cardPlaceholder
      : health === 'ok'
        ? styles.cardOk
        : health === 'error'
          ? styles.cardError
          : styles.cardWarning,
    repoToneClassName(repoToneForRepo(row.repo)),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Card
      className={cardClassName}
      header={
        <div className={styles.cardHeader}>
          <div className={styles.headerTitleWithMeta}>
            <span className={styles.repoTitle}>{row.shortLabel}</span>
            <span className={styles.cardHeaderMeta}>
              <span className={styles.metaChip}>By {deployerLabel}</span>
            </span>
          </div>
          <div className={styles.headerStatusTags}>
            <span className={`${styles.statusTagWrap} ${statusTagWrapClass(severity)}`}>
              <Tag value={tagValue} severity={severity} rounded />
            </span>
            {actionsBusy ? (
              <span className={styles.headerActionsBusyWrap} title="Monitored CD workflow is active but no swim-lane target resolved yet">
                <Tag value="Actions busy" severity="secondary" rounded />
              </span>
            ) : null}
          </div>
        </div>
      }
    >
      <DeployRepoCardBody>
        <div className={styles.cardBodyMain}>
          {err ? <p className={styles.errorText}>{err}</p> : null}
          {!err && !run && !isPlaceholder ? (
            <p className={styles.meta}>No workflow runs returned.</p>
          ) : null}
          {showBranchContext && run?.headBranch ? (
            <div className={styles.branchRow}>
              <span className={styles.branchPill}>{run.headBranch}</span>
            </div>
          ) : null}
          <div className={styles.environmentBoard}>
            {envSnapshots.map((env) => (
              <div
                key={`${row.repo}-${env.key}`}
                className={`${styles.environmentRow} ${environmentRowClass(env)}`}
              >
                <span className={styles.environmentLabel}>
                  <span className={styles.environmentLabelName}>{env.label}</span>
                  {env.deployVersionLabel ? (
                    <span className={styles.environmentVersion}>{env.deployVersionLabel}</span>
                  ) : null}
                </span>
                <span className={styles.environmentStatusWrap}>
                  <Tag value={environmentStatusText(env)} severity={environmentSeverity(env)} rounded />
                </span>
                <span className={styles.environmentElapsed}>{environmentElapsedText(env)}</span>
                <div className={styles.environmentInfo}>
                  <MarqueeTicker
                    text={env.triggerText ?? env.branch ?? 'No recent run'}
                    className={styles.environmentTriggerTicker}
                    durationSeconds={22}
                    gapRem={1.5}
                    forceMarquee
                  />
                  <div className={styles.environmentProgressTrack}>
                    {(env.state === 'running' || env.state === 'queued') && (
                      <ProgressBar
                        mode="indeterminate"
                        className={`${styles.environmentInlineProgress} ${
                          env.state === 'queued'
                            ? styles.environmentInlineProgressQueued
                            : styles.environmentInlineProgressRunning
                        }`}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.footerTicker}>
          <MarqueeTicker
            text={envTickerText}
            className={styles.footerTickerMarquee}
            durationSeconds={34}
            gapRem={2.25}
          />
        </div>
      </DeployRepoCardBody>
    </Card>
  );
}

/**
 * 3×2 grid of CD deploy cards (repo label, status, swim lanes, footer ticker).
 * Uses PrimeReact Card, Tag, ProgressBar — TV-safe (no button links).
 */
export const GithubDeployRepoCards = ({ repos, showBranchContext = true }: GithubDeployRepoCardsProps) => {
  const [, setElapsedClock] = useState<number>(0);
  const hasActiveRuns = useMemo(
    () =>
      repos.some(
        (row) =>
          !row.isPlaceholder &&
          Boolean(row.activeRun && row.activeRun.status !== 'completed')
      ),
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
        {repos.map((row) => (
          <DeployPipelineCard
            key={`${row.owner}/${row.repo}`}
            row={row}
            showBranchContext={showBranchContext}
          />
        ))}
      </div>
    </div>
  );
};
