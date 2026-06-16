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
import { parseEnvironmentFromJobNames } from '@/utils/resolveDeployRunEnvironment';

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

function testAzfDeployVersionInProgressNotOnDevLane() {
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
      resolvedEnvironment: 'stg',
    },
  ];

  const dev = findLatestRunForDeployLane(repo, 'dev', runs, laneSelection(repo, 'dev'));
  assert.equal(dev?.workflowId, 285805316, 'dev lane should keep Dev Fast, not Deploy Version');
  assert.equal(dev?.status, 'completed');

  const stg = findLatestRunForDeployLane(repo, 'stg', runs, laneSelection(repo, 'stg'));
  assert.ok(stg, 'stg lane should pick in-progress Deploy Version');
  assert.equal(stg.workflowId, 285805315);
  assert.equal(stg.resolvedEnvironment, 'stg');
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
      resolvedEnvironment: 'prod',
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
      resolvedEnvironment: 'dev',
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

function testInternalToolsTstBuildInProgressOnTstLane() {
  const repo = 'cpt-internal-tools';
  const runs: FixtureRun[] = [
    {
      workflowId: 285829491,
      headBranch: 'development',
      status: 'in_progress',
      conclusion: null,
      updatedAt: runIso(1),
      resolvedEnvironment: 'tst',
    },
  ];

  const tst = findLatestRunForDeployLane(repo, 'tst', runs, laneSelection(repo, 'tst'));
  assert.ok(tst, 'tst lane should pick in-progress TST Build on development');
  assert.equal(tst.workflowId, 285829491);

  const dev = findLatestRunForDeployLane(repo, 'dev', runs, laneSelection(repo, 'dev'));
  assert.equal(dev, undefined, 'dev lane must not absorb TST Build');
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
      resolvedEnvironment: 'tst',
    },
    {
      workflowId: 285810381,
      headBranch: 'development',
      status: 'completed',
      conclusion: 'failure',
      updatedAt: runIso(1),
      resolvedEnvironment: 'tst',
    },
  ];

  const picked = findLatestRunForDeployLane(repo, 'tst', runs, laneSelection(repo, 'tst'));
  assert.ok(picked, 'EF tst lane should pick a run');
  assert.equal(picked.workflowId, 285810381);
  assert.equal(picked.conclusion, 'failure');
}

function testInternalToolsDeployVersionResolvesByEnvNotBranch() {
  const repo = 'cpt-internal-tools';
  const runs: FixtureRun[] = [
    {
      workflowId: 285829489,
      headBranch: 'development',
      status: 'completed',
      conclusion: 'success',
      updatedAt: runIso(2),
      resolvedEnvironment: 'stg',
    },
    {
      workflowId: 285829489,
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

function testParseEnvironmentFromJobNames() {
  assert.equal(
    parseEnvironmentFromJobNames(['deploy', 'Post-Deploy Health Check (stg) / Resolve Environment']),
    'stg'
  );
  assert.equal(
    parseEnvironmentFromJobNames(['Post-Deploy Health Check (prd) / Verify Deployment Health']),
    'prod'
  );
}

function testIdleWindowHelper() {
  const nowMs = Date.now();
  const oneDayAgo = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const eightDaysAgo = new Date(nowMs - 8 * 24 * 60 * 60 * 1000).toISOString();

  assert.equal(isWithinDeployIdleWindow(oneDayAgo, nowMs, 7), true);
  assert.equal(isWithinDeployIdleWindow(eightDaysAgo, nowMs, 7), false);
}

function main() {
  testAzfDeployVersionInProgressNotOnDevLane();
  testAzfDevCompletedStillUsesDevFastPrimary();
  testInternalToolsDevFastInProgress();
  testInternalToolsTstBuildInProgressOnTstLane();
  testInternalToolsDeployVersionResolvesByEnvNotBranch();
  testEfTstFailureFromTstBuildArtifact();
  testParseEnvironmentFromJobNames();
  testIdleWindowHelper();
  console.log('test-deploy-lane-mapping: all assertions passed');
}

main();
