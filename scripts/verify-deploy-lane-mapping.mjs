/**
 * CLI check: per-lane branch + workflow mapping vs GitHub Actions (no UI).
 * Usage: node scripts/verify-deploy-lane-mapping.mjs [repo-slug]
 * Loads `.env.local` for token; never prints secrets.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const runner = join(root, 'scripts', 'verify-deploy-lane-mapping.runner.ts');
const repo = process.argv[2];

const args = ['tsx', runner];
if (repo) args.push(repo);

const result = spawnSync('npx', args, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status === 0 ? 0 : 1);
