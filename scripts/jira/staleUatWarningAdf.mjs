/** ADF body for stale UAT warning comment (warning panel + assignee mention). */

export const STALE_WARNING_MARKER = 'STALE TICKET WARNING';

export const STALE_WARNING_TEXT =
  'STALE TICKET WARNING: Assignee must complete final UAT and resolve this ticket or create a bug ticket. Failure to perform UAT constitutes acceptance of the work delivered. All undiscovered issues become the assignee\u2019s responsibility.';

/**
 * @param {{ accountId: string; displayName: string } | null} assignee
 */
export function buildStaleUatWarningAdf(assignee) {
  /** @type {Array<Record<string, unknown>>} */
  const paragraphContent = [{ type: 'text', text: STALE_WARNING_TEXT }];

  if (assignee?.accountId) {
    paragraphContent.push({ type: 'text', text: ' ' });
    paragraphContent.push({
      type: 'mention',
      attrs: {
        id: assignee.accountId,
        text: `@${assignee.displayName}`,
        accessLevel: '',
        localId: 'stale-uat-assignee-mention',
      },
    });
  }

  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'panel',
        attrs: { panelType: 'warning' },
        content: [{ type: 'paragraph', content: paragraphContent }],
      },
    ],
  };
}
