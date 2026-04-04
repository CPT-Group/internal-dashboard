import { NextRequest } from 'next/server';
import type { WebsiteHealthSiteDetailsResponse } from '@/types';
import { getWebsiteHealthSiteDetails } from '@/services/websiteHealth/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseSinceDays(raw: string | null): number | null {
  if (!raw) return null;
  if (raw.toLowerCase() === 'all') return null;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) return null;
  return Math.min(parsed, 90);
}

export async function GET(request: NextRequest): Promise<Response> {
  const siteKey = request.nextUrl.searchParams.get('siteKey')?.trim() ?? '';
  if (!siteKey) {
    return Response.json({ ok: false, message: 'siteKey is required.' }, { status: 400 });
  }

  const sinceDays = parseSinceDays(request.nextUrl.searchParams.get('sinceDays'));
  try {
    const site = await getWebsiteHealthSiteDetails(siteKey, sinceDays);
    const response: WebsiteHealthSiteDetailsResponse = {
      ok: true,
      site,
    };
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, message }, { status: 500 });
  }
}

