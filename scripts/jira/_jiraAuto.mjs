import fs from 'node:fs';

const env = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/);
const get = k => {
  const l = env.find(x => x.startsWith(k + '='));
  return l ? l.split('=').slice(1).join('=').replace(/^"|"$/g, '') : '';
};
export const EMAIL = get('JAMES_EMAIL');
export const TOKEN = get('JAMES_JIRA_TOKEN');
export const BASE = get('JIRA_BASE_URL') || 'https://cptgroup.atlassian.net';
export const AUTH = 'Basic ' + Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');

const tenant = await fetch(`${BASE}/_edge/tenant_info`).then(r => r.json());
export const CLOUD_ID = tenant.cloudId;
export const API = `https://api.atlassian.com/automation/public/jira/${CLOUD_ID}/rest/v1`;

export async function getRule(uuid) {
  const r = await fetch(`${API}/rule/${uuid}`, { headers: { Authorization: AUTH, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`GET rule ${uuid} -> ${r.status} ${await r.text()}`);
  return r.json();
}

export async function putRule(uuid, payload) {
  const r = await fetch(`${API}/rule/${uuid}`, {
    method: 'PUT',
    headers: { Authorization: AUTH, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`PUT rule ${uuid} -> ${r.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

export const ROY_ID = '712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f';
export const BRANDON_ID = '712020:384111d1-8f9d-4155-8420-37ff1888d6c3';
export const CF_TECH_OWNER = 'customfield_10193';
export const CF_CASE_MANAGER = 'customfield_10194';
