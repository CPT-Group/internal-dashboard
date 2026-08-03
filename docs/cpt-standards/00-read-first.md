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

## In this repo

- `docs/cpt-standards/AGENTS.md` -- this repo's own agent guide (repo-specific; **not** synced).
- `docs/cpt-standards/react.md` -- React/TS startup + compliance routing (synced from the hub).
- `docs/cpt-standards/azure.md`, `database.md`, `documentation.md`, `dependabot.md` -- shared routing stubs synced from the hub.
- `docs/cpt-standards/standards-index.md` -- pointer to the hub's generated standards index.

Follow the hub standards; open the relevant canonical document above before making changes. Standards
are **mandatory** — do not knowingly deviate without explicit prior owner approval (see `react.md`).
