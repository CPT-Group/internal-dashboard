/** Normalized row stored when GitHub POSTs to /api/webhooks/github. */
export interface GitHubWebhookEventRecord {
  /** X-GitHub-Delivery (unique per delivery). */
  deliveryId: string;
  receivedAt: string;
  /** X-GitHub-Event (e.g. push, pull_request, ping). */
  event: string;
  action?: string;
  repo: string;
  sender: string;
  ref?: string;
  /** Short human summary for the TV UI. */
  summary: string;
}
