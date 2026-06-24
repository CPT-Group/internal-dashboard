/**
 * CLI check: per-lane branch + workflow mapping vs GitHub Actions (same logic as TV cards).
 * Usage: npx tsx scripts/verify-deploy-lane-mapping.runner.ts [repo-slug]
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  findLatestRunForDeployLane,
  getDeployLaneConfig,
  isWithinDeployIdleWindow,
  type DeployLaneKey,
} from '@/utils/githubDeployEnvironment';
import {
  getActiveWorkflowIdsForDeployLane,
  getMonitorWorkflowIds,
  getPrimaryWorkflowIdsForDeployLane,
} from '@/constants/GITHUB_DEPLOY_LANE_WORKFLOWS';
import { isP2pGoServiceRepo, resolveP2pRunEnvironment } from '@/utils/p2pDeployEnvironment';

config({ path: resolve(process.cwd(), '.env.local') });

const REPO = process.argv[2] ?? 'cpt-ef-postgres-migrations';
const OWNER = 'CPT-Group';
const IDLE_AFTER_DAYS = 7;

interface GitHubRunRow {
  workflowId: number;
  headBranch: string | null;
  headSha?: string | null;
  status: string;
  conclusion: string | null;
  title: string;
  updatedAt: string;
  createdAt: string;
  runNumber: number;
  resolvedEnvironment?: 'dev' | 'tst' | 'stg' | 'prod';
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
  288752705: 'TST Build Artifact',
  288752700: 'Deploy Version',
  301162091: 'TST Auto-Merge (development -> test)',
  301145195: 'Dev Fast Deploy',
  289926293: 'CD - Promote to On-Prem (tst / stg / prd)',
  285242645: 'CD - Deploy Infrastructure',
};

interface GhBranchRun {
  status: string;
  conclusion: string | null;
  workflowName: string;
  number: number;
  displayTitle: string;
  updatedAt?: string;
}

function token(): string {
  return (
    process.env.GITHUB_TOKEN_3?.trim() ||
    process.env.GITHUB_TOKEN_2?.trim() ||
    process.env.GITHUB_DEPLOY_READ_TOKEN?.trim() ||
    ''
  );
}

function normalizeBranch(branch: string | null): string {
  return (branch ?? '').trim().toLowerCase().replace(/^refs\/heads\//, '');
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
  const rows = JSON.parse(result.stdout) as Array<{
    head_branch: string | null;
    head_sha?: string | null;
    status: string;
    conclusion: string | null;
    display_title?: string;
    name?: string;
    updated_at: string;
    created_at: string;
    run_number: number;
  }>;
  return rows.map((run) => ({
    workflowId,
    headBranch: run.head_branch,
    headSha: run.head_sha,
    status: run.status,
    conclusion: run.conclusion,
    title: run.display_title ?? run.name ?? '',
    updatedAt: run.updated_at,
    createdAt: run.created_at,
    runNumber: run.run_number,
  }));
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
  const data = (await res.json()) as {
    workflow_runs?: Array<{
      head_branch: string | null;
      head_sha?: string | null;
      status: string;
      conclusion: string | null;
      display_title?: string;
      name?: string;
      updated_at: string;
      created_at: string;
      run_number: number;
    }>;
  };
  return (data.workflow_runs ?? []).map((run) => ({
    workflowId,
    headBranch: run.head_branch,
    headSha: run.head_sha,
    status: run.status,
    conclusion: run.conclusion,
    title: run.display_title ?? run.name ?? '',
    updatedAt: run.updated_at,
    createdAt: run.created_at,
    runNumber: run.run_number,
  }));
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

function ghLatestForWorkflow(branch: string, workflowName: string): GhBranchRun | null {
  const result = spawnSync(
    'gh',
    [
      'run',
      'list',
      '-R',
      `${OWNER}/${REPO}`,
      '--branch',
      branch,
      '--workflow',
      workflowName,
      '--limit',
      '1',
      '--json',
      'status,conclusion,workflowName,number,displayTitle,updatedAt',
    ],
    { encoding: 'utf8', shell: process.platform === 'win32' }
  );
  if (result.status !== 0 || !result.stdout.trim()) return null;
  const rows = JSON.parse(result.stdout) as GhBranchRun[];
  return rows[0] ?? null;
}

function ghRefForPickedRun(picked: GitHubRunRow): GhBranchRun | null {
  if (isP2pGoServiceRepo(REPO)) {
    return null;
  }
  const branch = normalizeBranch(picked.headBranch);
  const workflowName = WORKFLOW_GH_NAMES[picked.workflowId];
  if (!branch || !workflowName) return null;
  return ghLatestForWorkflow(branch, workflowName);
}

function enrichRunsWithResolvedEnvironment(runs: GitHubRunRow[]): GitHubRunRow[] {
  if (!isP2pGoServiceRepo(REPO)) {
    return runs;
  }
  const p2pInputs = runs.map((run) => ({
    workflowId: run.workflowId,
    headSha: run.headSha,
    createdAt: run.createdAt,
    status: run.status,
    conclusion: run.conclusion,
  }));
  return runs.map((run) => {
    const resolved = resolveP2pRunEnvironment(
      {
        workflowId: run.workflowId,
        headSha: run.headSha,
        createdAt: run.createdAt,
        status: run.status,
        conclusion: run.conclusion,
      },
      p2pInputs
    );
    return resolved ? { ...run, resolvedEnvironment: resolved } : run;
  });
}

function matchesGhExpectation(picked: GitHubRunRow, ghRun: GhBranchRun | null): boolean {
  if (!ghRun) return true;
  if (picked.runNumber !== ghRun.number) return false;
  if (picked.status !== ghRun.status) return false;
  if (picked.status === 'completed' && picked.conclusion !== ghRun.conclusion) return false;
  return true;
}

async function main() {
  const workflowIds = getMonitorWorkflowIds(REPO);
  if (!workflowIds || workflowIds.length === 0) {
    console.error(`Unknown or unconfigured repo slug: ${REPO}`);
    process.exit(1);
  }

  const runs = enrichRunsWithResolvedEnvironment(
    (await Promise.all(workflowIds.map((id) => fetchRuns(id)))).flat()
  );
  console.log(`\n${REPO} — ${runs.length} runs from ${workflowIds.length} workflow(s)\n`);

  const laneConfig = getDeployLaneConfig(REPO);
  let mismatches = 0;

  for (const lane of laneConfig.order) {
    const picked = findLatestRunForDeployLane(REPO, lane, runs, laneSelection(lane));
    const ghRef = picked ? ghRefForPickedRun(picked) : null;

    if (!picked || !isWithinDeployIdleWindow(picked.updatedAt, Date.now(), IDLE_AFTER_DAYS)) {
      console.log(`${lane.toUpperCase().padEnd(8)} — IDLE (picker)`);
      if (ghRef) {
        console.log(
          `           gh deploy wf: ${ghRef.status}/${ghRef.conclusion ?? '-'} | ${ghRef.workflowName} #${ghRef.number}`
        );
      }
      continue;
    }

    const ok = matchesGhExpectation(picked, ghRef);
    if (!ok) mismatches += 1;
    const flag = ok ? 'OK' : 'MISMATCH';

    console.log(
      `${lane.toUpperCase().padEnd(8)} — ${stateLabel(picked)} | wf ${picked.workflowId} | ${picked.headBranch} | #${picked.runNumber} | ${picked.title.slice(0, 50)} [${flag}]`
    );
    if (ghRef) {
      const ghLine = `${ghRef.status}/${ghRef.conclusion ?? '-'} | ${ghRef.workflowName} #${ghRef.number} | ${ghRef.displayTitle.slice(0, 50)}`;
      console.log(`           gh deploy wf: ${ghLine}`);
    }
  }

  if (mismatches > 0) {
    console.error(`\n${mismatches} lane(s) differ from gh deploy-workflow latest.`);
    process.exit(1);
  }
  console.log('\nAll lanes match gh deploy-workflow latest run numbers.');
}

main().catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
