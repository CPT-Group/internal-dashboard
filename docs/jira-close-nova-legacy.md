# Closing legacy NOVA issues (NOVA-1 through NOVA-660)

The dashboards only show **NOVA-661 and above**. Older issues (NOVA-1 through NOVA-660) are legacy and can be closed or resolved so they no longer appear in Jira boards or in any fetches.

## JQL to find legacy open issues

Use this in Jira (Search or CLI) to list **open** legacy NOVA issues:

```text
project = NOVA AND statusCategory != Done AND key < NOVA-661 ORDER BY key ASC
```

Note: Jira compares keys as strings, so `key < NOVA-661` may not match exactly the numeric range 1–660 in all cases. If your instance orders keys numerically, you can instead run two queries:

- **By key (string)**: `project = NOVA AND statusCategory != Done AND key <= NOVA-660`
- Or use a filter that excludes keys you consider “current” (e.g. key in (NOVA-661, NOVA-662, ...) is not practical; filtering in the app is done client-side – see `JIRA_NOVA_MIN_ISSUE_NUM` and `filterIssuesNovaMinKey`).

**Key range in JQL:** Jira compares `key` as a string (e.g. NOVA-7 sorts after NOVA-660), so `key <= NOVA-660` does not give a strict numeric 1–660 range. For a complete list, export NOVA issues and filter by issue number ≤ 660 in a script or spreadsheet, then bulk transition.

To list legacy issues (best-effort by string key):

```text
project = NOVA AND key <= NOVA-660 ORDER BY key ASC
```

Adjust the cutoff if you change `JIRA_NOVA_MIN_ISSUE_NUM` in the app (currently 661).

## Using the Atlassian CLI (jira CLI)

1. Install and configure the [Atlassian CLI](https://support.atlassian.com/atlassian-automation/docs/use-the-atlassian-cli/) (or your preferred Jira CLI) and point it at your Jira Cloud site (e.g. `cptgroup.atlassian.net`).

2. List open legacy issues (example with `jira` CLI):

   ```bash
   jira issue list -q "project = NOVA AND statusCategory != Done AND key <= NOVA-660" --columns key,summary,status --no-header
   ```

3. Resolve or close in bulk. Exact commands depend on your CLI and workflow. Examples:

   - Resolve with a resolution (e.g. “Done”, “Won’t Do”):

     ```bash
     # One at a time (replace KEY and resolution name as needed)
     jira issue transition KEY "Done"
     ```

   - Or use your CLI’s bulk/loop support to transition each key from step 2.

4. Confirm in Jira that NOVA-1 through NOVA-660 are no longer open, and that the dashboard only shows NOVA-661+.

## After closing

- The app already excludes key &lt; 661 in all NOVA dashboards (client-side filter).
- Once legacy issues are closed in Jira, JQL results will naturally shrink and the app will only fetch and display NOVA-661+.
