/**
 * CLI check: per-lane mapping vs GitHub Actions (same resolution path as TV cards).
 * Usage: npx tsx scripts/verify-deploy-lane-mapping.runner.ts [repo-slug]
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  findLatestRunForDeployLane,
  getDeployLaneConfig,
  isWithinDeployIdleWindow,
  normalizeDeployEnvironment,
  type DeployEnvironmentKey,
  type DeployLaneKey,
} from '@/utils/githubDeployEnvironment';
import {
  getActiveWorkflowIdsForDeployLane,
  getMonitorWorkflowIds,
  getPrimaryWorkflowIdsForDeployLane,
} from '@/constants/GITHUB_DEPLOY_LANE_WORKFLOWS';
import {
  DEPLOY_VERSION_WORKFLOW_IDS,
  resolveDeployRunEnvironment,
  type RepoDeploymentRow,
} from '@/utils/resolveDeployRunEnvironment';

config({ path: resolve(process.cwd(), '.env.local') });

const REPO = process.argv[2] ?? 'cpt-ef-postgres-migrations';
const OWNER = 'CPT-Group';
const IDLE_AFTER_DAYS = 7;

interface GitHubRunRow {
  id: number;
  workflowId: number;
  headBranch: string | null;
  headSha: string | null;
  createdAt: string;
  status: string;
  conclusion: string | null;
  title: string;
  updatedAt: string;
  runNumber: number;
  resolvedEnvironment?: DeployEnvironmentKey | null;
  jobNames?: string[];
}

/** GitHub Actions workflow display names for picker workflow IDs (standardized + fallback repos). */
const WORKFLOW_GH_NAMES: Readonly<Record<number, string>> = {
  285805316: 'Dev Fast Deploy',
  285805315: 'Deploy Version',
  285805319: 'TST Build Artifact',
  285810378: 'Dev Fast Deploy',
  285810377: 'Deploy Version',
  285810381: 'TST Build Artifact',
  285829490: 'Dev Fast Deploy',
  285829489: 'Deploy Version',
  285829491: 'TST Build Artifact',
  288752702: 'Dev Fast Deploy',
  288752700: 'Deploy Version',
  288752705: 'TST Build Artifact',
  285242645: 'CD - Deploy Infrastructure',
};

function token(): string {
  return (
    process.env.GITHUB_TOKEN_3?.trim() ||
    process.env.GITHUB_TOKEN_2?.trim() ||
    process.env.GITHUB_DEPLOY_READ_TOKEN?.trim() ||
    ''
  );
}

function mapApiRun(
  workflowId: number,
  run: {
    id: number;
    head_branch: string | null;
    head_sha?: string | null;
    created_at: string;
    status: string;
    conclusion: string | null;
    display_title?: string;
    name?: string;
    updated_at: string;
    run_number: number;
  }
): GitHubRunRow {
  return {
    id: run.id,
    workflowId,
    headBranch: run.head_branch,
    headSha: run.head_sha ?? null,
    createdAt: run.created_at,
    status: run.status,
    conclusion: run.conclusion,
    title: run.display_title ?? run.name ?? '',
    updatedAt: run.updated_at,
    runNumber: run.run_number,
  };
}

async function fetchRunsViaGhApi(workflowId: number): Promise<GitHubRunRow[]> {
  const result = spawnSync(
    'gh',
    [
      'api',
      `repos/${OWNER}/${REPO}/actions/workflows/${workflowId}/runs?per_page=50`,
      '--jq',
      '.workflow_runs',
    ],
    { encoding: 'utf8', shell: process.platform === 'win32' }
  );
  if (result.status !== 0) {
    throw new Error(`wf ${workflowId}: gh api failed — ${(result.stderr || result.stdout).trim().slice(0, 120)}`);
  }
  if (!result.stdout.trim()) return [];
  const rows = JSON.parse(result.stdout) as Array<Parameters<typeof mapApiRun>[1]>;
  return rows.map((run) => mapApiRun(workflowId, run));
}

async function fetchRunsViaRest(authToken: string, workflowId: number): Promise<GitHubRunRow[]> {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${workflowId}/runs?per_page=50`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    throw new Error(`wf ${workflowId}: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { workflow_runs?: Array<Parameters<typeof mapApiRun>[1]> };
  return (data.workflow_runs ?? []).map((run) => mapApiRun(workflowId, run));
}

async function fetchRuns(workflowId: number): Promise<GitHubRunRow[]> {
  try {
    return await fetchRunsViaGhApi(workflowId);
  } catch (ghError) {
    const authToken = token();
    if (!authToken) throw ghError;
    return fetchRunsViaRest(authToken, workflowId);
  }
}

