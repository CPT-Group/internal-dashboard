# Documentation standards (all ZION repos)

**Canonical standard:** [documentation-standards.md](https://github.com/CPT-Group/cpt-standards/blob/main/standards/global/documentation-standards.md) — naming, folder structure, document layout, synchronization.

**Quick layout:** [documentation-standards.md](https://github.com/CPT-Group/cpt-standards/blob/main/standards/global/documentation-standards.md)

This file is **synced from [cpt-standards](https://github.com/CPT-Group/cpt-standards)**. Do not edit long platform policy here — update **cpt-standards** `main`, then run **`/cpt-standards-sync`**.

## Required entry points (every app repo)

| Path | Purpose |
|------|---------|
| `docs/README.md` | Index |
| `docs/AGENTS.md` | Pointer → `docs/cpt-standards/AGENTS.md` |
| `docs/cpt-standards/README.md` | **Repo-specific** standards index (not overwritten by sync) |
| `docs/cpt-standards/AGENTS.md` | **Repo-specific** agent guide (not overwritten) |
| `docs/cpt-standards/documentation.md` | This file (synced) |
| `docs/cpt-standards/azure.md` | Azure stub (synced) |
| `docs/cpt-standards/database.md` | Database private-access hard rule (synced) |
| `docs/repo-specific/` | All local architecture, deployment, runbooks, features |

## Scripts

| Location | Purpose |
|----------|---------|
| [cpt-standards `tools/common/`](https://github.com/CPT-Group/cpt-standards/tree/main/tools/common) | Shared cross-repo helpers |
| [cpt-standards `tools/README.md`](https://github.com/CPT-Group/cpt-standards/blob/main/tools/README.md) | Org-wide script catalog |
| This repo `scripts/README.md` | Repo-local script tree |

## Where to put new material

| Kind | Location |
|------|----------|
| Platform conventions (all repos) | **cpt-standards** `standards/` or `sync/payload/`, then **`/cpt-standards-sync`** |
| Repo agent router | **`docs/cpt-standards/AGENTS.md`** in **this repo** (never overwritten by sync) |
| Architecture, ERD, deep design | **`docs/repo-specific/system-design/`** |
| CD / pipelines / runbooks | **`docs/repo-specific/deployment/`** (UI hub) or **`docs/repo-specific/runbooks/`** (AZF) or **`.github/`** |
| Feature / integration docs | **`docs/repo-specific/<feature>/`** or **`docs/integration/`** (UI) |

**Do not** put long platform policy in synced stubs (`documentation.md`, `azure.md`, …) — they are overwritten on sync.

## Canonical DBML / schema

- **Schema inventory:** [schema-inventory.md](https://github.com/CPT-Group/cpt-standards/blob/main/reference/schema-inventory.md)
- **ERD:** [models/zion-postgres/](https://github.com/CPT-Group/cpt-standards/tree/main/models/zion-postgres)
- **Code source of truth:** [cpt-ef-postgres-migrations](https://github.com/CPT-Group/cpt-ef-postgres-migrations) `docs/repo-specific/system-design/`

## Changelog

| Repo type | Rule |
|-----------|------|
| UI app code | CHANGELOG for app changes |
| AZF / EF / infra | CHANGELOG for code, workflows, operator docs |
| **cpt-standards** | CHANGELOG when shared rules change; then sync siblings |

## Secrets

Never commit: connection strings, Key Vault values, PATs, or app-settings export JSON.
