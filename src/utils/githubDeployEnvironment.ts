export type DeployEnvironmentKey = 'dev' | 'tst' | 'stg' | 'prod';

function normalizeBranchName(branch: string | null): string {
  if (!branch) return '';
  return branch.trim().toLowerCase().replace(/^refs\/heads\//, '');
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