async function fetchDeploymentsViaGhApi(): Promise<RepoDeploymentRow[]> {
  const result = spawnSync(
    'gh',
    ['api', `repos/${OWNER}/${REPO}/deployments?per_page=100`],
    { encoding: 'utf8', shell: process.platform === 'win32' }
  );
  if (result.status !== 0 || !result.stdout.trim()) return [];
  const rows = JSON.parse(result.stdout) as Array<{
    environment?: string | null;
    sha?: string | null;
    created_at?: string | null;
  }>;
  const out: RepoDeploymentRow[] = [];
  for (const d of rows) {
    const env = normalizeDeployEnvironment(d.environment);
    const createdAtMs = Date.parse(d.created_at ?? '');
    if (env && d.sha && Number.isFinite(createdAtMs)) {
      out.push({ environment: env, sha: d.sha, createdAtMs });
    }
  }
  return out;
}

async function fetchRunJobNamesViaGhApi(runId: number): Promise<string[]> {
  const result = spawnSync(
    'gh',
    [
      'api',
      `repos/${OWNER}/${REPO}/actions/runs/${runId}/jobs?per_page=100`,
      '--jq',
      '[.jobs[].name]',
    ],
    { encoding: 'utf8', shell: process.platform === 'win32' }
  );
  if (result.status !== 0 || !result.stdout.trim()) return [];
  const names = JSON.parse(result.stdout) as string[];
  return names.filter((name) => name.trim().length > 0);
}

function laneSelection(lane: DeployLaneKey) {
  return {
    primaryWorkflowIds: getPrimaryWorkflowIdsForDeployLane(REPO, lane),
    activeWorkflowIds: getActiveWorkflowIdsForDeployLane(REPO, lane),
  };
}

function stateLabel(run: GitHubRunRow): string {
  if (run.status !== 'completed') return run.status;
  return run.conclusion ?? 'completed';
}

function envLabel(run: GitHubRunRow): string {
  return run.resolvedEnvironment ?? run.headBranch ?? '—';
}

async function enrichRunsWithTargetEnv(runs: GitHubRunRow[], deployments: RepoDeploymentRow[]): Promise<void> {
  for (const run of runs) {
    let jobNames: string[] | undefined;
    if (
      run.status !== 'completed' &&
      DEPLOY_VERSION_WORKFLOW_IDS.has(run.workflowId) &&
      resolveDeployRunEnvironment(
        {
          workflowId: run.workflowId,
          headBranch: run.headBranch,
          headSha: run.headSha,
          createdAt: run.createdAt,
          status: run.status,
        },
        deployments
      ) === null
    ) {
      jobNames = await fetchRunJobNamesViaGhApi(run.id);
      run.jobNames = jobNames;
    }

    run.resolvedEnvironment = resolveDeployRunEnvironment(
      {
        workflowId: run.workflowId,
        headBranch: run.headBranch,
        headSha: run.headSha,
        createdAt: run.createdAt,
        status: run.status,
        jobNames,
      },
      deployments
    );
  }
}

async function main() {
  const workflowIds = getMonitorWorkflowIds(REPO);
  if (!workflowIds || workflowIds.length === 0) {
    console.error(`Unknown or unconfigured repo slug: ${REPO}`);
    process.exit(1);
  }

  const [runs, deployments] = await Promise.all([
    Promise.all(workflowIds.map((id) => fetchRuns(id))).then((groups) => groups.flat()),
    fetchDeploymentsViaGhApi(),
  ]);

  await enrichRunsWithTargetEnv(runs, deployments);

  console.log(`\n${REPO} — ${runs.length} runs from ${workflowIds.length} workflow(s)`);
  console.log(`Deployments API: ${deployments.length} recent deployment(s)\n`);

  const laneConfig = getDeployLaneConfig(REPO);

  for (const lane of laneConfig.order) {
    const picked = findLatestRunForDeployLane(REPO, lane, runs, laneSelection(lane));

    if (!picked || !isWithinDeployIdleWindow(picked.updatedAt, Date.now(), IDLE_AFTER_DAYS)) {
      console.log(`${lane.toUpperCase().padEnd(8)} — IDLE`);
      continue;
    }

    const wfName = WORKFLOW_GH_NAMES[picked.workflowId] ?? `wf ${picked.workflowId}`;
    console.log(
      `${lane.toUpperCase().padEnd(8)} — ${stateLabel(picked)} | ${wfName} | env ${envLabel(picked)} | #${picked.runNumber} | ${picked.title.slice(0, 50)}`
    );
  }

  console.log('\nLane picker uses Deployments API + job-name hints (same as TV API).');
}

main().catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
