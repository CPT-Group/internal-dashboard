# Comparison Methods (When and Why)

This page explains how to choose the correct comparison method for a case.

## Method A - Confirmation Number (business-facing)

Use this when you want to answer:

> "Do online submissions have a corresponding claim record?"

How it works:

- Match source `Submissions.ConfirmationNo` to target `CleanClaims.ConfirmationNo`.
- Only evaluate source rows with non-empty confirmation number.
- Keep source rules (`DateReceived IS NOT NULL`, prior dates + today through `05:15`, exclude test IDs `2000000-2000039`, exclude internal `@cptgroup.com` test emails).

Why this is strong:

- Confirmation number is the user-facing claim tracking key.
- It is usually the clearest method for stakeholder conversations.

## Method B - ID linkage (`MailingListID` vs `Submissions.ID`) (technical/pipeline)

Use this when you want to answer:

> "Does technical ID linkage line up with downloader pipeline expectations?"

How it works:

- Match `CleanClaims.MailingListID` (or equivalent ID column) to `Submissions.ID`.

Why this can differ from Method A:

- Some cases have historical ID offsets, remaps, or migration behavior.
- A strict ID-equality check can report "missing" even when confirmation-based record exists.

## Method C - Hybrid fallback (operational compromise)

Use this when you want one operational metric:

- If source row has `ConfirmationNo`, check by confirmation.
- If source row has no confirmation, fall back to ID match.

This keeps business visibility strong while still handling no-confirmation edge rows.

## Recommended interpretation order

1. Start with Method A (Confirmation) for business truth.
2. Use Method B (ID linkage) as a technical diagnostic.
3. If Method A and B differ, report both and explain why.
4. Use Method C only if you need one dashboard number across mixed data quality.

## Example: Fashion Nova (Alcazar)

- Confirmation-based check (with agreed cutoff) showed no missing.
- ID-based check showed large missing due to mapping mismatch.
- Conclusion: large ID-gap number was a linkage-method issue, not confirmed record absence.

