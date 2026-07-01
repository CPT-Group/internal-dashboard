import assert from 'node:assert/strict';
import {
  findLatestRunForDeployLane,
  getDeployLaneConfig,
  getNaLaneLabel,
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
import {
  cardHealthFromLaneStates,
  tagSeverityFromLaneStates,
  tagValueFromLaneStates,
} from '@/utils/githubDeployDisplay';
import {
  buildDeploymentLaneSnapshot,
  buildRunLaneSnapshot,
  laneStateFromDeploymentState,
  laneStateFromRunStatus,
} from '@/utils/githubDeployLaneSnapshots';

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
    { ...base, createdAt: runIso(9) },
    { ...base, createdAt: runIso(6) },
    {
      workflowId: P2P_PROMOTE_WORKFLOW_ID,
      headSha: sha,
      createdAt: runIso(3),
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

function testNugetTstBuildOnDevelopmentMapsToTstLane() {
  const repo = 'cpt-nuget-libraries';
  const runs: FixtureRun[] = [
    {
      workflowId: 288752702,
      headBranch: 'development',
      status: 'completed',
      conclusion: 'success',
      updatedAt: runIso(20),
    },
    {
      workflowId: 288752705,
      headBranch: 'development',
      status: 'completed',
      conclusion: 'success',
      updatedAt: runIso(5),
    },
  ];

  const dev = findLatestRunForDeployLane(repo, 'dev', runs, laneSelection(repo, 'dev'));
  assert.ok(dev);
  assert.equal(dev.workflowId, 288752702);

  const tst = findLatestRunForDeployLane(repo, 'tst', runs, laneSelection(repo, 'tst'));
  assert.ok(tst, 'TST Build dispatched from development should appear on Tst lane');
  assert.equal(tst.workflowId, 288752705);
}

function testNugetDevFastInProgressDoesNotStealTstLane() {
  const repo = 'cpt-nuget-libraries';
  const runs: FixtureRun[] = [
    {
      workflowId: 288752702,
      headBranch: 'development',
      status: 'in_progress',
      conclusion: null,
      updatedAt: runIso(1),
    },
    {
      workflowId: 288752705,
      headBranch: 'development',
      status: 'completed',
      conclusion: 'success',
      updatedAt: runIso(10),
    },
  ];

  const dev = findLatestRunForDeployLane(repo, 'dev', runs, laneSelection(repo, 'dev'));
  assert.ok(dev);
  assert.equal(dev.status, 'in_progress');

  const tst = findLatestRunForDeployLane(repo, 'tst', runs, laneSelection(repo, 'tst'));
  assert.ok(tst);
  assert.equal(tst.workflowId, 288752705);
}

function testNugetTstAutoMergeShowsAsActiveOnTstLane() {
  const repo = 'cpt-nuget-libraries';
  const runs: FixtureRun[] = [
    {
      workflowId: 301162091,
      headBranch: 'development',
      status: 'in_progress',
      conclusion: null,
      updatedAt: runIso(1),
    },
  ];

  const tst = findLatestRunForDeployLane(repo, 'tst', runs, laneSelection(repo, 'tst'));
  assert.ok(tst, 'TST Auto-Merge in progress should surface on Tst lane');
  assert.equal(tst.workflowId, 301162091);
}

function testP2pPromoteWaveIgnoresStaleSameShaRuns() {
  const sha = 'b68a19a08205bf4801c45f37a3b08b85ba946b64';
  const stalePromotes = Array.from({ length: 5 }, (_, i) => ({
    workflowId: P2P_PROMOTE_WORKFLOW_ID,
    headSha: sha,
    createdAt: runIso(120 + i),
    status: 'completed',
    conclusion: 'success' as const,
  }));
  const freshTst = {
    workflowId: P2P_PROMOTE_WORKFLOW_ID,
    headSha: sha,
    createdAt: runIso(1),
    status: 'completed',
    conclusion: 'success' as const,
  };
  const all = [...stalePromotes, freshTst];
  assert.equal(resolveP2pRunEnvironment(freshTst, all), 'tst');
}

function testCardHealthWhenProdFailsButDevSucceeded() {
  const laneStates = ['ok', 'ok', 'ok', 'failed'] as const;
  assert.equal(cardHealthFromLaneStates(laneStates), 'error');
  assert.equal(tagSeverityFromLaneStates(laneStates), 'danger');
  assert.equal(tagValueFromLaneStates(laneStates), 'failure');

  const devOnlyOk = ['ok', 'idle', 'idle', 'idle'] as const;
  assert.equal(cardHealthFromLaneStates(devOnlyOk), 'ok');
  assert.equal(tagSeverityFromLaneStates(devOnlyOk), 'success');
  assert.equal(tagValueFromLaneStates(devOnlyOk), 'success');
}

function testNugetStgProdRenderAsNaPackageLanes() {
  const repo = 'cpt-nuget-libraries';
  const config = getDeployLaneConfig(repo);
  // Package repo keeps a 4-lane layout but Stg/Prod are N/A (publish steps, not deploys).
  assert.deepEqual([...config.order], ['dev', 'tst', 'stg', 'prod']);
  assert.equal(getNaLaneLabel(repo, 'dev'), null, 'Dev is a real lane');
  assert.equal(getNaLaneLabel(repo, 'tst'), null, 'Tst is a real lane');
  assert.equal(getNaLaneLabel(repo, 'stg'), 'N/A — package repo');
  assert.equal(getNaLaneLabel(repo, 'prod'), 'N/A — package repo');

  // The former report-only Prod stub is gone: no workflow rule can match a Prod deploy lane.
  assert.equal(getPrimaryWorkflowIdsForDeployLane(repo, 'prod'), null);
  assert.equal(getPrimaryWorkflowIdsForDeployLane(repo, 'stg'), null);
}

function testStandardRepoHasNoNaLanes() {
  const repo = 'cpt-azure-functions-api';
  for (const lane of ['dev', 'tst', 'stg', 'prod'] as const) {
    assert.equal(getNaLaneLabel(repo, lane), null, `${lane} should be a real deploy lane`);
  }
}

function testP2pPromoteProdFromOnpremPrdDeployment() {
  const sha = 'b68a19a08205bf4801c45f37a3b08b85ba946b64';
  const run = {
    workflowId: P2P_PROMOTE_WORKFLOW_ID,
    headSha: sha,
    createdAt: runIso(1),
    status: 'completed',
    conclusion: 'success' as const,
  };
  const deployments = [
    {
      environment: 'prod' as const,
      sha: sha,
      createdAtMs: Date.parse(run.createdAt),
    },
  ];
  assert.equal(resolveP2pRunEnvironment(run, [run], deployments), 'prod');
}

// ---------------------------------------------------------------------------
// Lane-snapshot source tests (N/A regression fix): stg/prod ← Deployments API,
// dev/tst ← dedicated workflow run. These prove a real prior deploy never N/As.
// ---------------------------------------------------------------------------

function testDeploymentStateMapsToLanePill() {
  assert.equal(laneStateFromDeploymentState('success'), 'ok');
  assert.equal(laneStateFromDeploymentState('failure'), 'failed');
  assert.equal(laneStateFromDeploymentState('error'), 'failed');
  assert.equal(laneStateFromDeploymentState('in_progress'), 'running');
  assert.equal(laneStateFromDeploymentState('queued'), 'queued');
  assert.equal(laneStateFromDeploymentState('pending'), 'queued');
  assert.equal(laneStateFromDeploymentState('waiting'), 'queued');
  // Unknown / superseded → idle (never a misleading OK/Fail).
  assert.equal(laneStateFromDeploymentState('inactive'), 'idle');
  assert.equal(laneStateFromDeploymentState(null), 'idle');
}

function testRunStatusMapsToLanePill() {
  assert.equal(laneStateFromRunStatus('completed', 'success'), 'ok');
  assert.equal(laneStateFromRunStatus('completed', 'failure'), 'failed');
  // A deliberately-cancelled run is NOT a failure — it maps to the neutral `cancelled` pill.
  assert.equal(laneStateFromRunStatus('completed', 'cancelled'), 'cancelled');
  assert.equal(laneStateFromRunStatus('completed', 'timed_out'), 'failed');
  assert.equal(laneStateFromRunStatus('in_progress', null), 'running');
  assert.equal(laneStateFromRunStatus('queued', null), 'queued');
  assert.equal(laneStateFromRunStatus('waiting', null), 'queued');
}

function testEfStgDeploymentSnapshotIsOkNotNa() {
  // EF stg's latest deployment (06-30T16:18) succeeded — must surface as OK, not N/A, even
  // though the run is dozens of dev/tst runs ago (outside the recent-runs(30) window).
  const snapshot = buildDeploymentLaneSnapshot({
    lane: 'stg',
    env: 'stg',
    state: laneStateFromDeploymentState('success'),
    statusCreatedAt: '2026-06-30T16:27:04Z',
    deploymentCreatedAt: '2026-06-30T16:18:15Z',
    logUrl: 'https://github.com/CPT-Group/cpt-ef-postgres-migrations/actions/runs/28459252716/job/1',
  });
  assert.equal(snapshot.lane, 'stg');
  assert.equal(snapshot.state, 'ok');
  assert.equal(snapshot.createdAt, '2026-06-30T16:18:15Z');
  assert.equal(snapshot.updatedAt, '2026-06-30T16:27:04Z');
  assert.ok(snapshot.htmlUrl?.includes('/actions/runs/28459252716'));
}

function testEfTstBuildSnapshotShowsRealFailure() {
  // EF tst's dedicated TST Build Artifact latest run FAILED — must surface as failed, not N/A.
  const snapshot = buildRunLaneSnapshot({
    lane: 'tst',
    state: laneStateFromRunStatus('completed', 'failure'),
    createdAt: '2026-06-30T22:36:54Z',
    updatedAt: '2026-06-30T22:40:00Z',
    title: 'TST Build Artifact',
    branch: 'development',
    htmlUrl: 'https://github.com/CPT-Group/cpt-ef-postgres-migrations/actions/runs/28480357407',
  });
  assert.equal(snapshot.lane, 'tst');
  assert.equal(snapshot.state, 'failed');
  assert.equal(snapshot.branch, 'development');
}

function testDeployVersionLabelExtractedFromMergeTitle() {
  const snapshot = buildRunLaneSnapshot({
    lane: 'dev',
    state: 'ok',
    createdAt: '2026-06-30T23:00:00Z',
    updatedAt: '2026-06-30T23:05:00Z',
    title: 'Merge pull request #155 from CPT-Group/feature',
    branch: 'development',
    htmlUrl: 'https://example/actions/runs/1',
  });
  assert.equal(snapshot.deployVersionLabel, '#155');
}

function main() {
  testDeploymentStateMapsToLanePill();
  testRunStatusMapsToLanePill();
  testEfStgDeploymentSnapshotIsOkNotNa();
  testEfTstBuildSnapshotShowsRealFailure();
  testDeployVersionLabelExtractedFromMergeTitle();
  testAzfDevActiveDeployVersionWins();
  testAzfDevCompletedStillUsesDevFastPrimary();
  testInternalToolsDevFastInProgress();
  testInternalToolsDeployVersionResolvesByEnvNotBranch();
  testEfTstFailureFromTstBuildArtifact();
  testNugetTstBuildOnDevelopmentMapsToTstLane();
  testNugetDevFastInProgressDoesNotStealTstLane();
  testNugetTstAutoMergeShowsAsActiveOnTstLane();
  testP2pPromoteLanesByPredecessorOrder();
  testP2pResolvePromoteOrderHelper();
  testP2pPromoteWaveIgnoresStaleSameShaRuns();
  testP2pPromoteProdFromOnpremPrdDeployment();
  testNugetStgProdRenderAsNaPackageLanes();
  testStandardRepoHasNoNaLanes();
  testCardHealthWhenProdFailsButDevSucceeded();
  testIdleWindowHelper();
  console.log('test-deploy-lane-mapping: all assertions passed');
}

main();
