/**
 * Probe GitHub Actions deploy tokens locally (same endpoints as Dev Corner Two).
 *
 * Loads `.env.local` only — never prints token values.
 *
 * Usage: node scripts/test-github-deploy-tokens.mjs
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

/** Mirrors `src/constants/GITHUB_DEPLOY_MONITORS.ts` — keep in sync when workflow IDs change. */
const MONITORS = [
  { owner: 'CPT-Group', repo: 'cpt-azure-functions-api', workflowId: 235954278, short: 'azure-functions-api' },
  { owner: 'CPT-Group', repo: 'cpt-internal-tools', workflowId: 236281791, short: 'internal-tools' },
  { owner: 'CPT-Group', repo: 'cpt-nuget-libraries', workflowId: 235954510, short: 'nuget-libraries' },
  { owner: 'CPT-Group', repo: 'cpt-ef-postgres-migrations', workflowId: 236316341, short: 'ef-postgres-migrations' },
];

const TOKEN_ENVS = ['GITHUB_TOKEN_3', 'GITHUB_TOKEN_2', 'GITHUB_DEPLOY_READ_TOKEN'];

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'cpt-internal-dashboard-token-test',
  };
}

async function getJson(url, token) {
  const res = await fetch(url, { headers: headers(token), cache: 'no-store' });
  const text = await res.text();
  let snippet = '';
  try {
    const j = JSON.parse(text);
    if (typeof j.message === 'string') snippet = j.message.slice(0, 80);
  } catch {
    snippet = text.slice(0, 80);
  }
  return { status: res.status, snippet };
}

async function testWorkflowRuns(token, monitor) {
  const url = `https://api.github.com/repos/${monitor.owner}/${monitor.repo}/actions/workflows/${monitor.workflowId}/runs?per_page=1`;
  return getJson(url, token);
}

async function testWhoAmI(token) {
  return getJson('https://api.github.com/user', token);
}

async function main() {
  console.log('GitHub deploy token probe (reads .env.local; tokens are never printed)\n');

  for (const envName of TOKEN_ENVS) {
    const token = process.env[envName]?.trim();
    if (!token) {
      console.log(`${envName}: (not set)\n`);
      continue;
    }

    const who = await testWhoAmI(token);
    console.log(`${envName}:`);
    console.log(`  GET /user → ${who.status}${who.snippet ? ` — ${who.snippet}` : ''}`);

    let ok = 0;
    for (const m of MONITORS) {
      const r = await testWorkflowRuns(token, m);
      const pass = r.status === 200;
      if (pass) ok += 1;
      console.log(`  ${m.short} (${m.repo} wf ${m.workflowId}) → ${r.status}${r.snippet ? ` — ${r.snippet}` : ''}`);
    }
    console.log(`  Summary: ${ok}/${MONITORS.length} workflow list calls returned 200\n`);
  }

  console.log('Notes:');
  console.log('  • 404 on workflow runs usually means wrong workflow ID, repo moved, or token cannot see the repo.');
  console.log('  • 401 / 403 on /user means the token is invalid or expired.');
  console.log('  • Deploy route tries GITHUB_TOKEN_3, then GITHUB_TOKEN_2, then GITHUB_DEPLOY_READ_TOKEN.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
