# Teams Message Templates

Use one of these after running the case analysis.

## Detailed template

```markdown
## WEBSITE HEALTH CHECK - <CASE NAME>

| Field | Value |
|---|---|
| Case | <CASE NAME> |
| Website DB | <WEBSITE DB> |
| CleanClaims DB | <SQL DB> |
| Active in CPTMaster | <true/false> |
| Status | <OK/WARNING/BAD> |
| Run Time (UTC) | <timestamp> |

| Metric | Count |
|---|---:|
| Submitted in scope | <n> |
| Matched in CleanClaims | <n> |
| Missing | <n> |

### Scope and method
- Method: Confirmation number match (`ConfirmationNo`)
- Source filters: `DateReceived IS NOT NULL`, prior dates + today through `05:15`, exclude test IDs `2000000-2000039`, exclude `@cptgroup.com`
- Target filter: online rows only (`ClaimFiledOnline` or equivalent)

### Notes
- <reason or key finding>
```

## Bad-status template

```markdown
## WEBSITE HEALTH CHECK - <CASE NAME> (BAD)

Could not complete a valid comparison.

| Field | Value |
|---|---|
| Case | <CASE NAME> |
| Website DB | <WEBSITE DB> |
| CleanClaims DB | <SQL DB> |
| Failure reason | <exact technical reason> |

Action needed:
- <what should be fixed or verified>
```
