import type { GitHubWebhookEventRecord } from '@/types/github/GitHubWebhook';
import {
  GITHUB_WEBHOOK_CACHE_MAX_AGE_MS,
  GITHUB_WEBHOOK_CACHE_MAX_EVENTS,
} from '@/constants';

const store: GitHubWebhookEventRecord[] = [];

function prune(): void {
  const cutoff = Date.now() - GITHUB_WEBHOOK_CACHE_MAX_AGE_MS;
  while (store.length > 0 && new Date(store[store.length - 1]!.receivedAt).getTime() < cutoff) {
    store.pop();
  }
  while (store.length > GITHUB_WEBHOOK_CACHE_MAX_EVENTS) {
    store.pop();
  }
}

export function pushGitHubWebhookEvent(
  record: Omit<GitHubWebhookEventRecord, 'receivedAt'> & { receivedAt?: string }
): void {
  const receivedAt = record.receivedAt ?? new Date().toISOString();
  const existing = store.findIndex((e) => e.deliveryId === record.deliveryId);
  if (existing >= 0) {
    store.splice(existing, 1);
  }
  store.unshift({ ...record, receivedAt });
  prune();
}

export function getGitHubWebhookEvents(): GitHubWebhookEventRecord[] {
  prune();
  return [...store];
}
