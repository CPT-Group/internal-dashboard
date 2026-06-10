# Agent guide — internal-dashboard

**Platform standards:** [README.md](./README.md) · [documentation.md](./documentation.md) · [azure.md](./azure.md)

**Profile:** https://github.com/CPT-Group/cpt-standards/blob/main/profiles/internal-dashboard.md

## Read first

1. [../../AGENTS.md](../../AGENTS.md) — Jira workflows, NOVA team, dashboard routes (repo root)
2. [Layout standard](https://github.com/CPT-Group/cpt-standards/blob/main/standards/repo-structures/internal-dashboard.md) — Next.js App Router layout
3. [React frontend standards](https://github.com/CPT-Group/cpt-standards/blob/main/standards/platforms/react-frontend-standards.md) — adapt for Next.js deltas in layout doc
4. **Feature delivery (golden standard):** [Tracer bullet delivery](https://github.com/CPT-Group/cpt-standards/blob/main/standards/global/tracer-bullet-delivery.md) (`std-tracer-bullet`) — smallest vertical slice, test-first core logic, verify on dev before widening. Profile: [internal-dashboard](https://github.com/CPT-Group/cpt-standards/blob/main/profiles/internal-dashboard.md).

## Task router

| Task | Start here | Notes |
|------|------------|-------|
| **Feature / story implementation** | [std-tracer-bullet](https://github.com/CPT-Group/cpt-standards/blob/main/standards/global/tracer-bullet-delivery.md) | Vertical slice + TDD; Next.js slice; separate cadence from ZION SWA; cite in plan/PR |

## Sibling repositories

| Repo | When to open |
|------|----------------|
| `cpt-internal-tools` | Shared React/theme patterns (separate product) |
| `cpt-standards` | Org-wide standards and sync |

## Hard rules

- **Separate cadence** — out of ZION deploy set; default branch is `main`.
- **Do not** assume Internal Tools SWA/CD pipelines apply here.
- Update [CHANGELOG.md](../../CHANGELOG.md) for substantive changes.
- **Tracer bullets:** All non-trivial feature work MUST follow [std-tracer-bullet](https://github.com/CPT-Group/cpt-standards/blob/main/standards/global/tracer-bullet-delivery.md) — one mergeable vertical slice at a time, Next.js vertical slice, verify before widening scope.
