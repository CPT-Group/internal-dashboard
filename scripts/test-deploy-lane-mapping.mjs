/**
 * Fixture tests for deploy lane workflow mapping and active/primary selection.
 *
 * Usage: npm run test:deploy-lane-mapping
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const runner = join(root, 'scripts', 'test-deploy-lane-mapping.runner.ts');

const result = spawnSync('npx', ['tsx', runner], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status === 0 ? 0 : 1);
