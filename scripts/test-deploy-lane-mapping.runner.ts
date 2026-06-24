import assert from 'node:assert/strict';
import {
  findLatestRunForDeployLane,
  isWithinDeployIdleWindow,
  type DeployLaneKey,
} from '@/utils/githubDeployEnvironment';
import {
  getActiveWorkflowIdsForDeployLane,
  getPrimaryWorkflowIdsForDeployLane,
} from '@/constants/GITHUB_DEPLOY_LANE_WORKFLOWS';
import {
  P2P_DEV_FAST_WORKFLOW_ID,
  P2P_PROMOTE_WORKFLOW_ID,
  resolveP2pRunEnvironment,
} from '@/utils/p2pDeployEnvironment';

interface FixtureRun {
  workflowId: number;
  headBranch: string;
  status: string;
  conclusion: string | null;
  updatedAt: string;
  /** Deployments-API target env (new --ref development promotion model). */
  resolvedEnvironment?: 'dev' | 'tst' | 'stg' | 'prod';
}

function laneSelection(repo: string, lane: DeployLaneKey) {
  return {
    primaryWorkflowIds: getPrimaryWorkflowIdsForDeployLane(repo, lane),
    activeWorkflowIds: getActiveWorkflowIdsForDeployLane(repo, lane),
  };
}

