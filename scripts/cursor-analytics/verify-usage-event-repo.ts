/**
 * Fixture checks for `extractUsageEventRepoFromRow` (Cursor Admin usage-event shapes).
 * Run: `npm run test:cursor-usage-event-repo`
 */
import assert from 'node:assert/strict';

import { extractUsageEventRepoFromRow } from '../../src/utils/cursorUsageEventRepo';

const cases: { name: string; row: Record<string, unknown>; expected: string }[] = [
  {
    name: 'flat owner/repo',
    row: { repo: 'CPT-Group/internal-dashboard' },
    expected: 'CPT-Group/internal-dashboard',
  },
  {
    name: 'nested metadata.repository.full_name',
    row: { metadata: { repository: { full_name: 'CPT-Group/foo' } } },
    expected: 'CPT-Group/foo',
  },
  {
    name: 'https github URL',
    row: { remoteUrl: 'https://github.com/CPT-Group/bar.git' },
    expected: 'CPT-Group/bar',
  },
  {
    name: 'ssh git@github.com',
    row: { gitRepo: 'git@github.com:CPT-Group/baz.git' },
    expected: 'CPT-Group/baz',
  },
  {
    name: 'Windows path under Github-CPT-Group',
    row: { projectPath: 'C:\\local_dev\\Github-CPT-Group\\internal-dashboard' },
    expected: 'Github-CPT-Group/internal-dashboard',
  },
  {
    name: 'no repo',
    row: { email: 'a@b.com', chargedCents: 1 },
    expected: '',
  },
];

for (const c of cases) {
  const got = extractUsageEventRepoFromRow(c.row);
  assert.equal(got, c.expected, c.name);
}

console.log(`verify-usage-event-repo: ${cases.length} cases OK`);
