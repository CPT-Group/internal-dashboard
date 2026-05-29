export type DeployEnvironmentKey = 'dev' | 'tst' | 'stg' | 'prod';
export type DeployLaneKey = DeployEnvironmentKey | 'nonprod';

interface DeployLaneConfig {
  order: readonly DeployLaneKey[];
  labels: Partial<Record<DeployLaneKey, string>>;
}

const DEFAULT_LANE_CONFIG: DeployLaneConfig = {
  order: ['dev', 'tst', 'stg', 'prod'],
  labels: {
    dev: 'Dev',
    tst: 'Tst',
    stg: 'Stg',
    prod: 'Prod',
  },
};

const NUGET_LANE_CONFIG: DeployLaneConfig = {
  order: ['nonprod', 'prod'],
  labels: {
    nonprod: 'Non-Prod',
    prod: 'Prod',
  },
};

export interface DeployRunEnvironmentInput {
  headBranch: string | null;
  title: string | null;
}

function normalizeBranchName(branch: string | null): string {
  if (!branch) return '';
  return branch.trim().toLowerCase().replace(/^refs\/heads\//, '');
}

function isNugetRepo(repo: string): boolean {
  return repo.toLowerCase().includes('nuget-libraries');
}

function detectFromPromotionTitle(title: string | null): string | null {
  if (!title) return null;
  const normalized = title.trim();
  if (!normalized) return null;

  const arrowMatch = normalized.match(/→|->/);
  if (arrowMatch) {
    const parts = normalized.split(/→|->/).map((part) => part.trim());
    const target = parts.at(-1);
    return target && target !== '' ? target : null;
  }

  const promoteMatch = normalized.match(/\bto\b/i);
  if (promoteMatch) {
    const parts = normalized.split(/\bto\b/i).map((part) => part.trim());
    const target = parts.at(-1);
    return target && target !== '' ? target : null;
  }

  return null;
}

/**
 * Resolve deployment environment from GitHub's reported branch only.
 * We intentionally do not inspect run titles to avoid false positives from
 * branch names embedded in PR titles (for example "remove-stg-slots").
 */
export function detectDeployEnvironmentFromBranch(branch: string | null): DeployEnvironmentKey | null {
  const normalized = normalizeBranchName(branch);
  if (!normalized) return null;

  if (normalized === 'main' || normalized === 'master' || normalized === 'prod' || normalized === 'production') {
    return 'prod';
  }
  if (normalized === 'staging' || normalized === 'stg' || normalized === 'uat') {
    return 'stg';
  }
  if (normalized === 'test' || normalized === 'tst' || normalized === 'qa') {
    return 'tst';
  }
  if (normalized === 'development' || normalized === 'develop' || normalized === 'dev') {
    return 'dev';
  }

  return null;
}

export function detectDeployEnvironmentFromRun(input: DeployRunEnvironmentInput): DeployEnvironmentKey | null {
  const fromTitle = detectFromPromotionTitle(input.title);
  const resolved = fromTitle ?? input.headBranch;
  return detectDeployEnvironmentFromBranch(resolved);
}

export function getDeployLaneConfig(repo: string): DeployLaneConfig {
  if (isNugetRepo(repo)) return NUGET_LANE_CONFIG;
  return DEFAULT_LANE_CONFIG;
}

export function mapEnvironmentToLane(repo: string, env: DeployEnvironmentKey): DeployLaneKey {
  if (isNugetRepo(repo) && env !== 'prod') return 'nonprod';
  return env;
}
