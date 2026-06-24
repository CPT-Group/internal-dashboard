# Database and PostgreSQL standards (synced router)

> Synced into every enterprise application repository by `/cpt-standards-sync`. **Do not
> hand-edit this copy.** It is routing only; canonical requirements remain in `cpt-standards`.

## Applicability

The receiving repository's canonical profile determines which standards are mandatory or
conditional. Receiving this router does not make every database standard applicable to every repo.

| Solution | Applicability profile |
|---|---|
| EF Core PostgreSQL migrations | [profiles/cpt-ef-postgres-migrations.md](https://github.com/CPT-Group/cpt-standards/blob/main/profiles/cpt-ef-postgres-migrations.md) |
| Azure Functions APIs and workers | [profiles/cpt-azure-functions-api.md](https://github.com/CPT-Group/cpt-standards/blob/main/profiles/cpt-azure-functions-api.md) |
| Platform infrastructure | [profiles/cpt-infra.md](https://github.com/CPT-Group/cpt-standards/blob/main/profiles/cpt-infra.md) |
| Other enterprise solutions | [Select the matching profile](https://github.com/CPT-Group/cpt-standards/tree/main/profiles) |

## Canonical PostgreSQL foundations

- **[Database network security](https://github.com/CPT-Group/cpt-standards/blob/main/standards/database/database-network-security.md)** — private login path only
- [Table design and usage profiles](https://github.com/CPT-Group/cpt-standards/blob/main/standards/database/postgres-table-design-and-usage-profiles.md)
- [Indexing, query, and performance evidence](https://github.com/CPT-Group/cpt-standards/blob/main/standards/database/postgres-indexing-query-and-performance.md)
- [Routines, database access, RLS, bridges, and extensions](https://github.com/CPT-Group/cpt-standards/blob/main/standards/database/postgres-routines-access-and-extensions.md)
- [Data lifecycle and operations](https://github.com/CPT-Group/cpt-standards/blob/main/standards/database/postgres-data-lifecycle-and-operations.md)
- [Migration deployment and artifacts](https://github.com/CPT-Group/cpt-standards/blob/main/standards/platforms/migration-deployment-and-artifacts.md)
- [Records retention and legal hold](https://github.com/CPT-Group/cpt-standards/blob/main/standards/global/records-retention-and-legal-hold.md)

## Specialized PostgreSQL standards

- [Case-scoped partitioning and partition lifecycle](https://github.com/CPT-Group/cpt-standards/blob/main/standards/platforms/postgres-partitioning.md)
- [PostMailing shared topology and legacy per-case database lifecycle](https://github.com/CPT-Group/cpt-standards/blob/main/standards/database/postgres-per-case-database-lifecycle.md)
- [Append-only audit table design](https://github.com/CPT-Group/cpt-standards/blob/main/standards/database/postgres-append-only-audit-tables.md)
- [Queue, job, and worker tables](https://github.com/CPT-Group/cpt-standards/blob/main/standards/database/postgres-queue-job-and-worker-tables.md)
- [Staging, import, and quarantine](https://github.com/CPT-Group/cpt-standards/blob/main/standards/database/postgres-staging-import-and-quarantine.md)
- [Alteryx dynamic staging and promotion](https://github.com/CPT-Group/cpt-standards/blob/main/standards/database/postgres-alteryx-dynamic-staging.md)
- [Projections, caches, and reporting](https://github.com/CPT-Group/cpt-standards/blob/main/standards/database/postgres-projections-caches-and-reporting.md)

## Inventory and design references

- [PostgreSQL schema inventory](https://github.com/CPT-Group/cpt-standards/blob/main/reference/schema-inventory.md)
- [Function App and database map](https://github.com/CPT-Group/cpt-standards/blob/main/reference/data-platform-map.md)
- [PostgreSQL developer access](https://github.com/CPT-Group/cpt-standards/blob/main/reference/postgres-developer-access.md)
- [PostgreSQL DBML](https://github.com/CPT-Group/cpt-standards/blob/main/models/zion-postgres-v1.dbml)
- [ADR-0008: PostgreSQL architecture defaults](https://github.com/CPT-Group/cpt-standards/blob/main/decisions/0008-postgres-architecture-defaults.md)

## Hard rule (summary)

**Under no circumstances may any database be made publicly accessible** — in any environment, for
any reason (including CI/CD, debugging, or temporary access). Use **private connectivity only**
(VNet integration, private endpoint, private DNS, private host in connection strings). Pipelines
must use private-path runners and secrets such as `POSTGRES_PRIVATE_HOST`; never enable public
access or firewall IP allow lists.

**Repo-specific:** topology tables, private-endpoint addresses, and runbooks live under
**`docs/repo-specific/`** in the receiving repository and are not overwritten by sync.
