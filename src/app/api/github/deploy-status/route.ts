import { GITHUB_DEPLOY_WORKFLOW_MONITORS } from '@/constants/GITHUB_DEPLOY_MONITORS';
import { fetchAllDeployWorkflowStatuses } from '@/services/github/fetchDeployWorkflowStatus';
import type { GitHubDeployWorkflowStatus } from '@/types/github/GitHubDeployStatus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Aggregates latest CD workflow runs for monitored CPT-Group repos (Actions API).
 * Preferred token order:
 * 1) `GITHUB_TOKEN_2` (current primary),
 * 2) `GITHUB_TOKEN_3`,
 * 3) `GITHUB_DEPLOY_READ_TOKEN` (legacy fallback).
 */
function hasTokenApiError(repos: GitHubDeployWorkflowStatus[]): boolean {
  return repos.some((row) => {
    if (!row.error) return false;
    const message = row.error.toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('gitHub 403'.toLowerCase()) ||
      message.includes('gitHub 401'.toLowerCase()) ||
      message.includes('bad credentials')
    );
  });
}

type DeployStatusTokenUsed = 'primary' | 'fallback2' | 'fallback3';

export async function GET(): Promise<Response> {
  const primaryToken = process.env.GITHUB_TOKEN_2?.trim();
  const fallbackToken2 = process.env.GITHUB_TOKEN_3?.trim();
  const fallbackToken3 = process.env.GITHUB_DEPLOY_READ_TOKEN?.trim();
  const tokenChain: Array<{ tokenUsed: DeployStatusTokenUsed; token: string }> = [
    primaryToken ? { tokenUsed: 'primary', token: primaryToken } : null,
    fallbackToken2 ? { tokenUsed: 'fallback2', token: fallbackToken2 } : null,
    fallbackToken3 ? { tokenUsed: 'fallback3', token: fallbackToken3 } : null,
  ].filter((entry): entry is { tokenUsed: DeployStatusTokenUsed; token: string } => Boolean(entry));

  if (tokenChain.length === 0) {
    return Response.json(
      {
        ok: false,
        message: 'Missing deploy tokens (expected order: GITHUB_TOKEN_2, GITHUB_TOKEN_3, GITHUB_DEPLOY_READ_TOKEN)',
        repos: [],
      },
      { status: 503 }
    );
  }

  for (let i = 0; i < tokenChain.length; i += 1) {
    const chainEntry = tokenChain[i];
    const repos = await fetchAllDeployWorkflowStatuses(chainEntry.token, GITHUB_DEPLOY_WORKFLOW_MONITORS);
    const hasApiError = hasTokenApiError(repos);
    const hasNextToken = i < tokenChain.length - 1;
    if (!hasApiError || !hasNextToken) {
      return Response.json({ ok: true, repos, tokenUsed: chainEntry.tokenUsed });
    }
  }

  return Response.json({ ok: true, repos: [], tokenUsed: 'primary' });
}
