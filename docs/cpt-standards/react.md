# React / TypeScript work — read before you start

> Synced from the `cpt-standards` hub by `/cpt-standards-sync`. **Do not hand-edit** -- this file is
> overwritten on the next sync. It is **routing + agent-startup only**; the canonical rules live in
> the hub and win over anything here.

Applies to any React / JavaScript / TypeScript / JSX / TSX work in this repository, for **human
developers and AI coding agents alike** (Claude Code, Cursor, Copilot, and others).

## Canonical authority

| What | Where (hub) |
|---|---|
| **React frontend standard** (components, state, effects, performance & correctness, AI-agent protocol) | https://github.com/CPT-Group/cpt-standards/blob/main/standards/platforms/react-frontend-standards.md |
| Frontend caching / data freshness (React Query, storage) | https://github.com/CPT-Group/cpt-standards/blob/main/standards/platforms/caching-standards.md |
| PrimeReact editable-grid performance | https://github.com/CPT-Group/cpt-standards/blob/main/standards/platforms/primereact-datatable-editable-grid-performance.md |
| Cross-stack performance ("measure before optimizing") | https://github.com/CPT-Group/cpt-standards/blob/main/standards/global/performance-standards.md |
| Org-wide AI-agent governance | https://github.com/CPT-Group/cpt-standards/blob/main/standards/global/ai-agent-standards.md |

The React standard's **§ 15** covers async concurrency, bundle/lazy-loading, effect/state/re-render
discipline, global-listener + storage + init-once rules, and hot-path JavaScript — organized as
**Mandatory / Conditional / Prohibited / Measurement**. Open it before planning React work.

## Mandatory startup protocol (agents and developers)

Before planning, generating, modifying, or reviewing React / JS / TS / JSX / TSX:

1. Open the **React frontend standard** above (and this repo's `AGENTS.md` / hub profile).
2. Resolve which rules apply to the files and task.
3. State the applicable standards in your plan.
4. Do the work within them.
5. Run a standards-compliance self-check before reporting done (standards read; no rule knowingly
   violated; no unauthorized suppression such as an `eslint-disable` of a hooks/a11y rule; required
   validation run; performance claims backed by before/after evidence; any approved deviation still in
   scope).

## Mandatory compliance and deviation protocol

These standards are **mandatory requirements, not optional suggestions.**

- **Follow all applicable rules.** Do **not** knowingly deviate from, bypass, weaken, reinterpret,
  suppress, or ignore a standard.
- **Permission before deviation.** If compliance appears impossible or materially harmful, **stop
  before making the conflicting change** and get explicit user/owner approval first. **Reporting a
  deviation after the fact does not satisfy this** — there is no retroactive permission. Record
  approved deviations per the hub AI-agent standard (an ADR with scope, owner, sunset).
- **Conflicts:** do not choose arbitrarily. Stop, name the exact conflict, the authorities, the
  affected files, and the compliant options, and ask for direction.
- **Non-interactive:** when approval is required but you cannot reach the user, **do not deviate** —
  leave the change unmade and report the item **BLOCKED** on approval.

Canonical detail: React standard **§ 19** *AI-agent compliance and deviation protocol* and **§ 15**
*Exception process*; org-wide framework in `ai-agent-standards.md` and `standards-governance.md`
(linked above).
