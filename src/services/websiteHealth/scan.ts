import sql, { ConnectionPool } from 'mssql';
import type {
  WebsiteHealthMissingItem,
  WebsiteHealthSiteMapping,
  WebsiteHealthSiteResult,
  WebsiteHealthSummary,
} from '@/types';
import { getWebsiteHealthSiteMappings } from './config';

interface ScanOptions {
  sinceDays: number | null;
  refreshActiveSites?: boolean;
}

interface SubmittedRow {
  submissionId: number;
  confirmationNo: string | null;
  dateReceived: string;
  email: string | null;
}

type CleanClaimsMatchMode = 'submissionId' | 'confirmationNo';

interface CleanClaimsMatchStrategy {
  mode: CleanClaimsMatchMode;
  idColumn: string | null;
  confirmationColumn: string | null;
  submittedOnlineColumn: string | null;
}

interface ActiveSiteCache {
  loadedAt: number;
  mappings: WebsiteHealthSiteMapping[];
}

interface ActiveMappingsWithMeta {
  mappings: WebsiteHealthSiteMapping[];
  source: 'cache' | 'database' | 'fallback';
  loadedAt: string | null;
  stale: boolean;
}

const activeSiteCache: ActiveSiteCache = {
  loadedAt: 0,
  mappings: [],
};

interface DbServerConfig {
  server: string;
  user: string;
  password: string;
  port: number;
}

