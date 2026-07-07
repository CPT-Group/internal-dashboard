# Dependabot policy (CPT repos)

Synced from [cpt-standards](https://github.com/CPT-Group/cpt-standards). Update on **cpt-standards** `main`, then **`/cpt-standards-sync`**.

> **Canonical policy source:** [`std-github-actions` § Dependency-update policy](https://github.com/CPT-Group/cpt-standards/blob/main/standards/global/github-actions.md#dependency-update-policy-must--canonical).
> The Scope rules below are a synced mirror — if they ever disagree, the standard wins.

## Scope

- **Target branch:** `development` only. Never auto-merge to `test`, `staging`, or `production`.
- **Auto-merge:** patch and minor semver updates when CI passes.
- **Manual review:** semver-major, large GitHub Actions version jumps, and framework migrations (e.g. EF Core 8→9).

## Repository setup

1. [`.github/dependabot.yml`](../../.github/dependabot.yml) — `ignore` semver-major per ecosystem.
2. [`.github/workflows/dependabot-auto-merge.yml`](../../.github/workflows/dependabot-auto-merge.yml) — approve + `gh pr merge --auto --squash`.
3. GitHub **Settings → General → Allow auto-merge** enabled.
4. Optional secret **`DEPENDABOT_MERGE_TOKEN`** if `development` requires one approving review and the default `GITHUB_TOKEN` cannot approve.

## CI gates

| Repo | Required check (typical) |
|------|---------------------------|
| cpt-internal-tools | `CI - Build & Lint` |
| cpt-azure-functions-api | `CI - Build & Test` |
| cpt-ef-postgres-migrations | `CI - Build & Test Migrations` |
| cpt-infra | `fmt · validate · tflint` |
| cpt-nuget-libraries | `ci-development` / PR CI |

Platform CD hub (UI): [PLATFORM-CD-AND-INFRA.md](https://github.com/CPT-Group/cpt-internal-tools/blob/development/docs/repo-specific/deployment/PLATFORM-CD-AND-INFRA.md).
