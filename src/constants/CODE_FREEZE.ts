/**
 * Code Freeze mode — manual flag for activating winter/frost TV theme
 * and periodic CODE FREEZE announcement on Dev Corner dashboards.
 *
 * To enable: set CODE_FREEZE_ENABLED to true.
 * To disable: set CODE_FREEZE_ENABLED to false.
 *
 * Future: replace with a date-range schedule or environment variable.
 */
export const CODE_FREEZE_ENABLED = false;

/** How often the CODE FREEZE modal opens (ms). Default: 30 minutes. */
export const CODE_FREEZE_NOTICE_INTERVAL_MS = 30 * 60 * 1000;

/** How long the CODE FREEZE modal stays visible (ms). Default: 5 minutes. */
export const CODE_FREEZE_NOTICE_DURATION_MS = 5 * 60 * 1000;

/** Message shown inside the CODE FREEZE notice. */
export const CODE_FREEZE_NOTICE_MESSAGE = 'CODE FREEZE';

/** Subtext shown below the main CODE FREEZE message. */
export const CODE_FREEZE_NOTICE_SUBTEXT = 'No code changes are permitted during an active code freeze.';
