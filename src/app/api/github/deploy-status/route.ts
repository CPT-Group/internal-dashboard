import { GITHUB_DEPLOY_WORKFLOW_MONITORS } from '@/constants/GITHUB_DEPLOY_MONITORS';
import { fetchAllDeployWorkflowStatuses } from '@/services/github/fetchDeployWorkflowStatus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Aggregates latest CD workflow runs for monitored CPT-Group repos (Actions API).
 * Requires `GITHUB_DEPLOY_READ_TOKEN` (PAT with `actions:read` on those repos; `repo` for private).
 */
export async function GET(): Promise<Response> {
  const token = process.env.GITHUB_DEPLOY_READ_TOKEN?.trim();
  if (!token) {
    return Response.json(
      {
        ok: false,
        message: 'Missing GITHUB_DEPLOY_READ_TOKEN',
        repos: [],
      },
      { status: 503 }
    );
  }

  const repos = await fetchAllDeployWorkflowStatuses(token, GITHUB_DEPLOY_WORKFLOW_MONITORS);
  return Response.json({ ok: true, repos });
}
