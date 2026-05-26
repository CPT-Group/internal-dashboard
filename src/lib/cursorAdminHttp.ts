/**
 * Cursor Admin API HTTP layer — rate limiting, 429 backoff, ETag disk cache.
 * See https://cursor.com/docs/account/teams/admin-api (20 req/min team limit).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const CURSOR_API = 'https://api.cursor.com';

const DEFAULT_REQUESTS_PER_MINUTE = 18;
const MAX_429_RETRIES = 5;
const INITIAL_BACKOFF_MS = 2000;

export interface CursorAdminHttpPostResult {
  status: number;
  text: string;
  etag: string | null;
  /** True when served from ETag disk cache (304 path). */
  fromCache: boolean;
}

interface EtagCacheEntry {
  etag: string;
  body: string;
  fetchedAt: string;
}

/** Sliding window rate limiter (counts only network attempts, not 304 cache hits). */
class AdminRateLimiter {
  private readonly maxPerMinute: number;
  private timestamps: number[] = [];

  constructor(maxPerMinute: number) {
    this.maxPerMinute = maxPerMinute;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < 60_000);
    if (this.timestamps.length < this.maxPerMinute) {
      this.timestamps.push(now);
      return;
    }
    const oldest = this.timestamps[0];
    if (oldest === undefined) {
      this.timestamps.push(now);
      return;
    }
    const waitMs = 60_000 - (now - oldest) + 50;
    await sleep(waitMs);
    return this.waitForSlot();
  }
}

let sharedLimiter: AdminRateLimiter | null = null;

function getRateLimiter(): AdminRateLimiter {
  if (!sharedLimiter) {
    const raw = Number.parseInt(process.env.CURSOR_ANALYTICS_ADMIN_RPM ?? '', 10);
    const rpm = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_REQUESTS_PER_MINUTE;
    sharedLimiter = new AdminRateLimiter(rpm);
  }
  return sharedLimiter;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stableBodyKey(path: string, body: object): string {
  const hash = createHash('sha256')
    .update(`${path}\n${JSON.stringify(body)}`)
    .digest('hex')
    .slice(0, 32);
  return hash;
}

export function resolveCursorAdminHttpCacheDir(): string {
  const raw = process.env.CURSOR_ANALYTICS_HTTP_CACHE_DIR?.trim();
  if (raw && raw.length > 0) {
    return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  }
  return path.join(process.cwd(), 'kyleOutput', 'cursor-admin-http-cache');
}

async function readEtagCache(cacheDir: string, key: string): Promise<EtagCacheEntry | null> {
  try {
    const filePath = path.join(cacheDir, `${key}.json`);
    const text = await fs.readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as EtagCacheEntry;
    if (typeof o.etag !== 'string' || typeof o.body !== 'string') return null;
    return o;
  } catch {
    return null;
  }
}

async function writeEtagCache(cacheDir: string, key: string, entry: EtagCacheEntry): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, `${key}.json`);
  await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8');
}

function parseRetryAfterMs(retryAfter: string | null): number | null {
  if (!retryAfter) return null;
  const asNum = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(asNum) && asNum > 0) return asNum * 1000;
  const asDate = Date.parse(retryAfter);
  if (Number.isFinite(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : null;
  }
  return null;
}

export interface CursorAdminPostOptions {
  apiKey: string;
  path: string;
  body: object;
  /** When false, skip ETag disk cache (default true). */
  useEtagCache?: boolean;
}

/**
 * POST to Cursor Admin API with rate limiting, 429 exponential backoff, and optional ETag caching.
 */
export async function cursorAdminPost(options: CursorAdminPostOptions): Promise<CursorAdminHttpPostResult> {
  const { apiKey, path: apiPath, body, useEtagCache = true } = options;
  const auth = Buffer.from(`${apiKey}:`).toString('base64');
  const cacheDir = resolveCursorAdminHttpCacheDir();
  const cacheKey = stableBodyKey(apiPath, body);
  const cached = useEtagCache ? await readEtagCache(cacheDir, cacheKey) : null;

  let attempt = 0;
  while (attempt <= MAX_429_RETRIES) {
    await getRateLimiter().waitForSlot();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${auth}`,
    };
    if (cached?.etag) {
      headers['If-None-Match'] = cached.etag;
    }

    const res = await fetch(`${CURSOR_API}${apiPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (res.status === 304 && cached) {
      return {
        status: 200,
        text: cached.body,
        etag: cached.etag,
        fromCache: true,
      };
    }

    const text = await res.text();
    const etag = res.headers.get('etag');

    if (res.status === 429 && attempt < MAX_429_RETRIES) {
      const retryMs =
        parseRetryAfterMs(res.headers.get('retry-after')) ?? INITIAL_BACKOFF_MS * 2 ** attempt;
      await sleep(retryMs);
      attempt += 1;
      continue;
    }

    if (res.ok && etag && useEtagCache) {
      await writeEtagCache(cacheDir, cacheKey, {
        etag,
        body: text,
        fetchedAt: new Date().toISOString(),
      });
    }

    return {
      status: res.status,
      text,
      etag,
      fromCache: false,
    };
  }

  return {
    status: 429,
    text: JSON.stringify({ message: 'Rate limit exceeded after retries' }),
    etag: null,
    fromCache: false,
  };
}
