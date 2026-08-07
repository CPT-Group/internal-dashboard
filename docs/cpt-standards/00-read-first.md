# Read first -- CPT-Group shared standards

> Synced from the `cpt-standards` hub by `/cpt-standards-sync`. **Do not hand-edit** -- this
> file is overwritten on the next sync. It is **routing only**; the canonical rules live in
> the hub.

This repository follows the organization-wide standards maintained in **cpt-standards**.

## Start here (hub, on GitHub)

| What | Link |
|---|---|
| Standards index (generated) | https://github.com/CPT-Group/cpt-standards/blob/main/standards/README.md |
| Agent guide (canonical) | https://github.com/CPT-Group/cpt-standards/blob/main/AGENTS.md |
| Per-repo applicability profiles | https://github.com/CPT-Group/cpt-standards/tree/main/profiles |
| Architecture decisions (ADRs) | https://github.com/CPT-Group/cpt-standards/tree/main/decisions |

## Before React / JavaScript / TypeScript work

Open [`react.md`](./react.md) **first** — it routes to the canonical React frontend standard and
states the **mandatory startup protocol** and the **compliance + permission-before-deviation**
rules that apply to every React / JS / TS / JSX / TSX change (human or AI agent).

## Before identity / audit / attribution work

Open [`identity.md`](./identity.md) **first** — it routes to the canonical identity-context standard
and states the **locked target audit architecture**, the **four identity roles**, and the
**prohibited patterns**. It applies to any change that records who did something, resolves an actor,
adds a stored procedure taking `p_identity_chain`, or writes an audit or log row.

Two things it settles up front: **audits record human interaction, logs record system actions — they
are not interchangeable**; and new audit writes go to the **`audit_logs_vault`** contract, **not** to
`internal_tools_app_shell.audit_logs`, which is a transitional legacy store.

## In this repo

- `docs/cpt-standards/AGENTS.md` -- this repo's own agent guide (repo-specific; **not** synced).
- `docs/cpt-standards/react.md` -- React/TS startup + compliance routing (synced from the hub).
- `docs/cpt-standards/identity.md` -- identity/audit/attribution contract + prohibited patterns (synced from the hub).
- `docs/cpt-standards/azure.md`, `database.md`, `documentation.md`, `dependabot.md` -- shared routing stubs synced from the hub.
- `docs/cpt-standards/standards-index.md` -- pointer to the hub's generated standards index.

Follow the hub standards; open the relevant canonical document above before making changes. Standards
are **mandatory** — do not knowingly deviate without explicit prior owner approval (see `react.md`).
