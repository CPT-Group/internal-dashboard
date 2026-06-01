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

interface FixtureRun {
  workflowId: number;
  headBranch: string;
  status: string;
  conclusion: string | null;
  updatedAt: string;
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
      workflowId: 236316341,
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

function testIdleWindowHelper() {
  const nowMs = Date.now();
  const oneDayAgo = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const eightDaysAgo = new Date(nowMs - 8 * 24 * 60 * 60 * 1000).toISOString();

  assert.equal(isWithinDeployIdleWindow(oneDayAgo, nowMs, 7), true);
  assert.equal(isWithinDeployIdleWindow(eightDaysAgo, nowMs, 7), false);
}

function main() {
  testAzfDevActiveDeployVersionWins();
  testAzfDevCompletedStillUsesDevFastPrimary();
  testInternalToolsDevFastInProgress();
  testEfTstFailureFromTstBuildArtifact();
  testIdleWindowHelper();
  console.log('test-deploy-lane-mapping: all assertions passed');
}

main();
