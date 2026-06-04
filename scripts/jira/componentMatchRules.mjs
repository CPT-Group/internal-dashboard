/**
 * Fuzzy component suggestions for CPT Jira tickets (summary + issuetype + labels).
 * Canonical names align with dev-board components in JIRA_OPERATIONAL.ts + NOVA extras.
 */

/** @typedef {'high' | 'medium' | 'low' | 'none'} MatchConfidence */

/**
 * @typedef {Object} ComponentSuggestion
 * @property {string} componentName
 * @property {MatchConfidence} confidence
 * @property {number} score
 * @property {string[]} matchedKeywords
 */

/** Keywords → canonical component name (first match wins by rule order after sort by weight). */
export const COMPONENT_KEYWORD_RULES = [
  {
    componentName: 'ATLAS',
    weight: 5,
    projects: ['NOVA'],
    keywords: [
      'zion',
      'atlas',
      'data manager',
      'internal tools',
      'internal-tools',
      'cpt-internal-tools',
      'duplicate check',
      'dupe check',
      'address enrichment',
      'enrichment',
      'column_quality',
      'premailing',
      'heat meter',
    ],
  },
  {
    componentName: 'Internal Tools',
    weight: 3,
    projects: ['NOVA'],
    keywords: ['internal tool', 'internal dashboard', 'confluence sync', 'cursor analytics'],
  },
  {
    componentName: 'Static Website',
    weight: 4,
    keywords: [
      'static website',
      'static site',
      'purchase website url',
      'post order to website',
      'website url',
      'create static website',
    ],
  },
  {
    componentName: 'Interactive Website',
    weight: 4,
    keywords: ['interactive website', 'interactive site', 'create interactive website'],
  },
  {
    componentName: 'Case Database',
    weight: 4,
    keywords: ['case database', 'create database', 'cleanclaims', 'clean claims', 'case db'],
  },
  {
    componentName: 'Web Database',
    weight: 3,
    keywords: ['web database', 'web db', 'website db'],
  },
  {
    componentName: 'Downloader',
    weight: 4,
    keywords: ['downloader', 'download request'],
  },
  {
    componentName: 'Weekly Reports',
    weight: 4,
    keywords: ['weekly report', 'cancel weekly report', 'create weekly report'],
  },
  {
    componentName: 'NCOA/ACS',
    weight: 4,
    keywords: ['ncoa', 'acs', 'ncoa/acs'],
  },
  {
    componentName: 'Docket Update',
    weight: 4,
    keywords: ['docket update', 'docket'],
  },
  {
    componentName: 'Database Migration',
    weight: 4,
    keywords: ['database migration', 'db migration', 'postgres migration', 'ef-postgres'],
    projects: ['NOVA', 'CM', 'OPRD'],
  },
  {
    componentName: 'Shut Down Service',
    weight: 3,
    keywords: ['shut down service', 'shutdown service'],
  },
  {
    componentName: 'Data Analysis',
    weight: 3,
    keywords: ['data analysis', 'data team'],
    projects: ['CM', 'OPRD'],
  },
  {
    componentName: 'Website',
    weight: 2,
    keywords: ['website update', 'website tag', 'website testing', 'reset test users'],
    projects: ['CM'],
  },
  {
    componentName: 'SCP',
    weight: 3,
    keywords: ['scp'],
  },
  {
    componentName: 'Update Clean Claims',
    weight: 4,
    keywords: ['update clean claims', 'clean claims update'],
    projects: ['OPRD'],
  },
];

/** Jira component id by project + canonical name (from GET /project/{key}/components). */
export const COMPONENT_IDS_BY_PROJECT = {
  NOVA: {
    ATLAS: '10440',
    'Case Database': '10230',
    'Docket Update': '10229',
    Downloader: '10228',
    'Interactive Website': '10227',
    'Internal Tools': '10263',
    'NCOA/ACS': '10226',
    'Shut Down Service': '10225',
    'Static Website': '10224',
    'Web Database': '10223',
    'Weekly Reports': '10222',
  },
  CM: {
    'Admin Accounting': '10334',
    'Case Database': '10020',
    'Case Setup': '10329',
    'Client/Counsel Communication': '10333',
    'Data Analysis': '10130',
    'Data Analysis/Calculations': '10330',
    Disbursement: '10332',
    Downloader: '10134',
    'Interactive Website': '10017',
    'Internal Meetings': '10336',
    'NCOA/ACS': '10019',
    'Notice Prep/Mailing': '10331',
    Reports: '10335',
    SCP: '10135',
    'Shut Down Service': '10022',
    'Static Website': '10016',
    'Web Database': '10136',
    'Weekly Reports': '10021',
  },
  OPRD: {
    'Case Database': '10000',
    'Data Analysis': '10003',
    'Docket Update': '10156',
    Downloader: '10140',
    'Interactive Website': '10125',
    'NCOA/ACS': '10131',
    SCP: '10141',
    'Shut Down Service': '10127',
    'Static Website': '10132',
    'Update Clean Claims': '10189',
    'Web Database': '10001',
    'Weekly Reports': '10002',
  },
};

export function normalizeMatchText(issue) {
  const parts = [
    issue.fields?.summary ?? '',
    issue.fields?.issuetype?.name ?? '',
    ...(issue.fields?.labels ?? []),
  ];
  return parts.join(' ').toLowerCase().replace(/[^a-z0-9/]+/g, ' ');
}

/**
 * @param {string} projectKey
 * @param {{ fields?: { summary?: string, issuetype?: { name?: string }, labels?: string[] } }} issue
 * @returns {ComponentSuggestion}
 */
export function suggestComponent(projectKey, issue) {
  const text = normalizeMatchText(issue);
  const project = projectKey.toUpperCase();

  let best = /** @type {ComponentSuggestion | null} */ (null);

  for (const rule of COMPONENT_KEYWORD_RULES) {
    if (rule.projects && !rule.projects.includes(project)) continue;
    const catalog = COMPONENT_IDS_BY_PROJECT[project];
    if (!catalog || !catalog[rule.componentName]) continue;

    const matchedKeywords = rule.keywords.filter((kw) => text.includes(kw.toLowerCase()));
    if (matchedKeywords.length === 0) continue;

    const score = matchedKeywords.reduce((sum, kw) => sum + rule.weight, 0);
    if (!best || score > best.score) {
      best = {
        componentName: rule.componentName,
        score,
        matchedKeywords,
        confidence: 'none',
      };
    }
  }

  if (!best) {
    return { componentName: '', confidence: 'none', score: 0, matchedKeywords: [] };
  }

  if (best.score >= 8 || best.matchedKeywords.some((kw) => text.includes(kw) && kw.length >= 12)) {
    best.confidence = 'high';
  } else if (best.score >= 4) {
    best.confidence = 'medium';
  } else {
    best.confidence = 'low';
  }

  return best;
}

/**
 * @param {string} projectKey
 * @param {string} componentName
 * @returns {string | null}
 */
export function componentIdForProject(projectKey, componentName) {
  const project = projectKey.toUpperCase();
  return COMPONENT_IDS_BY_PROJECT[project]?.[componentName] ?? null;
}

export const CONFIDENCE_RANK = { none: 0, low: 1, medium: 2, high: 3 };

/** @param {MatchConfidence} conf @param {MatchConfidence} min */
export function meetsMinConfidence(conf, min) {
  return CONFIDENCE_RANK[conf] >= CONFIDENCE_RANK[min];
}
