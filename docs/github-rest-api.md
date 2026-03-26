# GitHub REST API — documentation pointer

This file is a **local index** for the NOVA / internal-dashboard team. The canonical, always-up-to-date reference is GitHub’s own documentation.

**Official documentation (start here):** [GitHub REST API documentation](https://docs.github.com/en/rest)

---

## What the REST API is

The GitHub REST API lets you **create integrations, read and write data, and automate workflows** over HTTPS. See [About the REST API](https://docs.github.com/en/rest/about-the-rest-api/about-the-rest-api).

---

## Recommended reading (core)

| Topic | Link |
|--------|------|
| Quickstart | [Quickstart for GitHub REST API](https://docs.github.com/en/rest/quickstart) |
| Getting started | [Getting started with the REST API](https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api) |
| Authenticating | [Authenticating to the REST API](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api) |
| Keep tokens safe | [Keeping your API credentials secure](https://docs.github.com/en/rest/authentication/keeping-your-api-credentials-secure) |
| Best practices | [Best practices for using the REST API](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api) |
| Rate limits | [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) |
| Pagination | [Using pagination in the REST API](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api) |
| Troubleshooting | [Troubleshooting the REST API](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api) |

---

## API shape and versions

| Topic | Link |
|--------|------|
| REST vs GraphQL | [Comparing GitHub's REST API and GraphQL API](https://docs.github.com/en/rest/about-the-rest-api/comparing-githubs-rest-api-and-graphql-api) |
| API versions | [API Versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions) |
| Breaking changes | [Breaking changes](https://docs.github.com/en/rest/about-the-rest-api/breaking-changes) |
| OpenAPI description | [About the OpenAPI description for the REST API](https://docs.github.com/en/rest/about-the-rest-api/about-the-openapi-description-for-the-rest-api) |

---

## Libraries and scripting

| Topic | Link |
|--------|------|
| Official / community libraries | [Libraries for the REST API](https://docs.github.com/en/rest/using-the-rest-api/libraries-for-the-rest-api) |
| JavaScript (Octokit.js) | [Scripting with the REST API and JavaScript](https://docs.github.com/en/rest/guides/scripting-with-the-rest-api-and-javascript) |
| Ruby (Octokit.rb) | [Scripting with the REST API and Ruby](https://docs.github.com/en/rest/guides/scripting-with-the-rest-api-and-ruby) |

---

## Related topics

| Topic | Link |
|--------|------|
| Webhooks (incoming events) | [GitHub Webhooks documentation](https://docs.github.com/en/webhooks) — see also **`docs/github-webhooks.md`** in this repo |
| REST: repository webhooks | [REST API — Webhooks for a repository](https://docs.github.com/en/rest/repos/webhooks) |

---

## Relationship to this repo

This internal-dashboard app does **not** ship GitHub REST API clients by default. Use this document as a **bookmark and checklist** for scripts, automation, or future features that call GitHub (for example deployment status, repository metadata, or org tooling).
