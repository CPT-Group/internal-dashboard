import type { WebsiteHealthSiteMapping } from '@/types';

interface JsonSiteMappingShape {
  siteKey?: string;
  websiteDbName?: string;
  cleanClaimsDbName?: string;
  deadlineDate?: string | null;
}

function parseJsonSiteMappings(raw: string): WebsiteHealthSiteMapping[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const mappings: WebsiteHealthSiteMapping[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const shape = item as JsonSiteMappingShape;
    const siteKey = typeof shape.siteKey === 'string' ? shape.siteKey.trim() : '';
    const websiteDbName = typeof shape.websiteDbName === 'string' ? shape.websiteDbName.trim() : '';
    const cleanClaimsDbName =
      typeof shape.cleanClaimsDbName === 'string' ? shape.cleanClaimsDbName.trim() : '';
    const deadlineDate =
      typeof shape.deadlineDate === 'string'
        ? shape.deadlineDate.trim() || null
        : shape.deadlineDate === null
          ? null
          : null;

    if (!siteKey || !websiteDbName || !cleanClaimsDbName) {
      continue;
    }

    mappings.push({ siteKey, websiteDbName, cleanClaimsDbName, deadlineDate });
  }

  return mappings;
}

function getFallbackMappings(): WebsiteHealthSiteMapping[] {
  const websiteDbName = process.env.PROD_DB_DATABASE?.trim();
  const cleanClaimsDbName =
    process.env.WEBSITE_HEALTH_DEFAULT_2K16_DB?.trim() || process.env.PROD_DB_DATABASE?.trim();

  if (!websiteDbName || !cleanClaimsDbName) {
    return [];
  }

  return [
    {
      siteKey: 'default',
      websiteDbName,
      cleanClaimsDbName,
    },
  ];
}

export function getWebsiteHealthSiteMappings(): WebsiteHealthSiteMapping[] {
  const raw = process.env.WEBSITE_HEALTH_SITE_MAP_JSON?.trim();
  if (raw) {
    const fromJson = parseJsonSiteMappings(raw);
    if (fromJson.length > 0) {
      return fromJson;
    }
  }

  return getFallbackMappings();
}

