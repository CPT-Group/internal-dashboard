# Agent guide — internal-dashboard

**Platform standards:** [README.md](./README.md) · [documentation.md](./documentation.md) · [azure.md](./azure.md)

**Profile:** https://github.com/CPT-Group/cpt-standards/blob/main/profiles/internal-dashboard.md

## Read first

1. [../../AGENTS.md](../../AGENTS.md) — Jira workflows, NOVA team, dashboard routes (repo root)
2. [Layout standard](https://github.com/CPT-Group/cpt-standards/blob/main/standards/repo-structures/internal-dashboard.md) — Next.js App Router layout
3. [React frontend standards](https://github.com/CPT-Group/cpt-standards/blob/main/standards/platforms/react-frontend-standards.md) — adapt for Next.js deltas in layout doc

## Sibling repositories

| Repo | When to open |
|------|----------------|
| `cpt-internal-tools` | Shared React/theme patterns (separate product) |
| `cpt-standards` | Org-wide standards and sync |

## Hard rules

- **Separate cadence** — out of ZION deploy set; default branch is `main`.
- **Do not** assume Internal Tools SWA/CD pipelines apply here.
- Update [CHANGELOG.md](../../CHANGELOG.md) for substantive changes.