function runIso(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

function testAzfDevActiveDeployVersionWins() {
  const repo = 'cpt-azure-functions-api';
  const runs: FixtureRun[] = [
    {
      workflowId: 285805316,
      headBranch: 'development',
      status: 'completed',
      conclusion: 'success',
      updatedAt: runIso(12),
    },
    {
      workflowId: 285805315,
      headBranch: 'development',
      status: 'in_progress',
      conclusion: null,
      updatedAt: runIso(2),
    },
  ];

  const picked = findLatestRunForDeployLane(repo, 'dev', runs, laneSelection(repo, 'dev'));
  assert.ok(picked, 'AZF dev lane should pick a run');
  assert.equal(picked.workflowId, 285805315);
  assert.equal(picked.status, 'in_progress');
}

function testAzfDevCompletedStillUsesDevFastPrimary() {
  const repo = 'cpt-azure-functions-api';
  const runs: FixtureRun[] = [
    {
      workflowId: 285805316,
      headBranch: 'development',
      status: 'completed',
      conclusion: 'success',
      updatedAt: runIso(10),
    },
    {
      workflowId: 285805315,
      headBranch: 'development',
      status: 'completed',
      conclusion: 'success',
      updatedAt: runIso(1),
    },
  ];

  const picked = findLatestRunForDeployLane(repo, 'dev', runs, laneSelection(repo, 'dev'));
  assert.ok(picked, 'AZF dev lane should pick a completed run');
  assert.equal(picked.workflowId, 285805316);
}

function testInternalToolsDevFastInProgress() {
  const repo = 'cpt-internal-tools';
  const runs: FixtureRun[] = [
    {
      workflowId: 285829490,
      headBranch: 'development',
      status: 'in_progress',
      conclusion: null,
      updatedAt: runIso(3),
    },
    {
      workflowId: 236281791,
      headBranch: 'development',
      status: 'completed',
      conclusion: 'success',
      updatedAt: runIso(7),
    },
  ];

  const picked = findLatestRunForDeployLane(repo, 'dev', runs, laneSelection(repo, 'dev'));
  assert.ok(picked, 'internal-tools dev lane should pick a run');
  assert.equal(picked.workflowId, 285829490);
  assert.equal(picked.status, 'in_progress');
}

function testEfTstFailureFromTstBuildArtifact() {
  const repo = 'cpt-ef-postgres-migrations';
  const runs: FixtureRun[] = [
    {
      workflowId: 285810377,
      headBranch: 'test',
      status: 'completed',
      conclusion: 'success',
      updatedAt: runIso(20),
    },
    {
      workflowId: 285810381,
      headBranch: 'test',
      status: 'completed',
      conclusion: 'failure',
      updatedAt: runIso(1),
    },
  ];

  const picked = findLatestRunForDeployLane(repo, 'tst', runs, laneSelection(repo, 'tst'));
  assert.ok(picked, 'EF tst lane should pick a run');
  assert.equal(picked.workflowId, 285810381);
  assert.equal(picked.conclusion, 'failure');
}

function testInternalToolsDeployVersionResolvesByEnvNotBranch() {
  // New setup: Deploy Version promotes every env from `--ref development`, so headBranch is always
  // 'development'. The Deployments-API resolvedEnvironment must route each run to the correct lane,
  // and development-branch Deploy Version runs must NOT be absorbed into the dev lane anymore.
  const repo = 'cpt-internal-tools';
  const runs: FixtureRun[] = [
    {
      workflowId: 285829489, // Deploy Version → stg (newer)
      headBranch: 'development',
      status: 'completed',
      conclusion: 'success',
      updatedAt: runIso(2),
      resolvedEnvironment: 'stg',
    },
    {
      workflowId: 285829489, // Deploy Version → tst (older)
      headBranch: 'development',
      status: 'completed',
      conclusion: 'success',
      updatedAt: runIso(8),
      resolvedEnvironment: 'tst',
    },
  ];

  const stg = findLatestRunForDeployLane(repo, 'stg', runs, laneSelection(repo, 'stg'));
  assert.ok(stg, 'stg lane should pick the resolved-stg Deploy Version run');
  assert.equal(stg.resolvedEnvironment, 'stg');

  const tst = findLatestRunForDeployLane(repo, 'tst', runs, laneSelection(repo, 'tst'));
  assert.ok(tst, 'tst lane should pick the resolved-tst Deploy Version run');
  assert.equal(tst.resolvedEnvironment, 'tst');

  const dev = findLatestRunForDeployLane(repo, 'dev', runs, laneSelection(repo, 'dev'));
  assert.equal(dev, undefined, 'dev lane must NOT absorb development-branch runs that deployed to tst/stg');
}

function testIdleWindowHelper() {
  const nowMs = Date.now();
  const oneDayAgo = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const eightDaysAgo = new Date(nowMs - 8 * 24 * 60 * 60 * 1000).toISOString();

  assert.equal(isWithinDeployIdleWindow(oneDayAgo, nowMs, 7), true);
  assert.equal(isWithinDeployIdleWindow(eightDaysAgo, nowMs, 7), false);
}

function testP2pPromoteLanesByPredecessorOrder() {
  const repo = 'cpt-group-p2p-go-service';
  const sha = '89bd9d23ee76da8117b4510c56afea0ff3974dcf';
  const runs: FixtureRun[] = [
    {
      workflowId: P2P_DEV_FAST_WORKFLOW_ID,
      headBranch: 'development',
      status: 'completed',
      conclusion: 'success',
      updatedAt: runIso(30),
      resolvedEnvironment: 'dev',
    },
    {
      workflowId: P2P_PROMOTE_WORKFLOW_ID,
      headBranch: 'development',
      status: 'completed',
      conclusion: 'success',
      updatedAt: runIso(10),
      resolvedEnvironment: 'tst',
    },
    {
      workflowId: P2P_PROMOTE_WORKFLOW_ID,
      headBranch: 'development',
      status: 'completed',
      conclusion: 'success',
      updatedAt: runIso(5),
      resolvedEnvironment: 'stg',
    },
    {
      workflowId: P2P_PROMOTE_WORKFLOW_ID,
      headBranch: 'development',
      status: 'completed',
      conclusion: 'failure',
      updatedAt: runIso(1),
      resolvedEnvironment: 'prod',
    },
  ];

  const dev = findLatestRunForDeployLane(repo, 'dev', runs, laneSelection(repo, 'dev'));
  assert.ok(dev);
  assert.equal(dev.workflowId, P2P_DEV_FAST_WORKFLOW_ID);

  const tst = findLatestRunForDeployLane(repo, 'tst', runs, laneSelection(repo, 'tst'));
  assert.ok(tst);
  assert.equal(tst.resolvedEnvironment, 'tst');

  const stg = findLatestRunForDeployLane(repo, 'stg', runs, laneSelection(repo, 'stg'));
  assert.ok(stg);
  assert.equal(stg.resolvedEnvironment, 'stg');

  const prod = findLatestRunForDeployLane(repo, 'prod', runs, laneSelection(repo, 'prod'));
  assert.ok(prod);
  assert.equal(prod.resolvedEnvironment, 'prod');
  assert.equal(prod.conclusion, 'failure');
}

function testP2pResolvePromoteOrderHelper() {
  const sha = '89bd9d23ee76da8117b4510c56afea0ff3974dcf';
  const base = {
    workflowId: P2P_PROMOTE_WORKFLOW_ID,
    headSha: sha,
    status: 'completed',
    conclusion: 'success' as const,
  };
  const all = [
    { ...base, createdAt: runIso(20) },
    { ...base, createdAt: runIso(10) },
    {
      workflowId: P2P_PROMOTE_WORKFLOW_ID,
      headSha: sha,
      createdAt: runIso(5),
      status: 'completed',
      conclusion: 'failure',
    },
  ];

  assert.equal(
    resolveP2pRunEnvironment({ ...all[0], createdAt: all[0].createdAt }, all),
    'tst'
  );
  assert.equal(
    resolveP2pRunEnvironment({ ...all[1], createdAt: all[1].createdAt }, all),
    'stg'
  );
  assert.equal(
    resolveP2pRunEnvironment({ ...all[2], createdAt: all[2].createdAt }, all),
    'prod'
  );
}

function main() {
  testAzfDevActiveDeployVersionWins();
  testAzfDevCompletedStillUsesDevFastPrimary();
  testInternalToolsDevFastInProgress();
  testInternalToolsDeployVersionResolvesByEnvNotBranch();
  testEfTstFailureFromTstBuildArtifact();
  testP2pPromoteLanesByPredecessorOrder();
  testP2pResolvePromoteOrderHelper();
  testIdleWindowHelper();
  console.log('test-deploy-lane-mapping: all assertions passed');
}

main();
