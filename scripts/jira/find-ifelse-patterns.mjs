// Scan all automation rules and surface any that use branch/if-else/block component types,
// so we can copy a known-working structure instead of guessing.

import { AUTH, API, getRule } from './_jiraAuto.mjs';

const all = [];
let cursor = null;
do {
  const qs = new URLSearchParams({ limit: '100' });
  if (cursor) qs.set('cursor', cursor);
  const r = await fetch(`${API}/rule/summary?${qs}`, { headers: { Authorization: AUTH, Accept: 'application/json' } });
  const j = await r.json();
  all.push(...(j.data || []));
  cursor = null;
  if (j.links?.next) {
    const m = j.links.next.match(/cursor=([^&]+)/);
    if (m) cursor = decodeURIComponent(m[1]);
  }
} while (cursor);

const INTERESTING = /condition\.(container|block|if)|branch|advanced-branches|if-else|IF_BLOCK|CONDITION_BLOCK/i;

const hits = [];
for (const r of all) {
  try {
    const full = await getRule(r.uuid);
    const json = JSON.stringify(full.rule);
    if (INTERESTING.test(json)) {
      hits.push(r);
      const types = new Set();
      (function walk(x) {
        if (!x || typeof x !== 'object') return;
        if (x.type) types.add(x.type);
        if (x.component) types.add(`[${x.component}]`);
        for (const v of Array.isArray(x) ? x : Object.values(x)) walk(v);
      })(full.rule);
      console.log(`\n${r.uuid}  [${r.state}]  ${r.name}`);
      console.log('  component types:', [...types].filter(t => INTERESTING.test(t)).join(', '));
    }
  } catch (e) {
    // skip 404s
  }
}

console.log(`\nTotal rules inspected: ${all.length}; rules with branch/if-else: ${hits.length}`);