function parsePort(raw: string | undefined): number {
  const fallback = 1433;
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function readServerConfig(prefix: 'DB_' | 'PROD_DB_'): DbServerConfig {
  const server = process.env[`${prefix}SERVER`]?.trim();
  const user = process.env[`${prefix}USER`]?.trim();
  const password = process.env[`${prefix}PASSWORD`]?.trim();
  const port = parsePort(process.env[`${prefix}PORT`]?.trim());

  const missing: string[] = [];
  if (!server) missing.push(`${prefix}SERVER`);
  if (!user) missing.push(`${prefix}USER`);
  if (!password) missing.push(`${prefix}PASSWORD`);

  if (missing.length > 0) {
    throw new Error(`Missing required SQL env vars: ${missing.join(', ')}`);
  }

  return {
    server: server ?? '',
    user: user ?? '',
    password: password ?? '',
    port,
  };
}

function toPool(serverCfg: DbServerConfig): sql.config {
  return {
    server: serverCfg.server,
    database: 'master',
    user: serverCfg.user,
    password: serverCfg.password,
    port: serverCfg.port,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

function qIdentifier(name: string): string {
  return `[${name.replace(/\]/g, ']]')}]`;
}

async function fetchSubmittedRows(
  websitePool: ConnectionPool,
  websiteDbName: string,
  sinceDays: number | null
): Promise<SubmittedRow[]> {
  const db = qIdentifier(websiteDbName);
  const req = websitePool.request();
  req.input('sinceDays', sql.Int, sinceDays);

  const rs = await req.query<{
    submission_id: number;
    confirmation_no: string | null;
    date_received: Date;
    email: string | null;
  }>(`
    SELECT
      s.ID AS submission_id,
      TRY_CONVERT(nvarchar(256), s.ConfirmationNo) AS confirmation_no,
      s.DateReceived AS date_received,
      TRY_CONVERT(nvarchar(320), s.Email) AS email
    FROM ${db}.dbo.Submissions s
    WHERE s.DateReceived IS NOT NULL
      AND (
        s.Email IS NULL
        OR LOWER(LTRIM(RTRIM(TRY_CONVERT(nvarchar(320), s.Email)))) NOT LIKE '%@cptgroup.com%'
      )
      AND (@sinceDays IS NULL OR s.DateReceived >= DATEADD(DAY, -@sinceDays, GETDATE()))
    ORDER BY s.DateReceived DESC;
  `);

  return rs.recordset
    .map((row) => ({
      submissionId: Number(row.submission_id),
      confirmationNo: row.confirmation_no ? row.confirmation_no.trim() : null,
      dateReceived: row.date_received.toISOString(),
      email: row.email ?? null,
    }))
    .filter((row) => Number.isFinite(row.submissionId));
}

async function discoverCleanClaimsColumns(
  claimsPool: ConnectionPool,
  cleanClaimsDbName: string
): Promise<CleanClaimsMatchStrategy> {
  const db = qIdentifier(cleanClaimsDbName);
  const columnsRs = await claimsPool.request().query<{ column_name: string }>(`
    SELECT c.COLUMN_NAME AS column_name
    FROM ${db}.INFORMATION_SCHEMA.COLUMNS c
    WHERE c.TABLE_SCHEMA = 'dbo'
      AND c.TABLE_NAME = 'CleanClaims';
  `);

  const columns = new Set(columnsRs.recordset.map((row) => row.column_name.toLowerCase()));

  // Canonical relationship from downloader flows:
  // Submissions.ID (website DB) -> CleanClaims.MailingListID (2K16 DB).
  // Keep SubmissionId-style fallbacks for legacy/nonstandard case schemas.
  const idCandidates = [
    'MailingListID',
    'MailingListId',
    'MailingList_ID',
    'SubmissionId',
    'SubmissionID',
    'Submission_Id',
    'SubmissionsId',
  ];
  const confirmationCandidates = ['ConfirmationNo', 'ConfirmationNumber', 'Confirmation'];
  const flagCandidates = ['SubmittedOnline', 'IsSubmittedOnline'];
  const claimFiledOnlineCandidates = ['ClaimFiledOnline', 'FiledOnline', 'SubmittedOnline', 'IsSubmittedOnline'];

  const idColumn = idCandidates.find((c) => columns.has(c.toLowerCase()));
  const confirmationColumn =
    confirmationCandidates.find((c) => columns.has(c.toLowerCase())) ?? null;

  const submittedOnlineColumn =
    claimFiledOnlineCandidates.find((c) => columns.has(c.toLowerCase())) ??
    flagCandidates.find((c) => columns.has(c.toLowerCase())) ??
    null;

  if (idColumn) {
    return {
      mode: 'submissionId',
      idColumn,
      confirmationColumn,
      submittedOnlineColumn,
    };
  }

  if (confirmationColumn) {
    return {
      mode: 'confirmationNo',
      idColumn: null,
      confirmationColumn,
      submittedOnlineColumn,
    };
  }

  throw new Error(
    `Unable to find MailingListID/SubmissionId or ConfirmationNo columns on ${cleanClaimsDbName}.dbo.CleanClaims`
  );
}

function getMissingItemsBySubmissionId(
  submittedRows: SubmittedRow[],
  existingSubmissionIds: Set<number>
): WebsiteHealthMissingItem[] {
  return submittedRows
    .filter((row) => !existingSubmissionIds.has(row.submissionId))
    .map((row) => ({
      submissionId: row.submissionId,
      dateReceived: row.dateReceived,
      email: row.email,
    }));
}

function normalizeConfirmation(value: string): string {
  return value.trim().toLowerCase();
}

function getMissingItemsByConfirmation(
  submittedRows: SubmittedRow[],
  existingConfirmations: Set<string>
): WebsiteHealthMissingItem[] {
  return submittedRows
    .filter((row) => {
      const confirmation = row.confirmationNo;
      if (!confirmation || confirmation.trim().length === 0) {
        return true;
      }
      return !existingConfirmations.has(normalizeConfirmation(confirmation));
    })
    .map((row) => ({
      submissionId: row.submissionId,
      dateReceived: row.dateReceived,
      email: row.email,
    }));
}

async function fetchExistingSubmissionIds(
  claimsPool: ConnectionPool,
  cleanClaimsDbName: string,
  submissionIds: number[]
): Promise<Set<number>> {
  if (submissionIds.length === 0) {
    return new Set<number>();
  }

  const strategy = await discoverCleanClaimsColumns(claimsPool, cleanClaimsDbName);
  if (strategy.mode !== 'submissionId' || !strategy.idColumn) {
    return new Set<number>();
  }

  const idColumn = strategy.idColumn;
  const submittedOnlineColumn = strategy.submittedOnlineColumn;
  const db = qIdentifier(cleanClaimsDbName);
  const idExpr = `TRY_CONVERT(int, cc.${qIdentifier(idColumn)})`;
  const flagSql = submittedOnlineColumn
    ? ` AND (cc.${qIdentifier(submittedOnlineColumn)} = 1 OR cc.${qIdentifier(
        submittedOnlineColumn
      )} = 'true' OR cc.${qIdentifier(submittedOnlineColumn)} = 'True')`
    : '';

  const found = new Set<number>();
  const batchSize = 800;
  for (let i = 0; i < submissionIds.length; i += batchSize) {
    const batch = submissionIds.slice(i, i + batchSize);
    const req = claimsPool.request();
    const inParams: string[] = [];
    batch.forEach((id, index) => {
      const name = `id${i + index}`;
      inParams.push(`@${name}`);
      req.input(name, sql.Int, id);
    });

    const rs = await req.query<{ submission_id: number | null }>(`
      SELECT DISTINCT ${idExpr} AS submission_id
      FROM ${db}.dbo.CleanClaims cc
      WHERE ${idExpr} IN (${inParams.join(', ')})
      ${flagSql};
    `);

    rs.recordset.forEach((row) => {
      if (typeof row.submission_id === 'number' && Number.isFinite(row.submission_id)) {
        found.add(row.submission_id);
      }
    });
  }

  return found;
}

async function fetchExistingConfirmationNos(
  claimsPool: ConnectionPool,
  cleanClaimsDbName: string
): Promise<Set<string>> {
  const strategy = await discoverCleanClaimsColumns(claimsPool, cleanClaimsDbName);
  if (strategy.mode !== 'confirmationNo' || !strategy.confirmationColumn) {
    return new Set<string>();
  }

  const confirmationColumn = strategy.confirmationColumn;
  const submittedOnlineColumn = strategy.submittedOnlineColumn;
  const db = qIdentifier(cleanClaimsDbName);
  const confirmationExpr = `LTRIM(RTRIM(TRY_CONVERT(nvarchar(256), cc.${qIdentifier(
    confirmationColumn
  )})))`;
  const flagSql = submittedOnlineColumn
    ? ` AND (cc.${qIdentifier(submittedOnlineColumn)} = 1 OR cc.${qIdentifier(
        submittedOnlineColumn
      )} = 'true' OR cc.${qIdentifier(submittedOnlineColumn)} = 'True')`
    : '';

  const rs = await claimsPool.request().query<{ confirmation_no: string | null }>(`
    SELECT DISTINCT ${confirmationExpr} AS confirmation_no
    FROM ${db}.dbo.CleanClaims cc
    WHERE ${confirmationExpr} IS NOT NULL
      AND ${confirmationExpr} <> ''
    ${flagSql};
  `);

  const found = new Set<string>();
  rs.recordset.forEach((row) => {
    if (typeof row.confirmation_no === 'string' && row.confirmation_no.trim().length > 0) {
      found.add(normalizeConfirmation(row.confirmation_no));
    }
  });
  return found;
}

async function scanSite(
  websitePool: ConnectionPool,
  claimsPool: ConnectionPool,
  mapping: WebsiteHealthSiteMapping,
  sinceDays: number | null,
  includeMissingItems: boolean
): Promise<WebsiteHealthSiteResult & { missingItems: WebsiteHealthMissingItem[] }> {
  try {
    const submittedRows = await fetchSubmittedRows(websitePool, mapping.websiteDbName, sinceDays);
    const submittedIds = submittedRows.map((row) => row.submissionId);
    const strategy = await discoverCleanClaimsColumns(claimsPool, mapping.cleanClaimsDbName);
    const allMissingItems =
      strategy.mode === 'submissionId'
        ? getMissingItemsBySubmissionId(
            submittedRows,
            await fetchExistingSubmissionIds(claimsPool, mapping.cleanClaimsDbName, submittedIds)
          )
        : getMissingItemsByConfirmation(
            submittedRows,
            await fetchExistingConfirmationNos(claimsPool, mapping.cleanClaimsDbName)
          );
    const missingItems = includeMissingItems ? allMissingItems : [];
    const missingCount = missingItems.length;
    const submittedOnlineCount = submittedRows.length;
    const matchedInCleanClaimsCount = Math.max(0, submittedOnlineCount - allMissingItems.length);

    return {
      siteKey: mapping.siteKey,
      websiteDbName: mapping.websiteDbName,
      cleanClaimsDbName: mapping.cleanClaimsDbName,
      status: allMissingItems.length > 0 ? 'warning' : 'ok',
      submittedOnlineCount,
      matchedInCleanClaimsCount,
      missingCount: allMissingItems.length,
      missingItems,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      siteKey: mapping.siteKey,
      websiteDbName: mapping.websiteDbName,
      cleanClaimsDbName: mapping.cleanClaimsDbName,
      status: 'error',
      submittedOnlineCount: 0,
      matchedInCleanClaimsCount: 0,
      missingCount: 0,
      missingItems: [],
      errorMessage: message,
    };
  }
}

function buildSummary(
  runAt: string,
  sinceDays: number | null,
  activeMeta: Pick<WebsiteHealthSummary, 'activeSitesLoadedAt' | 'activeSitesSource' | 'activeSitesStale'>,
  results: WebsiteHealthSiteResult[]
): WebsiteHealthSummary {
  const totals = results.reduce(
    (acc, site) => {
      acc.totalSubmittedOnline += site.submittedOnlineCount;
      acc.totalMatchedInCleanClaims += site.matchedInCleanClaimsCount;
      acc.totalMissingInCleanClaims += site.missingCount;
      if (site.status === 'warning' || site.status === 'error') {
        acc.sitesWithIssues += 1;
      }
      return acc;
    },
    {
      sitesWithIssues: 0,
      totalSubmittedOnline: 0,
      totalMatchedInCleanClaims: 0,
      totalMissingInCleanClaims: 0,
    }
  );

  return {
    runAt,
    sinceDays,
    activeSitesLoadedAt: activeMeta.activeSitesLoadedAt,
    activeSitesSource: activeMeta.activeSitesSource,
    activeSitesStale: activeMeta.activeSitesStale,
    totalSitesChecked: results.length,
    sitesWithIssues: totals.sitesWithIssues,
    totalSubmittedOnline: totals.totalSubmittedOnline,
    totalMatchedInCleanClaims: totals.totalMatchedInCleanClaims,
    totalMissingInCleanClaims: totals.totalMissingInCleanClaims,
    results,
  };
}

function getActiveSitesTtlMs(): number {
  const raw = process.env.WEBSITE_HEALTH_ACTIVE_CASES_TTL_MIN?.trim();
  const min = raw ? Number.parseInt(raw, 10) : 20;
  const safeMin = Number.isNaN(min) || min < 1 ? 20 : min;
  return safeMin * 60 * 1000;
}

async function fetchActiveSiteMappingsFromDb(
  claimsPool: ConnectionPool
): Promise<WebsiteHealthSiteMapping[]> {
  const activeDb = process.env.WEBSITE_HEALTH_ACTIVE_CASES_DATABASE?.trim() || 'CPTMaster';
  const db = qIdentifier(activeDb);
  const rs = await claimsPool.request().query<{
    case_name: string;
    website_db_name: string;
    sql_name: string;
  }>(`
    SELECT
      TRY_CONVERT(nvarchar(512), o.CaseName) AS case_name,
      TRY_CONVERT(nvarchar(256), o.WebServerDBName) AS website_db_name,
      TRY_CONVERT(nvarchar(256), o.SQLName) AS sql_name
    FROM ${db}.dbo.OCPAutomation o
    WHERE ISNULL(o.Active, 0) = 1
    ORDER BY o.CaseName ASC;
  `);

  return rs.recordset
    .map((row) => ({
      siteKey: (row.case_name ?? '').trim(),
      websiteDbName: (row.website_db_name ?? '').trim(),
      cleanClaimsDbName: (row.sql_name ?? '').trim(),
    }))
    .filter((row) => row.siteKey.length > 0 && row.websiteDbName.length > 0 && row.cleanClaimsDbName.length > 0);
}

async function getActiveSiteMappings(
  claimsPool: ConnectionPool,
  refreshActiveSites: boolean
): Promise<ActiveMappingsWithMeta> {
  const now = Date.now();
  const ttlMs = getActiveSitesTtlMs();

  if (!refreshActiveSites && activeSiteCache.mappings.length > 0 && now - activeSiteCache.loadedAt < ttlMs) {
    return {
      mappings: activeSiteCache.mappings,
      source: 'cache',
      loadedAt: new Date(activeSiteCache.loadedAt).toISOString(),
      stale: false,
    };
  }

  try {
    const mappings = await fetchActiveSiteMappingsFromDb(claimsPool);
    if (mappings.length > 0) {
      activeSiteCache.mappings = mappings;
      activeSiteCache.loadedAt = now;
      return {
        mappings,
        source: 'database',
        loadedAt: new Date(now).toISOString(),
        stale: false,
      };
    }
  } catch {
    // Fall back below.
  }

  const fallback = getWebsiteHealthSiteMappings();
  return {
    mappings: fallback,
    source: 'fallback',
    loadedAt: activeSiteCache.loadedAt > 0 ? new Date(activeSiteCache.loadedAt).toISOString() : null,
    stale: activeSiteCache.mappings.length > 0,
  };
}

export async function runWebsiteHealthScan(options: ScanOptions): Promise<WebsiteHealthSummary> {
  const runAt = new Date().toISOString();

  const prodCfg = readServerConfig('PROD_DB_');
  const claimsCfg = readServerConfig('DB_');
  const websitePool = new sql.ConnectionPool(toPool(prodCfg));
  const claimsPool = new sql.ConnectionPool(toPool(claimsCfg));

  try {
    await Promise.all([websitePool.connect(), claimsPool.connect()]);
    const activeMeta = await getActiveSiteMappings(claimsPool, options.refreshActiveSites === true);
    const mappings = activeMeta.mappings;

    if (mappings.length === 0) {
      return {
        runAt,
        sinceDays: options.sinceDays,
        activeSitesLoadedAt: activeMeta.loadedAt,
        activeSitesSource: activeMeta.source,
        activeSitesStale: activeMeta.stale,
        totalSitesChecked: 0,
        sitesWithIssues: 1,
        totalSubmittedOnline: 0,
        totalMatchedInCleanClaims: 0,
        totalMissingInCleanClaims: 0,
        results: [
          {
            siteKey: 'config',
            websiteDbName: '(unset)',
            cleanClaimsDbName: '(unset)',
            status: 'error',
            submittedOnlineCount: 0,
            matchedInCleanClaimsCount: 0,
            missingCount: 0,
            errorMessage:
              'No Website Health site mappings configured from OCPAutomation and no fallback mapping was provided.',
          },
        ],
      };
    }

    const results: WebsiteHealthSiteResult[] = [];
    for (const mapping of mappings) {
      // Run sequentially to keep DB load predictable for production systems.
      // This is read-only and intentionally conservative.
      const result = await scanSite(websitePool, claimsPool, mapping, options.sinceDays, false);
      results.push({
        siteKey: result.siteKey,
        websiteDbName: result.websiteDbName,
        cleanClaimsDbName: result.cleanClaimsDbName,
        status: result.status,
        submittedOnlineCount: result.submittedOnlineCount,
        matchedInCleanClaimsCount: result.matchedInCleanClaimsCount,
        missingCount: result.missingCount,
        errorMessage: result.errorMessage,
      });
    }
    return buildSummary(
      runAt,
      options.sinceDays,
      {
        activeSitesLoadedAt: activeMeta.loadedAt,
        activeSitesSource: activeMeta.source,
        activeSitesStale: activeMeta.stale,
      },
      results
    );
  } finally {
    await Promise.allSettled([websitePool.close(), claimsPool.close()]);
  }
}

export async function getWebsiteHealthSiteDetails(
  siteKey: string,
  sinceDays: number | null
): Promise<WebsiteHealthSiteResult & { missingItems: WebsiteHealthMissingItem[] }> {
  const prodCfg = readServerConfig('PROD_DB_');
  const claimsCfg = readServerConfig('DB_');
  const websitePool = new sql.ConnectionPool(toPool(prodCfg));
  const claimsPool = new sql.ConnectionPool(toPool(claimsCfg));

  try {
    await Promise.all([websitePool.connect(), claimsPool.connect()]);
    const activeMeta = await getActiveSiteMappings(claimsPool, false);
    const mapping = activeMeta.mappings.find((m) => m.siteKey === siteKey);
    if (!mapping) {
      return {
        siteKey,
        websiteDbName: '(unknown)',
        cleanClaimsDbName: '(unknown)',
        status: 'error',
        submittedOnlineCount: 0,
        matchedInCleanClaimsCount: 0,
        missingCount: 0,
        missingItems: [],
        errorMessage: `Site not found in active case list: ${siteKey}`,
      };
    }

    const siteDetails = await scanSite(websitePool, claimsPool, mapping, sinceDays, true);
    return siteDetails;
  } finally {
    await Promise.allSettled([websitePool.close(), claimsPool.close()]);
  }
}

