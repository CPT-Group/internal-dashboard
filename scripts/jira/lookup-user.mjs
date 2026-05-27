import fs from 'node:fs';
const q = process.argv[2] ?? 'Jennifer Forst';
const env = fs.readFileSync('.env.local', 'utf8');
const get = (k) => {
  const l = env.split(/\r?\n/).find((x) => x.startsWith(`${k}=`));
  return l ? l.split('=').slice(1).join('=').replace(/^"|"$/g, '') : '';
};
const email = get('JAMES_EMAIL') || get('KYLE_EMAIL');
const token = get('JAMES_JIRA_TOKEN') || get('KYLE_JIRA_TOKEN');
const auth = Buffer.from(`${email}:${token}`).toString('base64');
const r = await fetch(
  `https://cptgroup.atlassian.net/rest/api/3/user/search?query=${encodeURIComponent(q)}&maxResults=10`,
  { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }
);
const users = await r.json();
for (const u of users) console.log(u.displayName, u.accountId, u.emailAddress ?? '');
