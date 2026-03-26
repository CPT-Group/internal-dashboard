# GitHub Webhooks — documentation pointer

This file is a **local index** for the NOVA / internal-dashboard team. The canonical, always-up-to-date reference is GitHub’s own documentation.

**Official documentation (start here):** [GitHub Webhooks documentation](https://docs.github.com/en/webhooks)

---

## What webhooks are

Webhooks let integrations **react to events on GitHub** by sending HTTP notifications to a URL you control when those events occur (for example pushes, pull requests, issues). See [About webhooks](https://docs.github.com/en/webhooks/about-webhooks).

---

## Recommended reading order

| Topic | Link |
|--------|------|
| About webhooks | [About webhooks](https://docs.github.com/en/webhooks/about-webhooks) |
| Types of webhooks (repo, org, Marketplace, Sponsors, GitHub App) | [Types of webhooks](https://docs.github.com/en/webhooks/types-of-webhooks) |
| Create a webhook | [Creating webhooks](https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks) |
| Handle incoming deliveries | [Handling webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-webhook-deliveries) |
| Verify requests are from GitHub | [Validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) |
| Security and performance | [Best practices for using webhooks](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks) |
| Event names and JSON payloads | [Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads) |
| Private / internal endpoints | [Delivering webhooks to private systems](https://docs.github.com/en/webhooks/using-webhooks/delivering-webhooks-to-private-systems) |
| Debugging | [Troubleshooting webhooks](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/troubleshooting-webhooks) |

---

## Security note

When you implement a webhook receiver, **validate the payload** using the repository/org webhook secret so only GitHub can trigger your endpoint. Details: [Validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries).

---

## Relationship to this repo

This internal-dashboard app does **not** ship a GitHub webhook endpoint by default. Use this document as a **bookmark and checklist** if we add CI notifications, deployment hooks, or custom automation later.
