# Identity, audit and attribution — read before you touch any of it

> Synced from the `cpt-standards` hub by `/cpt-standards-sync`. **Do not hand-edit** — this file is
> overwritten on the next sync. It is **routing only**; the canonical rules live in the hub.

**Canonical standard:** [`std-identity-context`](https://github.com/CPT-Group/cpt-standards/blob/main/standards/global/identity-context.md)
· related: [`std-audit-logging`](https://github.com/CPT-Group/cpt-standards/blob/main/standards/global/audit-logging.md)
· [`std-authorization`](https://github.com/CPT-Group/cpt-standards/blob/main/standards/global/authorization-standards.md)

Open the canonical standard **before** writing code that records who did something, resolves an
actor, adds a stored procedure taking `p_identity_chain`, or writes an audit or log row.

## 1. Audits and logs are not the same thing

| | Records | Question it answers |
|---|---|---|
| **Audit** | **human interaction** | *Who looked at this claimant's SSN? Who approved this?* |
| **Log** | **system action** | *What did this job/process do, and when?* |

**Do not conflate them.** A system action is not an audit event, and an audit event is not a log
line. If you are recording something a person did, it is an audit. If you are recording something a
process did unattended, it is a log. Choosing the wrong one puts the record in the wrong place and
makes "who touched this data" unanswerable.

## 2. Target audit architecture (locked)

**Write audits through the vault contract:**

```
public.usp_insert_audit_log  ->  audit_logs_vault
```

`internal_tools_app_shell.audit_logs` (via `usp_create_audit_log`) is a **live transitional legacy
store**. It still holds real history and must still be queried for historical investigation, but it
is **not** the target for new work. **Do not add new audit writes to it.** If you think you need to,
raise it first — a migration to the vault contract is already in flight.

## 3. The four identity roles

Exactly four. Never collapse them into "current user".

| Role | Meaning | PostgreSQL subscript | C# index | JSON index |
|---|---|---|---|---|
| Application | the calling application | `1` | `0` | `0` |
| Service | the executing service/managed identity | `2` | `1` | `1` |
| **Subject** | who the operation is **about** | `3` | `2` | `2` |
| **Actor** | who is **accountable** | `4` | `3` | `3` |

Attribution of writes records the **Actor**. Ownership/visibility guards normally evaluate the
**Subject** — and every such site must be classified individually, never converted mechanically.

## 4. Prohibited — these will fail review

1. Reading an identity chain positionally outside an approved resolver — subscripting,
   `array_upper` / `array_length` / `cardinality` / `unnest`, alias-then-subscript, or any
   "last element" helper. **Do not copy the `p_identity_chain[array_upper(...)]` idiom into a new
   stored procedure.** It is already present in 229 procedures and is being removed.
2. `Guid.Empty` (`00000000-0000-0000-0000-000000000000`) used as an identity, as "absent", or as
   padding — including `new Guid[] { Guid.Empty, ... }` literals.
3. A sentinel or placeholder UUID (e.g. `...0001`) standing in for a real principal.
4. Deriving impersonation from `Subject <> Actor` alone, or from the presence of a session id.
5. Mutating ambient identity state outside a scoped, self-restoring accessor.
6. Unqualified numeric slot references in code — use named properties or constants.

## 5. If you are unsure

Ask before inventing. Identity, audit and attribution are a security and compliance surface: a wrong
guess here is not a style issue, it is an unanswerable question during an audit.
