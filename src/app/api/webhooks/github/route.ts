import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';
import { pushGitHubWebhookEvent, getGitHubWebhookEvents } from '@/lib/githubWebhookCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verifyGitHubSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature?.startsWith('sha256=')) return false;
  const expected =
    'sha256=' + createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function parseBody(
  event: string,
  json: unknown
): {
  repo: string;
  sender: string;
  action?: string;
  ref?: string;
  summary: string;
} {
  const b = json as Record<string, unknown>;
  const repo =
    (b.repository as { full_name?: string } | undefined)?.full_name ?? 'unknown/repo';
  const sender = (b.sender as { login?: string } | undefined)?.login ?? '?';
  const action = typeof b.action === 'string' ? b.action : undefined;
  const ref = typeof b.ref === 'string' ? b.ref : undefined;

  if (event === 'ping') {
    return { repo, sender, action, ref, summary: `Webhook ping — ${repo}` };
  }
  if (event === 'push') {
    const n = Array.isArray(b.commits) ? b.commits.length : 0;
    return {
      repo,
      sender,
      ref,
      summary: `Push ${ref ?? ''} (${n} commit${n === 1 ? '' : 's'}) — ${repo} · ${sender}`,
    };
  }
  return {
    repo,
    sender,
    action,
    ref,
    summary: `${event}${action ? ` · ${action}` : ''} — ${repo} (${sender})`,
  };
}

async function notifyTeamsIfConfigured(text: string): Promise<void> {
  const url = process.env.GITHUB_WEBHOOK_CPT_GROUP?.trim();
  if (!url?.startsWith('http')) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 4000) }),
    });
  } catch {
    // Mirror is best-effort; webhook delivery still succeeded.
  }
}

export async function GET(): Promise<Response> {
  const events = getGitHubWebhookEvents();
  return Response.json({
    ok: true,
    events,
    count: events.length,
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const rawBody = await request.text();
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();

  if (secret) {
    const sig = request.headers.get('x-hub-signature-256');
    if (!verifyGitHubSignature(rawBody, sig, secret)) {
      return Response.json({ ok: false, message: 'Invalid signature' }, { status: 401 });
    }
  }

  let parsed: unknown;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return Response.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const event = request.headers.get('x-github-event') ?? 'unknown';
  const deliveryId = request.headers.get('x-github-delivery') ?? `local-${Date.now()}`;

  const { repo, sender, action, ref, summary } = parseBody(event, parsed);

  const line = `[GitHub] ${event}${action ? ` · ${action}` : ''} — ${summary}`;

  pushGitHubWebhookEvent({
    deliveryId,
    event,
    action,
    repo,
    sender,
    ref,
    summary: line,
  });

  await notifyTeamsIfConfigured(line);

  return Response.json({ ok: true, received: true });
}
