/**
 * Live Jira reconciliation for Dev Corner board accuracy.
 * Usage: npm run verify:operational-board
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const runner = join(root, 'scripts', 'verify-operational-board.runner.ts');

const result = spawnSync('npx', ['tsx', runner], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status === 0 ? 0 : 1);
