/**
 * CLI check: per-lane branch + workflow mapping vs GitHub Actions (no UI).
 * Usage: node scripts/verify-deploy-lane-mapping.mjs [repo-slug]
 * Loads `.env.local` for token; never prints secrets.
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

const REPO = process.argv[2] ?? 'cpt-ef-postgres-migrations';
const OWNER = 'CPT-Group';

const LANE_BRANCH = {
  dev: ['development'],
  tst: ['test'],
  stg: ['staging'],
  prod: ['production', 'main'],
};

const LANE_WORKFLOWS = {
  'cpt-azure-functions-api': {
    dev: [285805316],
    tst: [285805319, 235954278, 285805315],
    stg: [235954278, 285805315],
    prod: [235954278, 285805315],
  },
  'cpt-ef-postgres-migrations': {
    dev: [285810378],
    tst: [285810381, 236316341, 285810377],
    stg: [236316341, 285810377],
    prod: [236316341, 285810377],
  },
};

const MONITOR_WORKFLOWS = {
  'cpt-azure-functions-api': [285805316, 285805319, 285805315, 235954278],
  'cpt-ef-postgres-migrations': [285810378, 285810381, 285810377, 236316341],
  'cpt-internal-tools': [236281791],
  'cpt-infra': [285242645],
  'cpt-nuget-libraries': [235954510],
};

function token() {
  return (
    process.env.GITHUB_TOKEN_3?.trim() ||
    process.env.GITHUB_TOKEN_2?.trim() ||
    process.env.GITHUB_DEPLOY_READ_TOKEN?.trim() ||
    ''
  );
}

function normalizeBranch(branch) {
  return (branch ?? '').trim().toLowerCase().replace(/^refs\/heads\//, '');
}

async function fetchRuns(t, workflowId) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${workflowId}/runs?per_page=50`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${t}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    throw new Error(`wf ${workflowId}: HTTP ${res.status}`);
  }
  const data = await res.json();
  return (data.workflow_runs ?? []).map((run) => ({
    workflowId,
    headBranch: run.head_branch,
    status: run.status,
    conclusion: run.conclusion,
    title: run.display_title ?? run.name,
    updatedAt: run.updated_at,
  }));
}

function pickLatest(runs, lane) {
  const branches = new Set(LANE_BRANCH[lane]);
  const laneWfs = LANE_WORKFLOWS[REPO]?.[lane];
  const workflows = new Set(
    laneWfs && laneWfs.length > 0 ? laneWfs : MONITOR_WORKFLOWS[REPO] ?? []
  );

  let latest;
  let latestMs = -Infinity;
  for (const run of runs) {
    if (!branches.has(normalizeBranch(run.headBranch))) continue;
    if (workflows.size > 0 && !workflows.has(run.workflowId)) continue;
    const ms = Date.parse(run.updatedAt);
    if (!Number.isFinite(ms) || ms < latestMs) continue;
    latestMs = ms;
    latest = run;
  }
  return latest;
}

async function main() {
  const t = token();
  if (!t) {
    console.error('No GITHUB_TOKEN_* in .env.local');
    process.exit(1);
  }
  const workflowIds = MONITOR_WORKFLOWS[REPO];
  if (!workflowIds) {
    console.error(`Unknown repo slug: ${REPO}`);
    process.exit(1);
  }

  const runs = (await Promise.all(workflowIds.map((id) => fetchRuns(t, id)))).flat();
  console.log(`\n${REPO} — ${runs.length} runs from ${workflowIds.length} workflow(s)\n`);

  for (const lane of ['dev', 'tst', 'stg', 'prod']) {
    const latest = pickLatest(runs, lane);
    if (!latest) {
      console.log(`${lane.toUpperCase().padEnd(4)} — (no run)`);
      continue;
    }
    const state =
      latest.status !== 'completed'
        ? latest.status
        : latest.conclusion ?? 'completed';
    console.log(
      `${lane.toUpperCase().padEnd(4)} — ${state} | wf ${latest.workflowId} | ${latest.headBranch} | ${latest.title?.slice(0, 60)}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
